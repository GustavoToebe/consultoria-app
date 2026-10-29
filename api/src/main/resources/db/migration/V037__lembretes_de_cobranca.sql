-- Lembretes de cobrança por e-mail (28/10): o treinador liga, por consultoria, lembretes automáticos para o aluno antes do
-- vencimento, no dia e depois. Só e-mail, pelo envio do módulo de autenticação; sem ele nada é planejado. Pagamento atrasado
-- continua sem bloquear nada do aluno: o lembrete só informa. Sem compatibilidade: ainda não há cliente real.

-- 1. Configuração, uma por consultoria (sem linha = desligada, com os padrões abaixo). 0 dias = aquele lembrete não sai.
CREATE TABLE lembrete_configuracao (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    ligado         boolean NOT NULL DEFAULT false,
    dias_antes     integer NOT NULL DEFAULT 3 CONSTRAINT ck_lembrete_dias_antes CHECK (dias_antes BETWEEN 0 AND 15),
    no_dia         boolean NOT NULL DEFAULT true,
    dias_depois    integer NOT NULL DEFAULT 3 CONSTRAINT ck_lembrete_dias_depois CHECK (dias_depois BETWEEN 0 AND 30),
    versao         bigint NOT NULL DEFAULT 0,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_lembrete_configuracao_consultoria UNIQUE (consultoria_id)
);

-- 2. Cada lembrete planejado: no máximo um por (cobrança, tipo), e é a chave única que impede o envio em dobro. A linha
--    NÃO guarda o endereço, o nome, o valor nem o texto do e-mail: só o tipo, a situação, as datas e, na falha, a classe do
--    erro (nunca a mensagem, que pode repetir o endereço). PENDENTE vira ENVIADO, FALHOU (depois de 3 tentativas) ou
--    CANCELADO ("motivo" diz por quê: cobrança que deixou de estar aberta, configuração desligada, aluno sem e-mail...).
--    reservado_por/reserva_ate são o lease de quem envia, para o envio rodar fora da transação.
CREATE TABLE lembrete_cobranca (
    id                uuid PRIMARY KEY,
    consultoria_id    uuid NOT NULL REFERENCES consultoria (id),
    cobranca_id       uuid NOT NULL,
    tipo              varchar(7) NOT NULL CONSTRAINT ck_lembrete_tipo CHECK (tipo IN ('ANTES', 'NO_DIA', 'DEPOIS')),
    data_prevista     date NOT NULL,
    situacao          varchar(10) NOT NULL DEFAULT 'PENDENTE' CONSTRAINT ck_lembrete_situacao
        CHECK (situacao IN ('PENDENTE', 'ENVIADO', 'FALHOU', 'CANCELADO')),
    motivo            varchar(30),
    tentativas        integer NOT NULL DEFAULT 0 CONSTRAINT ck_lembrete_tentativas CHECK (tentativas BETWEEN 0 AND 10),
    erro              varchar(80),
    proxima_tentativa timestamptz NOT NULL DEFAULT now(),
    reservado_por     uuid,
    reserva_ate       timestamptz,
    enviado_em        timestamptz,
    criado_em         timestamptz NOT NULL DEFAULT now(),
    atualizado_em     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_lembrete_cobranca_tipo UNIQUE (consultoria_id, cobranca_id, tipo),
    CONSTRAINT ck_lembrete_reserva CHECK ((reservado_por IS NULL) = (reserva_ate IS NULL)),
    CONSTRAINT fk_lembrete_cobranca FOREIGN KEY (consultoria_id, cobranca_id)
        REFERENCES cobranca_aluno (consultoria_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_lembrete_fila ON lembrete_cobranca (proxima_tentativa) WHERE situacao = 'PENDENTE';
CREATE INDEX ix_lembrete_cobranca ON lembrete_cobranca (consultoria_id, cobranca_id);
