-- Correções da revisão dos formulários públicos unificados (V064, já em produção). Passa a existir UMA fonte do link
-- público: o questionário de inscrição. A tabela inscricao_configuracao deixa de ser lida e escrita pelo código; ela fica
-- como está nesta migration (nada é apagado; sai numa migration própria depois de conferida em produção).
-- Cada UPDATE restringe por consultoria_id, menos os que corrigem de propósito um dado que atravessa consultorias.

-- 1. O texto de apresentação/privacidade (que torna a ciência obrigatória) e os campos fixos escondidos moram no
--    questionário público; a V064 não os copiou. 2000 como em inscricao_configuracao.texto (o plano previa 1000).
--    link_versao é o lock otimista das ações do link (abrir, responsável, texto, campos, novo código): fica fora da
--    versao do questionário para o editor não levar 409 quando alguém abre ou fecha o link.
ALTER TABLE questionario
    ADD COLUMN IF NOT EXISTS texto_apresentacao varchar(2000),
    ADD COLUMN IF NOT EXISTS campos_ocultos varchar(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS link_versao bigint NOT NULL DEFAULT 0;
ALTER TABLE questionario DROP CONSTRAINT IF EXISTS ck_questionario_campos_ocultos;
ALTER TABLE questionario ADD CONSTRAINT ck_questionario_campos_ocultos CHECK (campos_ocultos ~ '^[A-Z_,]*$');

-- 2. Código de link legado que o salvar da V064 deixou ficar em questionário que não é o padrão da própria consultoria
--    (inclusive de outra): vira nulo e fechado. O JOIN por código atravessa consultorias de propósito.
UPDATE questionario q
SET codigo_publico = NULL, publico_aberto = FALSE
FROM inscricao_configuracao ic
WHERE q.codigo_publico = ic.codigo
  AND NOT (q.consultoria_id = ic.consultoria_id AND q.finalidade = 'INSCRICAO' AND q.padrao AND NOT q.arquivado);

-- 3. Só o questionário de inscrição tem link público (AGENTS.md: a anamnese se responde logada). A V064 deu um código a
--    todos os questionários; o que não é de inscrição perde código, abertura e encadeamento.
UPDATE questionario
SET codigo_publico = NULL, publico_aberto = FALSE, proximo_questionario_id = NULL
WHERE finalidade <> 'INSCRICAO'
  AND (codigo_publico IS NOT NULL OR publico_aberto OR proximo_questionario_id IS NOT NULL);

-- 4. Código, abertura e responsável de quem já tem configuração: o cartão "Link" do Interessados (inscricao_configuracao)
--    era o único controle de verdade depois da V064 (o editor só devolvia o que leu), então ele vale. Sem isso, um link
--    desligado ou trocado pelo cartão continuaria aberto pelo código antigo, que a V064 copiou para o questionário.
UPDATE questionario q
SET codigo_publico = ic.codigo, publico_aberto = ic.aberta, responsavel_padrao_id = ic.responsavel_id
FROM inscricao_configuracao ic
WHERE q.consultoria_id = ic.consultoria_id
  AND q.finalidade = 'INSCRICAO' AND q.padrao AND NOT q.arquivado
  AND (q.codigo_publico IS DISTINCT FROM ic.codigo OR q.publico_aberto <> ic.aberta
       OR q.responsavel_padrao_id IS DISTINCT FROM ic.responsavel_id);

-- 4b. Código fechado não está no ar: o que não veio de inscricao_configuracao (144 bits) é descartado, para abrir de novo
--     sempre gerar um código novo do servidor (CodigoDeInscricao.novo()), nunca reaproveitar um de 64 bits da V064 ou anterior.
UPDATE questionario q
SET codigo_publico = NULL
WHERE q.codigo_publico IS NOT NULL
  AND NOT q.publico_aberto
  AND NOT EXISTS (SELECT 1 FROM inscricao_configuracao ic
                  WHERE ic.consultoria_id = q.consultoria_id AND ic.codigo = q.codigo_publico);

-- 5. Texto de privacidade/consentimento e campos escondidos: só entram onde o destino está vazio (nada que já foi
--    editado no questionário é sobrescrito; repetir a migration não muda mais nada).
UPDATE questionario q
SET texto_apresentacao = CASE WHEN q.texto_apresentacao IS NULL AND btrim(coalesce(ic.texto, '')) <> ''
                              THEN ic.texto ELSE q.texto_apresentacao END,
    campos_ocultos = CASE WHEN q.campos_ocultos = '' THEN ic.campos_ocultos ELSE q.campos_ocultos END
FROM inscricao_configuracao ic
WHERE q.consultoria_id = ic.consultoria_id
  AND q.finalidade = 'INSCRICAO' AND q.padrao AND NOT q.arquivado
  AND ((q.texto_apresentacao IS NULL AND btrim(coalesce(ic.texto, '')) <> '')
       OR (q.campos_ocultos = '' AND ic.campos_ocultos <> ''));

-- 6. Responsável e próximo formulário só da própria consultoria (a V064 criou chaves de uma coluna só); o próximo é
--    sempre outro questionário de inscrição.
UPDATE questionario q
SET responsavel_padrao_id = NULL
WHERE q.responsavel_padrao_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = q.responsavel_padrao_id AND u.consultoria_id = q.consultoria_id);

UPDATE questionario q
SET proximo_questionario_id = NULL
WHERE q.proximo_questionario_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM questionario n WHERE n.id = q.proximo_questionario_id
                  AND n.consultoria_id = q.consultoria_id AND n.finalidade = 'INSCRICAO');

ALTER TABLE questionario DROP CONSTRAINT IF EXISTS ck_questionario_link_so_inscricao;
ALTER TABLE questionario ADD CONSTRAINT ck_questionario_link_so_inscricao
    CHECK (finalidade = 'INSCRICAO' OR (codigo_publico IS NULL AND NOT publico_aberto AND proximo_questionario_id IS NULL));

ALTER TABLE questionario DROP CONSTRAINT IF EXISTS fk_questionario_responsavel_padrao;
ALTER TABLE questionario ADD CONSTRAINT fk_questionario_responsavel_padrao
    FOREIGN KEY (consultoria_id, responsavel_padrao_id) REFERENCES usuario (consultoria_id, id)
    ON DELETE SET NULL (responsavel_padrao_id);

ALTER TABLE questionario DROP CONSTRAINT IF EXISTS fk_questionario_proximo;
ALTER TABLE questionario ADD CONSTRAINT fk_questionario_proximo
    FOREIGN KEY (consultoria_id, proximo_questionario_id) REFERENCES questionario (consultoria_id, id)
    ON DELETE SET NULL (proximo_questionario_id);

-- 7. NOME, EMAIL, DATA_NASCIMENTO, ALTURA e OBSERVACOES não têm onde gravar no cadastro (o código nunca criou pendência
--    para eles): voltam a ficar fora da lista. NOT VALID = vale para as linhas novas sem reler as antigas.
ALTER TABLE anamnese_pendencia DROP CONSTRAINT IF EXISTS ck_anamnese_pendencia_destino;
ALTER TABLE anamnese_pendencia ADD CONSTRAINT ck_anamnese_pendencia_destino
    CHECK (destino IN ('PESO', 'OBJETIVO', 'CPF', 'TELEFONE', 'ENDERECO', 'SEXO')) NOT VALID;
