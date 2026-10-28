-- "Concluir treino" (frente Engajamento, passo 0.1): o aluno encerra uma sessão do treino num dia e diz como foi. Um registro por
-- sessão, dia e versão publicada que ele via; o id nasce no aparelho (UUID), então reenviar não duplica. Reabrir é o mesmo
-- registro com concluida = false (o último a chegar vence, pelo horário do aparelho, como na mobilidade e nas séries).
-- Resultado só existe quando concluída (COMPLETA ou PARCIAL); a duração, em segundos, é opcional (1 min a 6 h).
-- comentario é texto livre do aluno (dado sensível, LGPD): nunca em log, auditoria ou erro; a anonimização o apaga e mantém o resto.
-- situacao RECUSADO só guarda a sessão que não existe na versão (permanente, a versão é imutável), sem resultado, duração
-- nem comentário; as demais recusas só saem na resposta, para nunca sobrescrever um registro aceito (como na V016).
CREATE TABLE sessao_concluida (
    id                      uuid PRIMARY KEY,
    consultoria_id          uuid NOT NULL REFERENCES consultoria (id),
    aluno_id                uuid NOT NULL REFERENCES aluno (id),
    plano_versao_id         uuid NOT NULL REFERENCES plano_treino_versao (id),
    sessao_uid              uuid NOT NULL,
    data                    date NOT NULL,
    concluida               boolean NOT NULL,
    resultado               varchar(10) CHECK (resultado IN ('COMPLETA', 'PARCIAL')),
    duracao_segundos        integer CHECK (duracao_segundos IS NULL OR duracao_segundos BETWEEN 60 AND 21600),
    comentario              varchar(300),
    situacao                varchar(10) NOT NULL DEFAULT 'ACEITO' CHECK (situacao IN ('ACEITO', 'RECUSADO')),
    motivo                  varchar(200),
    alterado_no_aparelho_em timestamptz NOT NULL,
    criado_em               timestamptz NOT NULL DEFAULT now(),
    atualizado_em           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sessao_concluida_chave_key UNIQUE (aluno_id, plano_versao_id, sessao_uid, data),
    -- Concluída tem resultado; reaberta não tem resultado nem duração.
    CONSTRAINT sessao_concluida_resultado_coerente CHECK (
        (concluida AND resultado IS NOT NULL) OR (NOT concluida AND resultado IS NULL AND duracao_segundos IS NULL))
);

CREATE INDEX ix_sessconc_aluno_data ON sessao_concluida (aluno_id, data DESC);
