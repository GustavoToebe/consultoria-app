-- Contrato digital do aluno (docs/planos/contrato-digital.md, passo 1): o esquema inteiro da frente, para os passos seguintes (PDF próprio,
-- link do responsável, trava por prazo) não precisarem de migration. Desligado por padrão (TREINOS_CONTRATOS_HABILITADO). Sem
-- compatibilidade e sem preenchimento retroativo: ainda não há cliente real e a função não cria contrato sozinha (D7).
-- As permissões CONTRATO_LER e CONTRATO_ALTERAR são só do catálogo (CatalogoPermissoes): o Administrador tem acesso total e nenhum
-- perfil padrão as ganha (D17), como o WhatsApp.

-- 1. Prazo para assinar (D6): dias de 1 a 60; nulo = não trava o acesso, só deixa o contrato pendente. Coluna nova e nula: o CHECK não
--    varre nada.
ALTER TABLE consultoria
    ADD COLUMN contrato_prazo_dias smallint CONSTRAINT ck_consultoria_contrato_prazo CHECK (contrato_prazo_dias BETWEEN 1 AND 60);

-- 2. Modelos de contrato da consultoria (D4a): o texto com campos entre chaves ({aluno_nome}...), conferido pelo serviço contra a lista
--    fechada da D9. Nunca se apaga, só se arquiva (um contrato gerado guarda o texto já preenchido e a referência ao modelo).
CREATE TABLE contrato_modelo (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    nome           varchar(80) NOT NULL CONSTRAINT ck_contrato_modelo_nome CHECK (btrim(nome) <> ''),
    texto          text NOT NULL CONSTRAINT ck_contrato_modelo_texto CHECK (char_length(texto) BETWEEN 1 AND 50000),
    arquivado_em   timestamptz,
    versao         bigint NOT NULL DEFAULT 0,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now(),
    -- Alvo da FK composta do contrato.
    CONSTRAINT ux_contrato_modelo_consultoria_id UNIQUE (consultoria_id, id)
);
-- Nome único entre os ativos (sem diferença de caixa); arquivar libera o nome.
CREATE UNIQUE INDEX ux_contrato_modelo_nome ON contrato_modelo (consultoria_id, lower(nome)) WHERE arquivado_em IS NULL;

