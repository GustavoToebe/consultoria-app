-- V072: comunidade com enquetes (voto identificado), reações por código e capa de vídeo
-- (plano docs/planos/comunidade-enquetes-reacoes-video.md, seção "Contratos"). Sem compatibilidade com o legado (ainda não há
-- cliente). Os CHECKs entram válidos (sem NOT VALID): as tabelas são pequenas e a migration converte antes o que os violaria.

-- 1) Post: o tipo ENQUETE e as duas colunas da enquete. Só enquete tem as duas; o tipo e a escolha única/vários andam juntos.
ALTER TABLE comunidade_mural_post
    DROP CONSTRAINT ck_comunidade_mural_post_tipo,
    ADD CONSTRAINT ck_comunidade_mural_post_tipo
        CHECK (tipo IN ('AVISO', 'VIDEO', 'DUVIDA', 'RESULTADO', 'CONVERSA', 'ENQUETE')),
    ADD COLUMN enquete_varias_respostas boolean,
    ADD COLUMN enquete_encerra_em timestamptz,
    ADD CONSTRAINT ck_comunidade_mural_post_enquete
        CHECK ((tipo = 'ENQUETE') = (enquete_varias_respostas IS NOT NULL)),
    ADD CONSTRAINT ck_comunidade_mural_post_enquete_encerra
        CHECK (enquete_encerra_em IS NULL OR tipo = 'ENQUETE');

-- 2) Reações por código. Primeiro apaga tudo o que não é exatamente o coração (U+2764 U+FE0F), inclusive um 'CURTIR' escrito à
-- mão pela API antiga (que aceitava qualquer texto): assim a conversão para CURTIR nunca bate na UNIQUE da V068
-- (consultoria_id, post_id, usuario_id, emoji; o Postgres a acompanha no renome da coluna).
DELETE FROM comunidade_mural_reacao WHERE emoji <> (chr(10084) || chr(65039));
UPDATE comunidade_mural_reacao SET emoji = 'CURTIR';
ALTER TABLE comunidade_mural_reacao RENAME COLUMN emoji TO codigo;
ALTER TABLE comunidade_mural_reacao
    ADD CONSTRAINT ck_comunidade_mural_reacao_codigo CHECK (codigo IN ('CURTIR', 'FORCA', 'FOGO', 'PALMAS', 'RISO'));

-- 3) Opções da enquete. A UNIQUE (consultoria_id, post_id, id) é o alvo da FK composta do voto: a opção tem de ser do mesmo post.
CREATE TABLE comunidade_enquete_opcao (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id uuid NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    post_id uuid NOT NULL,
    ordem integer NOT NULL,
    texto varchar(80) NOT NULL,
    CONSTRAINT ck_comunidade_enquete_opcao_texto CHECK (char_length(texto) BETWEEN 1 AND 80),
    CONSTRAINT ck_comunidade_enquete_opcao_ordem CHECK (ordem BETWEEN 0 AND 5),
    CONSTRAINT uk_comunidade_enquete_opcao_id UNIQUE (consultoria_id, post_id, id),
    CONSTRAINT uk_comunidade_enquete_opcao_ordem UNIQUE (consultoria_id, post_id, ordem),
    CONSTRAINT fk_comunidade_enquete_opcao_post FOREIGN KEY (consultoria_id, post_id)
        REFERENCES comunidade_mural_post (consultoria_id, id) ON DELETE CASCADE
);

-- 4) Voto identificado: uma linha por (usuário, opção). votado_em é o instante em que aquela opção foi escolhida; nenhum
-- histórico de votos anteriores, de acesso ou de navegação é guardado.
CREATE TABLE comunidade_enquete_voto (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id uuid NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    post_id uuid NOT NULL,
    opcao_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    votado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_comunidade_enquete_voto UNIQUE (consultoria_id, post_id, opcao_id, usuario_id),
    CONSTRAINT fk_comunidade_enquete_voto_opcao FOREIGN KEY (consultoria_id, post_id, opcao_id)
        REFERENCES comunidade_enquete_opcao (consultoria_id, post_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_comunidade_enquete_voto_usuario FOREIGN KEY (consultoria_id, usuario_id)
        REFERENCES usuario (consultoria_id, id) ON DELETE CASCADE
);
-- Meus votos na lista do mural, exportação e anonimização (a UNIQUE já atende as consultas por post e opção).
CREATE INDEX idx_comunidade_enquete_voto_usuario ON comunidade_enquete_voto (consultoria_id, usuario_id, post_id);

-- 5) Capa do vídeo (aulão e post VIDEO), FK invertida como comunidade_mural_foto: bytes no banco, JPEG só. aula_id e post_id nulos =
-- capa pendente (enviada, ainda sem dono); no máximo um dos dois; uma capa por aula e por post (nulos não colidem na UNIQUE).
CREATE TABLE comunidade_capa (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id uuid NOT NULL REFERENCES consultoria(id) ON DELETE CASCADE,
    bytes bytea NOT NULL,
    tamanho integer NOT NULL CHECK (tamanho > 0),
    criado_em timestamptz NOT NULL DEFAULT now(),
    aula_id uuid,
    post_id uuid,
    CONSTRAINT ck_comunidade_capa_um_dono CHECK (num_nonnulls(aula_id, post_id) <= 1),
    CONSTRAINT uk_comunidade_capa_aula UNIQUE (consultoria_id, aula_id),
    CONSTRAINT uk_comunidade_capa_post UNIQUE (consultoria_id, post_id),
    CONSTRAINT fk_comunidade_capa_aula FOREIGN KEY (consultoria_id, aula_id)
        REFERENCES comunidade_aula (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_comunidade_capa_post FOREIGN KEY (consultoria_id, post_id)
        REFERENCES comunidade_mural_post (consultoria_id, id) ON DELETE CASCADE
);
-- Teto diário por consultoria e limpeza das pendentes com mais de 24 h.
CREATE INDEX idx_comunidade_capa_criado ON comunidade_capa (consultoria_id, criado_em);

-- A capa guardada no banco substitui o link externo da miniatura.
ALTER TABLE comunidade_aula DROP COLUMN miniatura_url;
