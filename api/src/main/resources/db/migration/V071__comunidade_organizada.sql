-- V071: comunidade organizada (plano docs/planos/comunidade-organizada-e-mapa.md, decisões C1 a C10).
-- Sem compatibilidade com o legado (ainda não há cliente): imagem_url do post sai (as fotos a substituem) e o texto_busca dos
-- posts que já existem fica vazio (o Postgres sem a extensão unaccent não o calcula; quem grava é a API, com Buscas.semAcento).

-- A) Tipo, vídeo e busca no post. ADD COLUMN com DEFAULT constante não reescreve a tabela.
ALTER TABLE comunidade_mural_post
    ADD COLUMN tipo varchar(20) NOT NULL DEFAULT 'CONVERSA',
    ADD COLUMN video_url varchar(500),
    ADD COLUMN texto_busca varchar(2000) NOT NULL DEFAULT '',
    DROP COLUMN imagem_url,
    ADD CONSTRAINT ck_comunidade_mural_post_tipo CHECK (tipo IN ('AVISO', 'VIDEO', 'DUVIDA', 'RESULTADO', 'CONVERSA'));

-- B) Comentário da equipe (C6): a API grava true quando o autor é da equipe; o que já existe na aula é preenchido pelo papel.
ALTER TABLE comunidade_aula_comentario ADD COLUMN da_equipe boolean NOT NULL DEFAULT false;
ALTER TABLE comunidade_mural_comentario ADD COLUMN da_equipe boolean NOT NULL DEFAULT false;
UPDATE comunidade_aula_comentario c SET da_equipe = true
    FROM usuario u WHERE u.id = c.autor_id AND u.papel = 'TREINADOR';

-- C) Fotos do post (C7): bytes no banco (como aluno_foto_perfil e questionario_imagem). post_id nulo = pendente, ainda sem post.
-- A FK composta com post_id nulo não é checada (MATCH SIMPLE), e apagar o post apaga as fotos dele.
CREATE TABLE comunidade_mural_foto (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id uuid NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    post_id uuid,
    autor_id uuid NOT NULL,
    bytes bytea NOT NULL,
    tamanho integer NOT NULL CHECK (tamanho > 0),
    criado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_comunidade_mural_foto_post FOREIGN KEY (consultoria_id, post_id)
        REFERENCES comunidade_mural_post (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_comunidade_mural_foto_autor FOREIGN KEY (consultoria_id, autor_id)
        REFERENCES usuario (consultoria_id, id)
);
-- Fotos de um post (lista do mural, apagar o post) e teto de 20 por usuário em 24 h (também a exportação e a anonimização).
CREATE INDEX idx_comunidade_mural_foto_post ON comunidade_mural_foto (consultoria_id, post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_comunidade_mural_foto_autor ON comunidade_mural_foto (consultoria_id, autor_id, criado_em);
-- Limpeza das pendentes com mais de 24 h.
CREATE INDEX idx_comunidade_mural_foto_pendente ON comunidade_mural_foto (consultoria_id, criado_em) WHERE post_id IS NULL;

-- D) Denúncia de post (C10): uma por post e usuário; motivo de lista fechada.
CREATE TABLE comunidade_mural_denuncia (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id uuid NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    post_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    motivo varchar(20) NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_comunidade_mural_denuncia_motivo CHECK (motivo IN ('OFENSIVO', 'SPAM', 'IMPROPRIO', 'OUTRO')),
    CONSTRAINT uk_comunidade_mural_denuncia UNIQUE (consultoria_id, post_id, usuario_id),
    CONSTRAINT fk_comunidade_mural_denuncia_post FOREIGN KEY (consultoria_id, post_id)
        REFERENCES comunidade_mural_post (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_comunidade_mural_denuncia_usuario FOREIGN KEY (consultoria_id, usuario_id)
        REFERENCES usuario (consultoria_id, id)
);
-- A UNIQUE já atende a busca por post; este é para exportar e apagar as denúncias de um usuário.
CREATE INDEX idx_comunidade_mural_denuncia_usuario ON comunidade_mural_denuncia (consultoria_id, usuario_id);

-- E) Chaves do treinador (C9): padrão ligadas.
ALTER TABLE consultoria
    ADD COLUMN comunidade_alunos_publicam boolean NOT NULL DEFAULT true,
    ADD COLUMN comunidade_alunos_anexam_fotos boolean NOT NULL DEFAULT true;
