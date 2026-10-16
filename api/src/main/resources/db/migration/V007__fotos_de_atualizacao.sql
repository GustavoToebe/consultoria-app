-- Fotos da atualização do aluno (dado sensível, LGPD). O arquivo fica no bucket privado do R2; aqui ficam só os metadados.
-- O nome do objeto no bucket é o próprio id da foto (UUID): nenhum nome, e-mail ou id de pessoa vai para o bucket.
CREATE TABLE atualizacao_foto (
    id              uuid PRIMARY KEY,
    consultoria_id  uuid NOT NULL REFERENCES consultoria (id),
    aluno_id        uuid NOT NULL REFERENCES aluno (id),
    pasta_id        uuid NOT NULL REFERENCES pasta_plano (id),
    -- Nulo = pendente: a foto subiu, mas o envio da atualização ainda não a ligou à resposta.
    atualizacao_id  uuid REFERENCES atualizacao (id),
    pergunta_id     varchar(40),
    tamanho         integer NOT NULL CHECK (tamanho > 0),
    criada_em       timestamptz NOT NULL DEFAULT now(),
    ligada_em       timestamptz,
    -- Removida = o objeto está na fila de remoção do bucket. A linha fica uns dias para o limite diário contar quem sobe e apaga.
    removida_em     timestamptz,
    CONSTRAINT ck_foto_ligada CHECK ((atualizacao_id IS NULL) = (pergunta_id IS NULL))
);

CREATE INDEX ix_foto_aluno_dia ON atualizacao_foto (consultoria_id, aluno_id, criada_em);
CREATE INDEX ix_foto_atualizacao ON atualizacao_foto (atualizacao_id) WHERE atualizacao_id IS NOT NULL;
CREATE INDEX ix_foto_pendente ON atualizacao_foto (criada_em) WHERE atualizacao_id IS NULL AND removida_em IS NULL;
CREATE INDEX ix_foto_removida ON atualizacao_foto (removida_em) WHERE removida_em IS NOT NULL;

-- Fila durável de remoção no bucket. Apagar no R2 é HTTP e fica fora das transações do app: a transação só enfileira, e o job
-- tenta de novo com espera crescente até conseguir. Sem consultoria nem aluno: só o UUID do objeto.
CREATE TABLE foto_remocao (
    objeto            uuid PRIMARY KEY,
    tentativas        integer NOT NULL DEFAULT 0,
    proxima_tentativa timestamptz NOT NULL DEFAULT now(),
    criada_em         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_foto_remocao_proxima ON foto_remocao (proxima_tentativa);
