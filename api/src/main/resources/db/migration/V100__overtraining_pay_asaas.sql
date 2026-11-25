-- Overtraining Pay (Asaas): subconta por consultoria (onboarding/KYC e homologação), mapeamento de clientes do aluno,
-- flag em forma_de_recebimento, metadados da cobrança Asaas e configuração de split em direitos_locais.
-- Sem compatibilidade com legado. O módulo nasce desligado (TREINOS_PAGAMENTOS_ASAAS_HABILITADO=false).

-- 1. Subconta Asaas da consultoria (uma por consultoria). Credenciais e documento são cifrados com AES-256-GCM
--    (CifraDePagamento, com consultoria_id no AAD); apenas versões mascaradas ficam em claro para exibição.
CREATE TABLE subconta_asaas (
    id                              uuid PRIMARY KEY,
    consultoria_id                  uuid NOT NULL UNIQUE REFERENCES consultoria (id) ON DELETE CASCADE,
    asaas_conta_id                  varchar(60),
    wallet_id                       varchar(64),
    api_key_cifrada                 text,
    token_caminho                   varchar(64) NOT NULL UNIQUE,
    token_webhook_cifrado           text NOT NULL,
    token_webhook_anterior_cifrado  text,
    anterior_valido_ate             timestamptz,
    tipo_pessoa                     varchar(2) NOT NULL CONSTRAINT ck_subconta_asaas_tipo_pessoa
        CHECK (tipo_pessoa IN ('PF', 'PJ')),
    documento_cifrado               text NOT NULL,
    documento_mascarado             varchar(20) NOT NULL,
    nome_titular                    varchar(120) NOT NULL,
    email_financeiro                varchar(160) NOT NULL,
    telefone_mascarado              varchar(24),
    cep                             varchar(10),
    endereco_resumo                 varchar(200),
    renda_mensal_centavos           bigint,
    banco_codigo                    varchar(10) NOT NULL,
    banco_nome                      varchar(80) NOT NULL,
    agencia_mascarada               varchar(12) NOT NULL,
    conta_mascarada                 varchar(20) NOT NULL,
    tipo_conta                      varchar(20) NOT NULL CONSTRAINT ck_subconta_asaas_tipo_conta
        CHECK (tipo_conta IN ('CORRENTE', 'POUPANCA', 'PAGAMENTO')),
    repasse_automatico              boolean NOT NULL DEFAULT true,
    max_parcelas                    integer NOT NULL DEFAULT 12 CONSTRAINT ck_subconta_asaas_max_parcelas
        CHECK (max_parcelas BETWEEN 1 AND 12),
    juros_parcelamento              varchar(10) NOT NULL DEFAULT 'ALUNO' CONSTRAINT ck_subconta_asaas_juros
        CHECK (juros_parcelamento IN ('ALUNO', 'TREINADOR')),
    situacao                        varchar(25) NOT NULL DEFAULT 'NAO_CONFIGURADA' CONSTRAINT ck_subconta_asaas_situacao
        CHECK (situacao IN ('NAO_CONFIGURADA', 'DOCUMENTOS_PENDENTES', 'PRONTA_PARA_TESTE', 'ATIVA', 'REJEITADA')),
    onboarding_url                  varchar(500),
    cobranca_teste_id               varchar(60),
    cobranca_teste_situacao         varchar(20) CONSTRAINT ck_subconta_asaas_teste_situacao
        CHECK (cobranca_teste_situacao IS NULL OR cobranca_teste_situacao IN ('CRIADA', 'PAGA', 'HOMOLOGADA')),
    cobranca_teste_qr_base64        text,
    cobranca_teste_copia_cola       text,
    cobranca_teste_expira_em        timestamptz,
    homologada_em                   timestamptz,
    versao                          bigint NOT NULL DEFAULT 0,
    criado_em                       timestamptz NOT NULL DEFAULT now(),
    atualizado_em                   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_subconta_asaas_anterior CHECK ((token_webhook_anterior_cifrado IS NULL) = (anterior_valido_ate IS NULL))
);

-- 2. Mapeamento de aluno para customer_id na subconta Asaas da consultoria.
CREATE TABLE cliente_asaas_aluno (
    id                  uuid PRIMARY KEY,
    consultoria_id      uuid NOT NULL REFERENCES consultoria (id) ON DELETE CASCADE,
    aluno_id            uuid NOT NULL REFERENCES aluno (id) ON DELETE CASCADE,
    subconta_id         uuid NOT NULL REFERENCES subconta_asaas (id) ON DELETE CASCADE,
    asaas_customer_id   varchar(60) NOT NULL,
    criado_em           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_cliente_asaas_aluno UNIQUE (consultoria_id, aluno_id, subconta_id)
);

-- 3. Forma de recebimento: liga/desliga Overtraining Pay (só permitido quando a subconta estiver ATIVA).
ALTER TABLE forma_de_recebimento
    ADD COLUMN overtraining_pay boolean NOT NULL DEFAULT false;

-- 4. Cobrança do aluno: identificador no Asaas e valor líquido (em centavos) retornado na liquidação.
ALTER TABLE cobranca_aluno
    ADD COLUMN asaas_cobranca_id varchar(60),
    ADD COLUMN valor_liquido_centavos bigint CONSTRAINT ck_cobranca_valor_liquido
        CHECK (valor_liquido_centavos IS NULL OR valor_liquido_centavos >= 0);

-- 5. Direitos locais: modo de split da plataforma no Overtraining Pay.
ALTER TABLE direitos_locais
    ADD COLUMN split_modo varchar(22) NOT NULL DEFAULT 'ISENTO' CONSTRAINT ck_direitos_split_modo
        CHECK (split_modo IN ('ISENTO', 'TAXA_PLATAFORMA', 'TAXA_PERCENTUAL', 'ABATER_MENSALIDADE')),
    ADD COLUMN split_percentual_bps integer NOT NULL DEFAULT 0 CONSTRAINT ck_direitos_split_bps
        CHECK (split_percentual_bps BETWEEN 0 AND 10000),
    ADD COLUMN saldo_abater_centavos bigint NOT NULL DEFAULT 0 CONSTRAINT ck_direitos_saldo_abater
        CHECK (saldo_abater_centavos >= 0),
    ADD COLUMN meta_mensal_centavos bigint NOT NULL DEFAULT 0 CONSTRAINT ck_direitos_meta_mensal
        CHECK (meta_mensal_centavos >= 0),
    ADD COLUMN cobranca_central_id uuid;
