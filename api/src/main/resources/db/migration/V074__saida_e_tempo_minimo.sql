-- Saída antes do tempo mínimo (docs/planos/saida-e-tempo-minimo.md). Sem preenchimento retroativo: o que já existe fica sem mínimo.

-- 1. Plano comercial: tempo mínimo (só mensal) e lembrete da regra de saída do contrato (texto livre, nunca valor nem percentual).
ALTER TABLE plano_comercial
    ADD COLUMN tempo_minimo_meses smallint CONSTRAINT ck_plano_tempo_minimo CHECK (tempo_minimo_meses BETWEEN 1 AND 60),
    ADD COLUMN regra_de_saida varchar(500),
    ADD CONSTRAINT ck_plano_minimo_so_mensal CHECK (tempo_minimo_meses IS NULL OR periodicidade = 'MENSAL');

-- 2. Contratação: fim do período mínimo desta contratação (início + N meses), editável por aluno.
ALTER TABLE contratacao_aluno ADD COLUMN minimo_ate date;

-- 3. Cobrança: MENSALIDADE (a de sempre) ou SAIDA (cobrança de saída, uma viva por contratação, sem link de pagamento).
--    A saída usa a data do encerramento como competência, então a unicidade por competência passa a valer só para a mensalidade.
ALTER TABLE cobranca_aluno
    ADD COLUMN tipo varchar(12) NOT NULL DEFAULT 'MENSALIDADE' CONSTRAINT ck_cobranca_tipo CHECK (tipo IN ('MENSALIDADE', 'SAIDA'));
ALTER TABLE cobranca_aluno DROP CONSTRAINT ux_cobranca_competencia;
CREATE UNIQUE INDEX ux_cobranca_competencia ON cobranca_aluno (consultoria_id, contratacao_id, competencia) WHERE tipo = 'MENSALIDADE';
CREATE UNIQUE INDEX ux_cobranca_saida_viva ON cobranca_aluno (consultoria_id, contratacao_id)
    WHERE tipo = 'SAIDA' AND situacao NOT IN ('CANCELADA', 'ESTORNADA');