-- 3. O contrato do aluno (D1, D2, D4, D5, D6, D10, D14, D15, D22, D23). Texto, CPF, IP e nome do assinante são dado pessoal: nunca em log,
--    auditoria nem mensagem de erro. O assinado é imutável e sobrevive à anonimização (D16, pendente do jurídico); o pendente e o
--    cancelado saem dela.
CREATE TABLE contrato_aluno (
    id                      uuid PRIMARY KEY,
    consultoria_id          uuid NOT NULL REFERENCES consultoria (id),
    aluno_id                uuid NOT NULL,
    -- Nulo no PDF solto e no contrato sem plano; quando preenchida, a FK composta garante que a contratação é do mesmo aluno.
    contratacao_id          uuid,
    origem                  varchar(6) NOT NULL CONSTRAINT ck_contrato_origem CHECK (origem IN ('MODELO', 'PDF')),
    modelo_id               uuid,
    titulo                  varchar(120) NOT NULL CONSTRAINT ck_contrato_titulo CHECK (btrim(titulo) <> ''),
    -- O texto já preenchido (NFC, quebras \n), exatamente o que o sha256 cobre no MODELO (D22); nulo no PDF.
    texto                   text,
    sha256                  char(64) NOT NULL CONSTRAINT ck_contrato_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    signatario              varchar(11) NOT NULL CONSTRAINT ck_contrato_signatario CHECK (signatario IN ('ALUNO', 'RESPONSAVEL')),
    situacao                varchar(9) NOT NULL DEFAULT 'PENDENTE'
        CONSTRAINT ck_contrato_situacao CHECK (situacao IN ('PENDENTE', 'ASSINADO', 'CANCELADO')),
    -- Fim do prazo (fim do dia de Brasília); nulo = não trava (D6). "Gerar" é o envio e começa o prazo em gerado_em (D23).
    prazo_ate               timestamptz,
    gerado_por              uuid,
    gerado_em               timestamptz NOT NULL DEFAULT now(),
    cancelado_em            timestamptz,
    motivo_cancelamento     varchar(300),
    -- Idempotência do gerar (como o pedido da cobrança avulsa).
    pedido_id               uuid NOT NULL,
    -- Evidências da assinatura (D2). Usuário só quando o aluno assina logado; CPF só quando o responsável assina pelo link.
    assinado_em             timestamptz,
    assinado_por_usuario_id uuid,
    assinante_nome          varchar(200),
    assinante_cpf           varchar(14),
    assinante_ip            varchar(45),
    assinante_agente        varchar(300),
    -- Link do responsável (D11): só o hash do código fica no banco.
    link_hash               char(64),
    link_expira_em          timestamptz,
    versao                  bigint NOT NULL DEFAULT 0,
    criado_em               timestamptz NOT NULL DEFAULT now(),
    atualizado_em           timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_contrato_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id), -- sem cascata: o assinado é prova e não some com o aluno (D15, D16)
    CONSTRAINT fk_contrato_contratacao FOREIGN KEY (consultoria_id, contratacao_id, aluno_id)
        REFERENCES contratacao_aluno (consultoria_id, id, aluno_id),
    CONSTRAINT fk_contrato_modelo FOREIGN KEY (consultoria_id, modelo_id)
        REFERENCES contrato_modelo (consultoria_id, id) ON DELETE SET NULL (modelo_id),
    CONSTRAINT fk_contrato_gerado_por FOREIGN KEY (consultoria_id, gerado_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE SET NULL (gerado_por),
    -- Sem ON DELETE: a conta que assinou é evidência e não some com o usuário.
    CONSTRAINT fk_contrato_assinado_por FOREIGN KEY (consultoria_id, assinado_por_usuario_id)
        REFERENCES usuario (consultoria_id, id),
    CONSTRAINT ux_contrato_consultoria_id UNIQUE (consultoria_id, id),
    CONSTRAINT ux_contrato_pedido UNIQUE (consultoria_id, pedido_id),

    -- Texto só no MODELO; o PDF não tem texto nem modelo (os bytes ficam em contrato_arquivo).
    CONSTRAINT ck_contrato_texto_so_no_modelo CHECK (
        (origem = 'MODELO' AND texto IS NOT NULL AND char_length(texto) BETWEEN 1 AND 100000)
        OR (origem = 'PDF' AND texto IS NULL AND modelo_id IS NULL)),
    -- Assinado = todas as evidências; as outras situações não têm nenhuma. O responsável traz o CPF, o aluno traz a conta.
    CONSTRAINT ck_contrato_assinado CHECK (
        (situacao = 'ASSINADO'
            AND assinado_em IS NOT NULL AND assinante_nome IS NOT NULL AND assinante_ip IS NOT NULL AND assinante_agente IS NOT NULL
            AND ((signatario = 'ALUNO' AND assinado_por_usuario_id IS NOT NULL AND assinante_cpf IS NULL)
                OR (signatario = 'RESPONSAVEL' AND assinado_por_usuario_id IS NULL AND assinante_cpf IS NOT NULL)))
        OR (situacao <> 'ASSINADO'
            AND assinado_em IS NULL AND assinado_por_usuario_id IS NULL AND assinante_nome IS NULL AND assinante_cpf IS NULL
            AND assinante_ip IS NULL AND assinante_agente IS NULL)),
    -- Só o PENDENTE se cancela, com motivo (D15).
    CONSTRAINT ck_contrato_cancelado CHECK (
        (situacao = 'CANCELADO' AND cancelado_em IS NOT NULL AND motivo_cancelamento IS NOT NULL)
        OR (situacao <> 'CANCELADO' AND cancelado_em IS NULL AND motivo_cancelamento IS NULL)),
    -- Link só no contrato do responsável, hash e validade juntos.
    CONSTRAINT ck_contrato_link CHECK (
        (link_hash IS NULL AND link_expira_em IS NULL)
        OR (signatario = 'RESPONSAVEL' AND link_hash IS NOT NULL AND link_expira_em IS NOT NULL AND link_hash ~ '^[0-9a-f]{64}$'))
);
-- A trava por prazo (D5) lê só os pendentes do aluno.
CREATE INDEX ix_contrato_pendente ON contrato_aluno (consultoria_id, aluno_id) WHERE situacao = 'PENDENTE';
CREATE INDEX ix_contrato_aluno ON contrato_aluno (consultoria_id, aluno_id, gerado_em DESC);
-- A página pública acha o contrato pelo hash do código, antes de saber a consultoria.
CREATE UNIQUE INDEX ux_contrato_link_hash ON contrato_aluno (link_hash) WHERE link_hash IS NOT NULL;

-- 4. O PDF próprio (D14): os bytes, 1:1 com o contrato de origem PDF, no banco como a logo. Até 900 KB (o corpo da API tem 1 MiB).
CREATE TABLE contrato_arquivo (
    contrato_id    uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    bytes          bytea NOT NULL CONSTRAINT ck_contrato_arquivo_bytes CHECK (octet_length(bytes) BETWEEN 5 AND 921600),
    criado_em      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_contrato_arquivo_contrato FOREIGN KEY (consultoria_id, contrato_id)
        REFERENCES contrato_aluno (consultoria_id, id) ON DELETE CASCADE
);
