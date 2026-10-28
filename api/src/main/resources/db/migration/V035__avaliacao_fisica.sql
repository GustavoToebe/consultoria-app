-- Avaliação física do aluno: só circunferências em cm (uma casa decimal, 5 a 300), registradas pela equipe numa data.
-- Dado sensível (LGPD): nunca em log, auditoria com valor, mensagem de erro ou seed. Sem dobras, percentual de gordura
-- ou classificação: o sistema só guarda e compara. O peso não é duplicado aqui (vem de registro_peso da mesma data).
-- Uma avaliação por data de cada aluno: a comparação escolhe datas.
CREATE TABLE avaliacao_fisica (
    id                        uuid PRIMARY KEY,
    consultoria_id            uuid NOT NULL REFERENCES consultoria (id),
    aluno_id                  uuid NOT NULL,
    data                      date NOT NULL,
    braco_direito_cm          numeric(4, 1),
    braco_esquerdo_cm         numeric(4, 1),
    peitoral_cm               numeric(4, 1),
    cintura_cm                numeric(4, 1),
    abdomen_cm                numeric(4, 1),
    quadril_cm                numeric(4, 1),
    coxa_direita_cm           numeric(4, 1),
    coxa_esquerda_cm          numeric(4, 1),
    panturrilha_direita_cm    numeric(4, 1),
    panturrilha_esquerda_cm   numeric(4, 1),
    observacao                varchar(1000),
    versao                    bigint NOT NULL DEFAULT 0,
    criado_em                 timestamptz NOT NULL DEFAULT now(),
    criado_por                uuid NOT NULL,
    alterado_em               timestamptz NOT NULL DEFAULT now(),
    alterado_por              uuid NOT NULL,
    CONSTRAINT fk_avaliacao_fisica_aluno FOREIGN KEY (consultoria_id, aluno_id) REFERENCES aluno (consultoria_id, id),
    CONSTRAINT ux_avaliacao_fisica_aluno_data UNIQUE (aluno_id, data),
    CONSTRAINT ck_avaliacao_fisica_medidas CHECK (
        (braco_direito_cm IS NULL OR braco_direito_cm BETWEEN 5 AND 300)
        AND (braco_esquerdo_cm IS NULL OR braco_esquerdo_cm BETWEEN 5 AND 300)
        AND (peitoral_cm IS NULL OR peitoral_cm BETWEEN 5 AND 300)
        AND (cintura_cm IS NULL OR cintura_cm BETWEEN 5 AND 300)
        AND (abdomen_cm IS NULL OR abdomen_cm BETWEEN 5 AND 300)
        AND (quadril_cm IS NULL OR quadril_cm BETWEEN 5 AND 300)
        AND (coxa_direita_cm IS NULL OR coxa_direita_cm BETWEEN 5 AND 300)
        AND (coxa_esquerda_cm IS NULL OR coxa_esquerda_cm BETWEEN 5 AND 300)
        AND (panturrilha_direita_cm IS NULL OR panturrilha_direita_cm BETWEEN 5 AND 300)
        AND (panturrilha_esquerda_cm IS NULL OR panturrilha_esquerda_cm BETWEEN 5 AND 300)),
    CONSTRAINT ck_avaliacao_fisica_alguma_medida CHECK (
        num_nonnulls(braco_direito_cm, braco_esquerdo_cm, peitoral_cm, cintura_cm, abdomen_cm, quadril_cm,
                     coxa_direita_cm, coxa_esquerda_cm, panturrilha_direita_cm, panturrilha_esquerda_cm) > 0)
);

CREATE INDEX ix_avaliacao_fisica_aluno_data ON avaliacao_fisica (consultoria_id, aluno_id, data DESC);
