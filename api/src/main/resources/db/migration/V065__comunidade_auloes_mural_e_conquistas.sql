-- V065: Comunidade, Aulões, Mural do Time e Conquistas Permanentes (C81 / N45)

CREATE TABLE IF NOT EXISTS comunidade_aula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id UUID NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    titulo VARCHAR(120) NOT NULL,
    descricao TEXT,
    video_url VARCHAR(500) NOT NULL,
    miniatura_url VARCHAR(500),
    categoria VARCHAR(60),
    ordem INT NOT NULL DEFAULT 0,
    publicada BOOLEAN NOT NULL DEFAULT TRUE,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunidade_aula_consultoria_ordem
    ON comunidade_aula (consultoria_id, ordem, criada_em);

CREATE TABLE IF NOT EXISTS comunidade_aula_comentario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id UUID NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    aula_id UUID NOT NULL REFERENCES comunidade_aula(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES usuario(id),
    autor_nome VARCHAR(120) NOT NULL,
    autor_foto_url VARCHAR(500),
    texto VARCHAR(2000) NOT NULL,
    oculto BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunidade_aula_comentario_aula
    ON comunidade_aula_comentario (aula_id, criado_em);

CREATE TABLE IF NOT EXISTS comunidade_mural_post (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id UUID NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES usuario(id),
    autor_nome VARCHAR(120) NOT NULL,
    autor_foto_url VARCHAR(500),
    texto VARCHAR(2000) NOT NULL,
    imagem_url VARCHAR(500),
    fixado BOOLEAN NOT NULL DEFAULT FALSE,
    oculto BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunidade_mural_post_consultoria
    ON comunidade_mural_post (consultoria_id, fixado DESC, criado_em DESC);

CREATE TABLE IF NOT EXISTS comunidade_mural_reacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id UUID NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES comunidade_mural_post(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuario(id),
    emoji VARCHAR(16) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_mural_reacao_usuario UNIQUE (post_id, usuario_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_comunidade_mural_reacao_post
    ON comunidade_mural_reacao (post_id);

CREATE TABLE IF NOT EXISTS comunidade_mural_comentario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id UUID NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES comunidade_mural_post(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES usuario(id),
    autor_nome VARCHAR(120) NOT NULL,
    autor_foto_url VARCHAR(500),
    texto VARCHAR(2000) NOT NULL,
    oculto BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunidade_mural_comentario_post
    ON comunidade_mural_comentario (post_id, criado_em);

CREATE TABLE IF NOT EXISTS conquista_aluno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id UUID NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES aluno(id) ON DELETE CASCADE,
    tipo VARCHAR(60) NOT NULL,
    titulo VARCHAR(120) NOT NULL,
    descricao VARCHAR(300) NOT NULL,
    icone VARCHAR(60) NOT NULL,
    conquistada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uk_conquista_aluno_tipo UNIQUE (aluno_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_conquista_aluno_aluno
    ON conquista_aluno (aluno_id, conquistada_em DESC);

ALTER TABLE aluno ADD COLUMN IF NOT EXISTS participa_ranking_forca BOOLEAN NOT NULL DEFAULT FALSE;
