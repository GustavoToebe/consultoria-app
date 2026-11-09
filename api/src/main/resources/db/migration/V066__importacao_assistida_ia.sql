-- Importação assistida por IA (lote misto PDF, DOCX, XLSX, CSV e texto livre).
-- Tabelas isoladas por consultoria (multi-tenant) com expiração automática e dicionário de abreviações.

CREATE TABLE importacao_sessao (
    id             UUID PRIMARY KEY,
    consultoria_id UUID NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    criado_por     UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    objetivo       VARCHAR(40) NOT NULL DEFAULT 'CADASTROS_E_PLANOS_ATUAIS',
    estado         VARCHAR(32) NOT NULL DEFAULT 'RECEBENDO',
    revisao        INT NOT NULL DEFAULT 1,
    progresso_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    grupos_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
    duvidas_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
    respostas_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE TABLE importacao_arquivo (
    id             UUID PRIMARY KEY,
    sessao_id      UUID NOT NULL REFERENCES importacao_sessao(id) ON DELETE CASCADE,
    consultoria_id UUID NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    nome_original  VARCHAR(255) NOT NULL,
    formato        VARCHAR(24) NOT NULL,
    hash_sha256    VARCHAR(64) NOT NULL,
    tamanho_bytes  BIGINT NOT NULL,
    estado         VARCHAR(32) NOT NULL DEFAULT 'RECEBIDO',
    conteudo_bytes BYTEA,
    extracao_json  JSONB,
    erro_codigo    VARCHAR(64),
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE importacao_apelido_consultoria (
    id                UUID PRIMARY KEY,
    consultoria_id    UUID NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    tipo              VARCHAR(24) NOT NULL,
    termo_normalizado VARCHAR(160) NOT NULL,
    termo_original    VARCHAR(160) NOT NULL,
    referencia_id     UUID,
    valor_mapeado     VARCHAR(160) NOT NULL,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_importacao_apelido UNIQUE (consultoria_id, tipo, termo_normalizado)
);

CREATE INDEX idx_importacao_sessao_consultoria ON importacao_sessao(consultoria_id);
CREATE INDEX idx_importacao_sessao_expira ON importacao_sessao(expira_em);
CREATE INDEX idx_importacao_arquivo_sessao ON importacao_arquivo(sessao_id);
CREATE INDEX idx_importacao_arquivo_consultoria ON importacao_arquivo(consultoria_id);
CREATE INDEX idx_importacao_apelido_consultoria ON importacao_apelido_consultoria(consultoria_id);
