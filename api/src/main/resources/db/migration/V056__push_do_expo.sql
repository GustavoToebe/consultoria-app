-- Push do Expo para compromisso marcado, remarcado ou cancelado (docs/planos/push-do-expo.md). Desligado por padrão
-- (TREINOS_PUSH_HABILITADO). O número é V056 de propósito: outra branch também quer a V055; na hora do merge renumera-se. Sem
-- compatibilidade: ainda não há cliente real.

-- 1. Token de push do aparelho do aluno (ExponentPushToken[...]). Dado do aparelho: nunca em log, auditoria, mensagem de erro
--    nem exportação (a exportação mostra só plataforma e data). Até 5 por usuário (a API troca o mais antigo). O mesmo token
--    num usuário só por consultoria (a API tira do anterior ao registrar de novo). Sai com o usuário, no logout do app e
--    quando as sessões dele são encerradas.
CREATE TABLE push_token (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    usuario_id     uuid NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    token          varchar(200) NOT NULL,
    plataforma     varchar(7) NOT NULL CONSTRAINT ck_push_token_plataforma CHECK (plataforma IN ('ANDROID', 'IOS')),
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_push_token UNIQUE (consultoria_id, usuario_id, token)
);
CREATE INDEX ix_push_token_token ON push_token (consultoria_id, token);

-- 2. Fila dos envios. Uma linha = "avise este usuário que um compromisso mudou". NÃO guarda texto, nome, compromisso nem token
--    (o token é lido na hora do envio): só o usuário e o andamento. No máximo um PENDENTE por usuário: várias mudanças seguidas
--    viram uma notificação só. reservado_por/reserva_ate são o lease de quem envia, para o HTTP rodar fora da transação.
CREATE TABLE push_envio (
    id                uuid PRIMARY KEY,
    consultoria_id    uuid NOT NULL REFERENCES consultoria (id),
    usuario_id        uuid NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
    situacao          varchar(10) NOT NULL DEFAULT 'PENDENTE' CONSTRAINT ck_push_envio_situacao
        CHECK (situacao IN ('PENDENTE', 'ENVIADO', 'FALHOU', 'CANCELADO')),
    motivo            varchar(30),
    tentativas        integer NOT NULL DEFAULT 0 CONSTRAINT ck_push_envio_tentativas CHECK (tentativas BETWEEN 0 AND 10),
    erro              varchar(80),
    proxima_tentativa timestamptz NOT NULL DEFAULT now(),
    reservado_por     uuid,
    reserva_ate       timestamptz,
    enviado_em        timestamptz,
    criado_em         timestamptz NOT NULL DEFAULT now(),
    atualizado_em     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_push_envio_reserva CHECK ((reservado_por IS NULL) = (reserva_ate IS NULL))
);
CREATE UNIQUE INDEX ux_push_envio_pendente ON push_envio (consultoria_id, usuario_id) WHERE situacao = 'PENDENTE';
CREATE INDEX ix_push_envio_fila ON push_envio (proxima_tentativa) WHERE situacao = 'PENDENTE';
