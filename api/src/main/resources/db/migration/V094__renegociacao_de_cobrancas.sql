-- Renegociar cobranças (D14 de docs/planos/financeiro-em-fases.md, frente F4): várias cobranças ABERTAS de um aluno viram um acordo em
-- 1 a 12 parcelas. As originais passam a RENEGOCIADA (situação nova) e nascem N cobranças RENEGOCIACAO (tipo novo, sem contratação nem
-- competência, como a AVULSA). Sem compatibilidade com o antigo (ainda não há cliente real).

-- 1. O acordo: uma linha por renegociação confirmada. Guarda o pedido do app (idempotência: o mesmo `pedido_id` devolve o que já foi feito,
--    mesmo depois de desfeito, por isso as contagens e o total ficam aqui) e o "já desfeito" (`desfeito_em`). Sem texto livre: o motivo
--    do treinador vai no `motivo` das cobranças originais (já existe, é limpo pela anonimização) e não é dado deste esquema.
CREATE TABLE acordo_de_cobranca (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    aluno_id       uuid NOT NULL,
    pedido_id      uuid NOT NULL,
    renegociadas   smallint NOT NULL CONSTRAINT ck_acordo_renegociadas CHECK (renegociadas BETWEEN 1 AND 100),
    parcelas       smallint NOT NULL CONSTRAINT ck_acordo_parcelas CHECK (parcelas BETWEEN 1 AND 12),
    total_centavos bigint NOT NULL CONSTRAINT ck_acordo_total CHECK (total_centavos > 0),
    desfeito_em    timestamptz,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    versao         bigint NOT NULL DEFAULT 0,
    CONSTRAINT fk_acordo_aluno FOREIGN KEY (consultoria_id, aluno_id) REFERENCES aluno (consultoria_id, id),
    -- Um pedido gera um acordo só por consultoria (o mesmo UUID em outra consultoria não conflita); serve também à consulta por pedido.
    CONSTRAINT ux_acordo_pedido UNIQUE (consultoria_id, pedido_id),
    -- Alvo da FK composta da cobrança (o acordo nunca é de outra consultoria).
    CONSTRAINT ux_acordo_consultoria_id UNIQUE (consultoria_id, id)
);
CREATE INDEX ix_acordo_aluno ON acordo_de_cobranca (consultoria_id, aluno_id);

-- 2. Situação e tipo novos. `situacao` era varchar(10) e RENEGOCIADA tem 11 letras: alarga antes de refazer o CHECK (a V074 deu 12 ao
--    `tipo`, onde RENEGOCIACAO cabe justo). As constraints saem antes do ALTER e voltam no fim.
ALTER TABLE cobranca_aluno DROP CONSTRAINT ck_cobranca_situacao;
ALTER TABLE cobranca_aluno ALTER COLUMN situacao TYPE varchar(12);
ALTER TABLE cobranca_aluno
    ADD CONSTRAINT ck_cobranca_situacao
        CHECK (situacao IN ('ABERTA', 'PAGA', 'CANCELADA', 'ESTORNADA', 'CONTESTADA', 'RENEGOCIADA'));
ALTER TABLE cobranca_aluno DROP CONSTRAINT ck_cobranca_tipo;
ALTER TABLE cobranca_aluno
    ADD CONSTRAINT ck_cobranca_tipo CHECK (tipo IN ('MENSALIDADE', 'SAIDA', 'AVULSA', 'RENEGOCIACAO'));

-- 3. A RENEGOCIACAO é como a AVULSA: sem contratação nem competência e com descrição própria (fixa, do servidor). Os dois CHECKs da V087
--    comparavam `tipo = 'AVULSA'` e passam a valer para os dois tipos sem contratação.
ALTER TABLE cobranca_aluno DROP CONSTRAINT ck_cobranca_contratacao_so_avulsa;
ALTER TABLE cobranca_aluno DROP CONSTRAINT ck_cobranca_descricao_so_avulsa;
ALTER TABLE cobranca_aluno
    ADD CONSTRAINT ck_cobranca_contratacao_so_avulsa CHECK (
        (tipo IN ('AVULSA', 'RENEGOCIACAO') AND contratacao_id IS NULL AND competencia IS NULL)
        OR (tipo NOT IN ('AVULSA', 'RENEGOCIACAO') AND contratacao_id IS NOT NULL AND competencia IS NOT NULL)),
    ADD CONSTRAINT ck_cobranca_descricao_so_avulsa CHECK (
        (tipo IN ('AVULSA', 'RENEGOCIACAO') AND descricao IS NOT NULL AND btrim(descricao) <> '')
        OR (tipo NOT IN ('AVULSA', 'RENEGOCIACAO') AND descricao IS NULL));

-- 4. O acordo da cobrança: nas originais RENEGOCIADA e nas parcelas RENEGOCIACAO (que o guardam mesmo canceladas). Depois de desfeito
--    as originais voltam a ABERTA com `acordo_id` nulo. A FK composta não é conferida com `acordo_id` nulo (MATCH SIMPLE).
--    `pedido_id` e `parcela` seguem só da AVULSA (ck_cobranca_pedido_e_parcela não muda): a idempotência do acordo mora no acordo.
ALTER TABLE cobranca_aluno ADD COLUMN acordo_id uuid;
ALTER TABLE cobranca_aluno
    ADD CONSTRAINT fk_cobranca_acordo FOREIGN KEY (consultoria_id, acordo_id)
        REFERENCES acordo_de_cobranca (consultoria_id, id),
    ADD CONSTRAINT ck_cobranca_acordo CHECK (
        (tipo <> 'RENEGOCIACAO' OR acordo_id IS NOT NULL)
        AND (situacao <> 'RENEGOCIADA' OR acordo_id IS NOT NULL)
        AND (acordo_id IS NULL OR tipo = 'RENEGOCIACAO' OR situacao = 'RENEGOCIADA'));
-- "As cobranças deste acordo" (desfazer, lista, exportação).
CREATE INDEX ix_cobranca_acordo ON cobranca_aluno (consultoria_id, acordo_id) WHERE acordo_id IS NOT NULL;
