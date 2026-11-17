-- Financeiro, fase 1 (docs/planos/financeiro-em-fases.md): cobrança avulsa (sem contratação), link de pagamento próprio no plano
-- comercial e a escolha das formas de recebimento da consultoria. Sem compatibilidade com o antigo (ainda não há cliente real).

-- 1. Cobrança avulsa: tipo novo, descrição própria e, só nela, sem contratação nem competência. As únicas colunas de
--    cobranca_aluno que dependem da contratação são contratacao_id e competencia (o resto, link, baixa e valor, é da cobrança).
--    A FK composta fk_cobranca_contratacao (consultoria, contratacao, aluno) não é conferida com contratacao_id nulo (MATCH SIMPLE),
--    então o aluno da avulsa ganha a sua FK direta, também composta com a consultoria (outra consultoria não entra).
--    Os índices parciais ux_cobranca_competencia (só MENSALIDADE) e ux_cobranca_saida_viva não mudam.
ALTER TABLE cobranca_aluno DROP CONSTRAINT ck_cobranca_tipo;
ALTER TABLE cobranca_aluno
    ADD CONSTRAINT ck_cobranca_tipo CHECK (tipo IN ('MENSALIDADE', 'SAIDA', 'AVULSA'));
-- 120 do treinador + " (Parcela 12/12)".
ALTER TABLE cobranca_aluno ADD COLUMN descricao varchar(150);
ALTER TABLE cobranca_aluno
    ALTER COLUMN contratacao_id DROP NOT NULL,
    ALTER COLUMN competencia DROP NOT NULL;
ALTER TABLE cobranca_aluno
    ADD CONSTRAINT ck_cobranca_contratacao_so_avulsa CHECK (
        (tipo = 'AVULSA' AND contratacao_id IS NULL AND competencia IS NULL)
        OR (tipo <> 'AVULSA' AND contratacao_id IS NOT NULL AND competencia IS NOT NULL)),
    ADD CONSTRAINT ck_cobranca_descricao_so_avulsa CHECK (
        (tipo = 'AVULSA' AND descricao IS NOT NULL AND btrim(descricao) <> '')
        OR (tipo <> 'AVULSA' AND descricao IS NULL)),
    ADD CONSTRAINT fk_cobranca_aluno FOREIGN KEY (consultoria_id, aluno_id) REFERENCES aluno (consultoria_id, id);

-- 2. Link de pagamento próprio do plano (qualquer plataforma; https conferido pela API).
ALTER TABLE plano_comercial ADD COLUMN link_de_pagamento varchar(500);

-- 3. Formas de recebimento: uma linha por consultoria, criada na primeira gravação. Sem linha vale o padrão de antes (InfinitePay
--    ligada, Manual ligado, link próprio e Pix desligados). O Manual não tem coluna: está sempre ligado. A chave Pix fica em claro
--    (vai dentro de todo código copia e cola), mas é dado pessoal: nunca em log, auditoria, mensagem de erro nem toString.
CREATE TABLE forma_de_recebimento (
    consultoria_id     uuid PRIMARY KEY REFERENCES consultoria (id),
    infinite_pay       boolean NOT NULL DEFAULT true,
    link_proprio       boolean NOT NULL DEFAULT false,
    pix                boolean NOT NULL DEFAULT false,
    pix_tipo_chave     varchar(10) CONSTRAINT ck_forma_pix_tipo_chave CHECK (pix_tipo_chave IN ('CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA')),
    pix_chave          varchar(77),
    pix_nome_recebedor varchar(25),
    pix_cidade         varchar(15),
    versao             bigint NOT NULL DEFAULT 0,
    criado_em          timestamptz NOT NULL DEFAULT now(),
    atualizado_em      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_forma_pix_completo CHECK (NOT pix OR (pix_tipo_chave IS NOT NULL AND pix_chave IS NOT NULL
        AND pix_nome_recebedor IS NOT NULL AND pix_cidade IS NOT NULL))
);
