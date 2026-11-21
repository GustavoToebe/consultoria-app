-- Contato da consultoria, nível 2: avisos pelo WhatsApp oficial da Meta (docs/planos/contato-da-consultoria.md, C11 e C14 a C16).
-- Desligado por padrão (TREINOS_WHATSAPP_HABILITADO). Sem preenchimento retroativo e sem compatibilidade: ainda não há cliente real.
-- A permissão WHATSAPP_ALTERAR é só do catálogo (CatalogoPermissoes): o Administrador tem acesso total e nenhum perfil padrão a ganha.

-- A) Opt-in do aluno (C14): nulo = não recebe avisos pelo WhatsApp. Zerado na anonimização e em "Excluir minha conta".
ALTER TABLE aluno ADD COLUMN whatsapp_avisos_autorizado_em timestamptz;

-- B) Conexão da consultoria com a Cloud API da Meta (C11): uma por consultoria. O token de acesso fica cifrado (AES-GCM, chaves
-- fora do banco, consultoria como dado associado) e nunca volta em resposta, log nem auditoria; token_gravado_em é o que o app mostra.
CREATE TABLE whatsapp_conexao (
    id               uuid PRIMARY KEY,
    consultoria_id   uuid NOT NULL REFERENCES consultoria (id),
    provedor         varchar(10) NOT NULL DEFAULT 'META' CONSTRAINT ck_whatsapp_conexao_provedor CHECK (provedor IN ('META')),
    phone_number_id  varchar(40) NOT NULL,
    waba_id          varchar(40) NOT NULL,
    token_cifrado    text NOT NULL,
    token_gravado_em timestamptz NOT NULL DEFAULT now(),
    versao           bigint NOT NULL DEFAULT 0,
    criado_em        timestamptz NOT NULL DEFAULT now(),
    atualizado_em    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_whatsapp_conexao_consultoria UNIQUE (consultoria_id)
);

-- C) Modelo (template) da Meta que a consultoria cadastrou no gerenciador para cada tipo de aviso (C11): só o nome e o idioma.
-- A mensagem só sai por modelo, com as variáveis fixas do tipo; sem modelo do tipo, nada é enviado.
CREATE TABLE whatsapp_modelo (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    tipo           varchar(22) NOT NULL CONSTRAINT ck_whatsapp_modelo_tipo CHECK (tipo IN
        ('ANTES', 'NO_DIA', 'DEPOIS', 'COMPROMISSO_NOVO', 'COMPROMISSO_REMARCADO', 'COMPROMISSO_CANCELADO')),
    nome           varchar(512) NOT NULL,
    idioma         varchar(10) NOT NULL,
    versao         bigint NOT NULL DEFAULT 0,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_whatsapp_modelo_tipo UNIQUE (consultoria_id, tipo)
);

-- D) Fila e histórico dos envios (C15 e C16). Uma linha = "avise este aluno deste fato" (cobrança ou compromisso em referencia_id).
-- NÃO guarda texto, telefone nem nome (o telefone é lido na hora do envio). A chave única impede o aviso em dobro, também com duas
-- instâncias. reservado_por/reserva_ate são o lease de quem envia, para o HTTP rodar fora da transação. codigo_erro guarda só o
-- código da Meta ou a classe do erro; id_externo é o id da mensagem na Meta, pelo qual o webhook acha a linha.
CREATE TABLE whatsapp_envio (
    id                uuid PRIMARY KEY,
    consultoria_id    uuid NOT NULL,
    aluno_id          uuid NOT NULL,
    tipo              varchar(22) NOT NULL CONSTRAINT ck_whatsapp_envio_tipo CHECK (tipo IN
        ('ANTES', 'NO_DIA', 'DEPOIS', 'COMPROMISSO_NOVO', 'COMPROMISSO_REMARCADO', 'COMPROMISSO_CANCELADO')),
    referencia_id     uuid NOT NULL,
    situacao          varchar(10) NOT NULL DEFAULT 'PENDENTE' CONSTRAINT ck_whatsapp_envio_situacao
        CHECK (situacao IN ('PENDENTE', 'ENVIADO', 'ENTREGUE', 'LIDO', 'FALHOU', 'CANCELADO')),
    motivo            varchar(30),
    tentativas        integer NOT NULL DEFAULT 0 CONSTRAINT ck_whatsapp_envio_tentativas CHECK (tentativas BETWEEN 0 AND 10),
    proxima_tentativa timestamptz NOT NULL DEFAULT now(),
    reservado_por     uuid,
    reserva_ate       timestamptz,
    id_externo        varchar(120),
    codigo_erro       varchar(40),
    enviado_em        timestamptz,
    entregue_em       timestamptz,
    lido_em           timestamptz,
    criado_em         timestamptz NOT NULL DEFAULT now(),
    atualizado_em     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_whatsapp_envio_reserva CHECK ((reservado_por IS NULL) = (reserva_ate IS NULL)),
    CONSTRAINT fk_whatsapp_envio_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT ux_whatsapp_envio_referencia UNIQUE (consultoria_id, tipo, referencia_id, aluno_id)
);
CREATE INDEX ix_whatsapp_envio_fila ON whatsapp_envio (proxima_tentativa) WHERE situacao = 'PENDENTE';
CREATE INDEX ix_whatsapp_envio_aluno ON whatsapp_envio (consultoria_id, aluno_id);
-- O webhook acha a linha pelo id da mensagem na Meta (único no mundo).
CREATE UNIQUE INDEX ux_whatsapp_envio_id_externo ON whatsapp_envio (id_externo) WHERE id_externo IS NOT NULL;
