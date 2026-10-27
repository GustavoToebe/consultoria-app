-- Registro por etapa (análise de 26/10, docs/series-etapas.md): blocos do Cluster e etapa inicial + retomadas do
-- Rest-pause ficam dentro da série registrada, numa lista jsonb trocada inteira a cada envio (mesma precedência por
-- alterado_no_aparelho_em). A etapa não vira série: a chave da linha continua (aluno, versão, série, dia).
ALTER TABLE execucao_serie
    ADD COLUMN etapas jsonb,
    -- Referência da carga congelada ao registrar a primeira etapa (WS anterior ou base do dia), só para consulta.
    ADD COLUMN referencia_carga numeric(7,2),
    ADD COLUMN referencia_origem varchar(20),
    -- Entra no progresso ("maior carga do dia"): papel TRABALHO na metodologia da versão, ou carga de trabalho. A última
    -- carga (base sugerida) continua só com serie_trabalho.
    ADD COLUMN conta_no_progresso boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT ck_execucao_serie_etapas CHECK (etapas IS NULL OR jsonb_typeof(etapas) = 'array'),
    ADD CONSTRAINT ck_execucao_serie_referencia_carga CHECK (referencia_carga IS NULL OR (referencia_carga >= 0 AND referencia_carga <= 2000)),
    ADD CONSTRAINT ck_execucao_serie_referencia_origem CHECK (referencia_origem IS NULL OR referencia_origem IN ('WS_ANTERIOR', 'BASE_DO_DIA'));

UPDATE execucao_serie SET conta_no_progresso = serie_trabalho;

CREATE INDEX ix_exec_progresso ON execucao_serie (aluno_id, exercicio_id, data) WHERE conta_no_progresso AND carga IS NOT NULL;
