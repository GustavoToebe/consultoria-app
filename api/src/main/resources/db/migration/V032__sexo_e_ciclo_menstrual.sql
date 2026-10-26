-- Sexo do aluno (opcional) e acompanhamento do ciclo menstrual, ligado só pela própria aluna.
-- Dado de saúde: nunca em log, auditoria com valor, mensagem de erro ou seed. Nenhum texto de fase entra aqui.
ALTER TABLE aluno
    ADD COLUMN sexo varchar(10),
    ADD COLUMN ciclo_ativado_em timestamptz,
    ADD COLUMN ciclo_consentimento_versao int,
    ADD COLUMN ciclo_duracao_habitual int,
    ADD COLUMN ciclo_mostrar_fases boolean NOT NULL DEFAULT true,
    ADD CONSTRAINT ck_aluno_sexo CHECK (sexo IS NULL OR sexo IN ('MASCULINO', 'FEMININO', 'OUTRO')),
    ADD CONSTRAINT ck_aluno_ciclo_duracao CHECK (ciclo_duracao_habitual IS NULL OR ciclo_duracao_habitual BETWEEN 21 AND 45);

ALTER TABLE inscricao
    ADD COLUMN sexo varchar(10),
    ADD CONSTRAINT ck_inscricao_sexo CHECK (sexo IS NULL OR sexo IN ('MASCULINO', 'FEMININO', 'OUTRO'));

ALTER TABLE anamnese_pendencia DROP CONSTRAINT ck_anamnese_pendencia_destino;
ALTER TABLE anamnese_pendencia ADD CONSTRAINT ck_anamnese_pendencia_destino
    CHECK (destino IN ('PESO', 'OBJETIVO', 'CPF', 'TELEFONE', 'ENDERECO', 'SEXO'));

CREATE TABLE ciclo_registro (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    aluno_id       uuid NOT NULL REFERENCES aluno (id),
    inicio         date NOT NULL,
    fim            date,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    alterado_em    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_ciclo_registro_fim CHECK (fim IS NULL OR (fim >= inicio AND fim <= inicio + 15))
);

CREATE INDEX ix_ciclo_registro_aluno_inicio ON ciclo_registro (aluno_id, inicio);

CREATE TABLE ciclo_dia (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    aluno_id       uuid NOT NULL REFERENCES aluno (id),
    data           date NOT NULL,
    fluxo          varchar(20),
    colica         varchar(20),
    sintomas       text[],
    observacao     varchar(300),
    criado_em      timestamptz NOT NULL DEFAULT now(),
    alterado_em    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_ciclo_dia_aluno_data UNIQUE (aluno_id, data),
    CONSTRAINT ck_ciclo_dia_fluxo CHECK (fluxo IS NULL OR fluxo IN ('SANGRAMENTO_LEVE', 'LEVE', 'MEDIO', 'INTENSO')),
    CONSTRAINT ck_ciclo_dia_colica CHECK (colica IS NULL OR colica IN ('NENHUMA', 'LEVE', 'MEDIA', 'FORTE')),
    CONSTRAINT ck_ciclo_dia_sintomas CHECK (sintomas IS NULL OR sintomas <@ ARRAY[
        'INCHACO', 'DOR_DE_CABECA', 'SENSIBILIDADE_NAS_MAMAS', 'ACNE', 'ALTERACAO_DE_HUMOR',
        'CANSACO', 'ALTERACAO_DO_SONO', 'MAIS_FOME', 'NAUSEA', 'DOR_LOMBAR']::text[]),
    CONSTRAINT ck_ciclo_dia_preenchido CHECK (
        fluxo IS NOT NULL OR colica IS NOT NULL
            OR (sintomas IS NOT NULL AND cardinality(sintomas) > 0)
            OR (observacao IS NOT NULL AND length(btrim(observacao)) > 0))
);

ALTER TABLE consultoria ADD COLUMN textos_fases_ciclo jsonb;
