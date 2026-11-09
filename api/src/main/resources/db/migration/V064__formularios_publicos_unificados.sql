-- Múltiplos formulários públicos unificados (C62 / N37; docs/planos/formularios-unificados.md).
-- Permite que qualquer questionário tenha link público próprio, encadeamento e destino no perfil.

-- 1. Colunas de publicação e encadeamento no questionario
ALTER TABLE questionario
    ADD COLUMN codigo_publico VARCHAR(60) UNIQUE,
    ADD COLUMN publico_aberto BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN responsavel_padrao_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    ADD COLUMN proximo_questionario_id UUID REFERENCES questionario(id) ON DELETE SET NULL;

-- 2. Migra os dados da inscricao_configuracao para o questionário padrão de inscrição de cada consultoria
UPDATE questionario q
SET codigo_publico = ic.codigo,
    publico_aberto = ic.aberta,
    responsavel_padrao_id = ic.responsavel_id
FROM inscricao_configuracao ic
WHERE q.consultoria_id = ic.consultoria_id
  AND q.finalidade = 'INSCRICAO'
  AND q.padrao = TRUE
  AND q.arquivado = FALSE;

-- 3. Gera código público único para questionários que ainda não receberam
UPDATE questionario
SET codigo_publico = replace(gen_random_uuid()::text, '-', '')
WHERE codigo_publico IS NULL;

-- 4. Colunas de rastreio de formulário e indicação na inscrição
ALTER TABLE inscricao
    ADD COLUMN questionario_id UUID REFERENCES questionario(id) ON DELETE SET NULL,
    ADD COLUMN questionario_nome VARCHAR(120),
    ADD COLUMN indicado_por VARCHAR(120);

-- Preenche questionario_id e questionario_nome para inscrições já existentes com versão associada
UPDATE inscricao i
SET questionario_id = qv.questionario_id,
    questionario_nome = q.nome
FROM questionario_versao qv
JOIN questionario q ON q.id = qv.questionario_id
WHERE i.questionario_versao_id = qv.id;

-- 5. Atualiza destinos aceitos em anamnese_pendencia
ALTER TABLE anamnese_pendencia DROP CONSTRAINT IF EXISTS ck_anamnese_pendencia_destino;
ALTER TABLE anamnese_pendencia ADD CONSTRAINT ck_anamnese_pendencia_destino
    CHECK (destino IN ('NOME', 'TELEFONE', 'EMAIL', 'SEXO', 'DATA_NASCIMENTO', 'ALTURA', 'PESO', 'CPF', 'ENDERECO', 'OBJETIVO', 'OBSERVACOES'));
