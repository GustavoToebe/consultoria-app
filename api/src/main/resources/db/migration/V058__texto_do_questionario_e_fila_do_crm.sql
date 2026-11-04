-- Texto do questionário de atualização padrão (auditoria de UI/UX de 03/11, "Seu envio"; docs/planos/miudos-com-api-04-11.md):
-- o cartão da primeira seção e o campo da data se chamavam "Atualização", igual à tela. Agora o cartão é "Seu envio" e o
-- campo, "Data marcada" (é o dia combinado da pasta, não o dia em que o aluno enviou). Só texto: ids, tipos e regras não mudam.

-- 1. Fábrica nova (versão 3): de onde sai o Padrão das consultorias criadas daqui para a frente. A versão 2 fica como estava.
INSERT INTO atualizacao_modelo (id, versao, conteudo, criado_em)
SELECT gen_random_uuid(), 3,
       jsonb_set(jsonb_set(conteudo, '{secoes,0,titulo}', '"Seu envio"'), '{secoes,0,perguntas,0,rotulo}', '"Data marcada"'),
       now()
  FROM atualizacao_modelo WHERE versao = 2;

-- 2. Consultorias que já existem: a versão publicada é imutável (trigger), então o Padrão que o treinador nunca mexeu
--    (versão 1 igual à fábrica antiga, rascunho igual a ela, nenhuma outra versão) ganha a versão 2 com o texto novo.
--    Quem editou o Padrão fica como está (o texto é dele). O aluno com atualização aberta passa a ver a versão 2 (resolvida
--    na hora) e o envio da v1 continua valendo para o que já foi respondido.
-- Um comando só (sem tabela temporária): o papel de migração da produção não precisa do privilégio TEMP.
WITH alvo AS (
    SELECT q.id AS questionario_id, q.consultoria_id
      FROM questionario q
      JOIN atualizacao_modelo antigo ON antigo.versao = 2
     WHERE q.padrao AND q.finalidade = 'ATUALIZACAO' AND q.versao_publicada = 1
       AND q.rascunho = antigo.conteudo
       AND (SELECT count(*) FROM questionario_versao v WHERE v.questionario_id = q.id) = 1
       AND EXISTS (SELECT 1 FROM questionario_versao v WHERE v.questionario_id = q.id AND v.numero = 1 AND v.conteudo = antigo.conteudo)
), nova AS (
    INSERT INTO questionario_versao (id, consultoria_id, questionario_id, numero, conteudo)
    SELECT md5(a.consultoria_id::text || ':questionario-padrao:2')::uuid, a.consultoria_id, a.questionario_id, 2, novo.conteudo
      FROM alvo a
      JOIN atualizacao_modelo novo ON novo.versao = 3
    RETURNING questionario_id
)
UPDATE questionario q
   SET rascunho = novo.conteudo, rascunho_alterado_em = now(), versao_publicada = 2, publicado_em = now(), versao = q.versao + 1
  FROM nova, atualizacao_modelo novo
 WHERE q.id = nova.questionario_id AND novo.versao = 3;

-- 3. Inscrição reaberta sobe na lista (ajustes do vídeo de 30/10, B8). A lista ordena por "na fila desde": a criação da inscrição
--    ou, se foi reaberta, o instante da última reabertura. A data de criação (criada_em) não muda: os filtros de entrada, os
--    indicadores e o "Inscrição em ..." da ficha seguem contando a entrada original. Quem já foi reaberta ganha a data do
--    último evento REABERTA.
ALTER TABLE inscricao ADD COLUMN na_fila_desde timestamptz;
UPDATE inscricao i SET na_fila_desde = coalesce(
    (SELECT max(e.criado_em) FROM inscricao_evento e
      WHERE e.consultoria_id = i.consultoria_id AND e.inscricao_id = i.id AND e.tipo = 'REABERTA'), i.criada_em);
ALTER TABLE inscricao ALTER COLUMN na_fila_desde SET NOT NULL;
ALTER TABLE inscricao ALTER COLUMN na_fila_desde SET DEFAULT now();
DROP INDEX ix_inscricao_fila;
DROP INDEX ix_inscricao_responsavel;
CREATE INDEX ix_inscricao_fila ON inscricao (consultoria_id, situacao, na_fila_desde DESC);
CREATE INDEX ix_inscricao_responsavel ON inscricao (consultoria_id, responsavel_id, na_fila_desde DESC);
