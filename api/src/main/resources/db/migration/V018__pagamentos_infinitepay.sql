-- Pagamentos, Fase 2 (InfinitePay, 20/10): o aluno paga por um link da InfinitePay na conta do próprio treinador, e a baixa só
-- acontece depois de consultar a InfinitePay. Sem compatibilidade: ainda não há cliente real. Dinheiro é sempre bigint em
-- centavos, maior que zero. O módulo continua desligado (TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO).

-- 1. Credencial do recebimento online, uma por (consultoria, provedor). "conta" é a InfiniteTag (sem o $); a API Key é
--    opcional e só existe cifrada (formato v1:<chave>:<nonce>:<texto>, AES-GCM com a consultoria no dado autenticado), nunca
--    em claro. "juros_parcelamento" diz quem paga os juros do parcelamento no cartão (ALUNO, o padrão, ou TREINADOR, que só vale
--    com API Key: sem ela a opção não vai ao provedor). "token_aviso" é aleatório (32 bytes em base64 url-safe) e vai no caminho do webhook: é com ele que a API
--    descobre a consultoria sem sessão, por isso é único em todo o banco.
CREATE TABLE credencial_pagamento (
    id              uuid PRIMARY KEY,
    consultoria_id  uuid NOT NULL REFERENCES consultoria (id),
    provedor        varchar(30) NOT NULL CONSTRAINT ck_credencial_provedor CHECK (provedor ~ '^[A-Z0-9_]{1,30}$'),
    conta           varchar(60) NOT NULL CONSTRAINT ck_credencial_conta CHECK (btrim(conta) <> ''),
    segredo_cifrado text,
    juros_parcelamento varchar(10) NOT NULL DEFAULT 'ALUNO' CONSTRAINT ck_credencial_juros
        CHECK (juros_parcelamento IN ('ALUNO', 'TREINADOR')),
    token_aviso     varchar(64) NOT NULL,
    versao          bigint NOT NULL DEFAULT 0,
    criado_em       timestamptz NOT NULL DEFAULT now(),
    atualizado_em   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_credencial_consultoria_provedor UNIQUE (consultoria_id, provedor),
    CONSTRAINT ux_credencial_token_aviso UNIQUE (token_aviso)
);

-- 2. Chave para a FK composta (consultoria_id, cobranca_id) do aviso: a cobrança de uma consultoria nunca é ligada a aviso de
--    outra.
ALTER TABLE cobranca_aluno ADD CONSTRAINT cobranca_aluno_consultoria_id_id_key UNIQUE (consultoria_id, id);

-- 3. Link de pagamento da cobrança (gerado na InfinitePay): a URL e o slug são do pagador, saem na anonimização do aluno
--    (PagamentosDoAluno). O valor do link é conferido contra o da cobrança antes de qualquer baixa. "link_valido_ate" é o
--    instante em que o link vence no provedor (nulo = não vence, o link sem API Key); o link só é reaproveitado antes dele.
ALTER TABLE cobranca_aluno
    ADD COLUMN link_url            varchar(500),
    ADD COLUMN link_slug           varchar(100),
    ADD COLUMN link_valor_centavos bigint CONSTRAINT ck_cobranca_link_valor CHECK (link_valor_centavos > 0),
    ADD COLUMN link_gerado_em      timestamptz,
    ADD COLUMN link_valido_ate     timestamptz;

