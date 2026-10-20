-- Registro "feito" da mobilidade do aluno (item 27). Um registro por item, dia e versão publicada que o aluno via; o id nasce no
-- aparelho (UUID), então reenviar não duplica. Desmarcar é o mesmo registro com feito = false (o último a chegar vale, pelo
-- horário do aparelho, como nas séries). Sem texto livre nem tempo: só feito ou não feito, e por isso a anonimização mantém.
-- situacao RECUSADO só guarda o item que não existe na versão (permanente, a versão é imutável); as demais recusas só saem
-- na resposta, para nunca sobrescrever um registro aceito.
CREATE TABLE mobilidade_registro (
    id                      uuid PRIMARY KEY,
    consultoria_id          uuid NOT NULL REFERENCES consultoria (id),
    aluno_id                uuid NOT NULL REFERENCES aluno (id),
    plano_versao_id         uuid NOT NULL REFERENCES plano_mobilidade_versao (id),
    secao_uid               uuid NOT NULL,
    item_uid                uuid NOT NULL,
    data                    date NOT NULL,
    feito                   boolean NOT NULL,
    situacao                varchar(10) NOT NULL DEFAULT 'ACEITO' CHECK (situacao IN ('ACEITO', 'RECUSADO')),
    motivo                  varchar(200),
    alterado_no_aparelho_em timestamptz NOT NULL,
    criado_em               timestamptz NOT NULL DEFAULT now(),
    atualizado_em           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mobilidade_registro_chave_key UNIQUE (aluno_id, plano_versao_id, item_uid, data)
);

CREATE INDEX ix_mobreg_aluno_data ON mobilidade_registro (consultoria_id, aluno_id, data DESC);
