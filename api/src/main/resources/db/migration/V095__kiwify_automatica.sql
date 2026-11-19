-- Kiwify automática (D16 a D20 de docs/planos/financeiro-em-fases.md, frente F7). A Kiwify cobra a assinatura do aluno todo mês e avisa
-- por webhook assinado; a API confere a venda na API da Kiwify e dá baixa na mensalidade. Sem compatibilidade com o antigo (ainda não há
-- cliente real). O módulo continua desligado (TREINOS_PAGAMENTOS_KIWIFY_HABILITADO).

-- 1. Credencial da Kiwify, uma por consultoria. Os quatro valores só existem cifrados (formato v1:<chave>:<nonce>:<texto>, a mesma AES-GCM
--    do recebimento online, com a consultoria no dado autenticado), nunca em claro. "token_caminho" é aleatório (32 bytes em base64
--    url-safe), vai no caminho do webhook público e nasce no primeiro cadastro (não muda nas alterações; é único em todo o banco porque
--    é com ele que a API descobre a consultoria sem sessão). Trocar o token do webhook guarda o anterior por 24 h
--    ("anterior_valido_ate"): a Kiwify pode reenviar com ele um aviso que falhou antes da troca.
CREATE TABLE credencial_kiwify (
    id                          uuid PRIMARY KEY,
    consultoria_id              uuid NOT NULL REFERENCES consultoria (id),
    token_webhook_cifrado       text NOT NULL,
    client_id_cifrado           text NOT NULL,
    client_secret_cifrado       text NOT NULL,
    account_id_cifrado          text NOT NULL,
    token_caminho               varchar(64) NOT NULL,
    token_webhook_anterior_cifrado text,
    anterior_valido_ate         timestamptz,
    versao                      bigint NOT NULL DEFAULT 0,
    criado_em                   timestamptz NOT NULL DEFAULT now(),
    atualizado_em               timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ux_credencial_kiwify_consultoria UNIQUE (consultoria_id),
    CONSTRAINT ux_credencial_kiwify_token_caminho UNIQUE (token_caminho),
    CONSTRAINT ck_credencial_kiwify_anterior CHECK ((token_webhook_anterior_cifrado IS NULL) = (anterior_valido_ate IS NULL))
);

-- 2. Plano comercial: "assinatura cobrada pela Kiwify" (só plano MENSAL) e o id do produto dela. O produto só existe com a assinatura
--    ligada e vale para um plano só (índice único parcial entre os não arquivados, por consultoria).
ALTER TABLE plano_comercial
    ADD COLUMN kiwify_assinatura boolean NOT NULL DEFAULT false,
    ADD COLUMN kiwify_produto_id varchar(100),
    ADD CONSTRAINT ck_plano_kiwify_produto CHECK (kiwify_produto_id IS NULL OR kiwify_assinatura),
    ADD CONSTRAINT ck_plano_kiwify_produto_formato CHECK (kiwify_produto_id IS NULL OR kiwify_produto_id ~ '^[A-Za-z0-9_-]{1,100}$'),
    ADD CONSTRAINT ck_plano_kiwify_so_mensal CHECK (NOT kiwify_assinatura OR periodicidade = 'MENSAL');
CREATE UNIQUE INDEX ux_plano_kiwify_produto ON plano_comercial (consultoria_id, kiwify_produto_id)
    WHERE arquivado_em IS NULL AND kiwify_produto_id IS NOT NULL;

-- 3. A baixa da Kiwify tem forma própria (KIWIFY). O provedor (cobranca_aluno e aviso_de_pagamento) é só um padrão de letras
--    maiúsculas (V017 e V018): KIWIFY já cabe e nada muda ali.
ALTER TABLE cobranca_aluno DROP CONSTRAINT ck_cobranca_forma;
ALTER TABLE cobranca_aluno ADD CONSTRAINT ck_cobranca_forma
    CHECK (forma IN ('DINHEIRO', 'PIX_DIRETO', 'TRANSFERENCIA', 'OUTRO', 'PIX', 'BOLETO', 'CARTAO', 'KIWIFY'));

-- 4. Caixa de entrada dos avisos: na Kiwify "referencia" é o order_id e "transacao" é order_id:evento (a idempotência é por pedido e
--    evento, o mesmo aviso repetido só rearma a consulta). Duas colunas novas, só identificadores: o tipo do evento
--    (webhook_event_type) e a assinatura (subscription_id). Nunca o corpo nem o e-mail do comprador.
ALTER TABLE aviso_de_pagamento
    ADD COLUMN evento_tipo   varchar(40),
    ADD COLUMN assinatura_id varchar(100);