-- 4. Caixa de entrada dos avisos (webhook) do provedor, no molde da Central. O aviso é só um gatilho de "consulte de novo":
--    guarda os identificadores e o hash do corpo, NUNCA o corpo (pode trazer dado de cartão ou do pagador). "referencia" é o
--    order_nsu (o id da cobrança) e "transacao" o transaction_nsu do provedor; repetir o mesmo aviso rearma a consulta
--    (revisao + 1, PENDENTE). A reserva (reservado_por/reserva_ate) é o lease de quem consulta, para o HTTP rodar fora da
--    transação. PENDENTE vira APLICADO (baixa feita), IGNORADO (nunca confirmou), CONFERIR (confirmou, mas não se aplica
--    sozinho; "motivo" diz por quê) e CONFERIDO (o treinador resolveu). Nunca dá baixa sozinho em CONFERIR. Do pagamento
--    confirmado guarda só informação: "forma_capturada" (capture_method como veio, limpo), "parcelas" e
--    "valor_bruto_pago_centavos" (paid_amount, que pode trazer juros repassados); o valor conferido é o "valor_pago_centavos"
--    (amount). Nada disso é taxa nem líquido.
CREATE TABLE aviso_de_pagamento (
    id                  uuid PRIMARY KEY,
    consultoria_id      uuid NOT NULL REFERENCES consultoria (id),
    provedor            varchar(30) NOT NULL CONSTRAINT ck_aviso_provedor CHECK (provedor ~ '^[A-Z0-9_]{1,30}$'),
    referencia          varchar(100) NOT NULL,
    transacao           varchar(100) NOT NULL,
    slug                varchar(100),
    hash_corpo          char(64) NOT NULL CONSTRAINT ck_aviso_hash CHECK (hash_corpo ~ '^[0-9a-f]{64}$'),
    recebido_em         timestamptz NOT NULL DEFAULT now(),
    revisao             integer NOT NULL DEFAULT 0,
    proxima_tentativa   timestamptz NOT NULL DEFAULT now(),
    tentativas          integer NOT NULL DEFAULT 0,
    reservado_por       uuid,
    reserva_ate         timestamptz,
    situacao            varchar(10) NOT NULL DEFAULT 'PENDENTE' CONSTRAINT ck_aviso_situacao
        CHECK (situacao IN ('PENDENTE', 'APLICADO', 'IGNORADO', 'CONFERIR', 'CONFERIDO')),
    motivo              varchar(40),
    valor_pago_centavos bigint CONSTRAINT ck_aviso_valor_pago CHECK (valor_pago_centavos > 0),
    forma_capturada     varchar(20),
    parcelas            integer CONSTRAINT ck_aviso_parcelas CHECK (parcelas > 0),
    valor_bruto_pago_centavos bigint CONSTRAINT ck_aviso_valor_bruto CHECK (valor_bruto_pago_centavos > 0),
    cobranca_id         uuid,
    conferido_por       uuid,
    conferido_em        timestamptz,
    CONSTRAINT ux_aviso_transacao UNIQUE (consultoria_id, provedor, transacao),
    CONSTRAINT ck_aviso_reserva CHECK ((reservado_por IS NULL) = (reserva_ate IS NULL)),
    CONSTRAINT fk_aviso_cobranca FOREIGN KEY (consultoria_id, cobranca_id)
        REFERENCES cobranca_aluno (consultoria_id, id),
    CONSTRAINT fk_aviso_conferido_por FOREIGN KEY (consultoria_id, conferido_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (conferido_por)
);
CREATE INDEX ix_aviso_fila ON aviso_de_pagamento (proxima_tentativa) WHERE situacao = 'PENDENTE';
CREATE INDEX ix_aviso_conferir ON aviso_de_pagamento (consultoria_id, recebido_em DESC) WHERE situacao = 'CONFERIR';
CREATE INDEX ix_aviso_cobranca ON aviso_de_pagamento (consultoria_id, cobranca_id);
CREATE INDEX ix_aviso_limpeza ON aviso_de_pagamento (recebido_em) WHERE situacao IN ('APLICADO', 'IGNORADO', 'CONFERIDO');

-- 5. O plano comercial perde as colunas da Fase 1 que nunca tiveram efeito (formas aceitas, parcelas e taxa do cartão): quem
--    recebe pela InfinitePay escolhe Pix ou cartão na hora de pagar. Os checks da coluna caem junto.
ALTER TABLE plano_comercial
    DROP COLUMN aceita_pix,
    DROP COLUMN aceita_boleto,
    DROP COLUMN aceita_cartao,
    DROP COLUMN aceita_manual,
    DROP COLUMN max_parcelas,
    DROP COLUMN taxa_cartao;
