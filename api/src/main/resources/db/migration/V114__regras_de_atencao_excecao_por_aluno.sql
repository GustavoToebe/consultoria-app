-- Regras de atenção, etapa 2: exceção por aluno (docs/planos/regras-de-atencao.md). Número PROVISÓRIO: renumerar no merge final
-- para o próximo livre. Desligado com TREINOS_REGRAS_ATENCAO_HABILITADO (as rotas dão 503 e nada é avaliado).
-- A regra desligada só para um aluno (ativa false, sem número) ou com o número dele (ativa true, com limite). Vale a partir do
-- próximo envio (o fato da V112 congela o número vigente). Nunca liga uma regra que a consultoria desligou. Sem texto livre.
-- Sai com a regra e com o aluno (cascade); anonimizar e "Excluir minha conta" apagam à parte (a linha do aluno fica).
CREATE TABLE regra_de_atencao_aluno (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    regra_id       uuid NOT NULL,
    aluno_id       uuid NOT NULL,
    ativa          boolean NOT NULL,
    limite         numeric(4, 1) CONSTRAINT ck_regra_atencao_aluno_limite_faixa CHECK (limite BETWEEN 0 AND 50),
    versao         bigint NOT NULL DEFAULT 0,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    alterado_em    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_regra_atencao_aluno_limite CHECK ((limite IS NOT NULL) = ativa),
    CONSTRAINT fk_regra_atencao_aluno_regra FOREIGN KEY (consultoria_id, regra_id)
        REFERENCES regra_de_atencao (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_regra_atencao_aluno_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id) ON DELETE CASCADE,
    -- Uma exceção por (regra, aluno); serve também a contagem "N alunos com exceção" e o cascade da regra.
    CONSTRAINT ux_regra_atencao_aluno UNIQUE (consultoria_id, regra_id, aluno_id)
);
-- A ficha, o envio, a limpeza da LGPD e o cascade do aluno.
CREATE INDEX ix_regra_atencao_aluno_aluno ON regra_de_atencao_aluno (consultoria_id, aluno_id);
