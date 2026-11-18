-- Playlists da comunidade (plano comunidade-playlists, passo 4; na tela, "Coleções"): agrupam os aulões e dão a ordem deles.
-- A playlist SUBSTITUI a categoria de texto: a coluna sai e os aulões já cadastrados ficam sem playlist (sem migração de texto).
--
-- comunidade_playlist: UNIQUE (consultoria_id, id) para a FK composta (o padrão do projeto: nada de outra consultoria entra).
-- Nome único por consultoria sem diferença de maiúsculas, 1 a 60 caracteres (a API já tira os espaços das pontas).
-- ordem NÃO é única: a API reescreve 0..n-1 sob trava da linha e o empate desempata por nome.
CREATE TABLE comunidade_playlist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id uuid NOT NULL REFERENCES consultoria (id) ON DELETE CASCADE,
    nome varchar(60) NOT NULL,
    ordem integer NOT NULL DEFAULT 0,
    criada_em timestamptz NOT NULL DEFAULT now(),
    atualizada_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT comunidade_playlist_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT ck_comunidade_playlist_nome CHECK (char_length(nome) BETWEEN 1 AND 60)
);

CREATE UNIQUE INDEX ux_comunidade_playlist_nome ON comunidade_playlist (consultoria_id, lower(nome));

ALTER TABLE comunidade_aula DROP COLUMN categoria;

-- comunidade_aula.playlist_id: nulo = sem playlist. SET NULL só da coluna da playlist: sem a lista, o SET NULL tentaria anular
-- consultoria_id (NOT NULL). Exige PG 15+ (o projeto usa o 18), como a V081 e a V082. Excluir a playlist deixa os aulões sem
-- playlist, nunca os apaga. A ordem do aulão passa a valer dentro da playlist.
ALTER TABLE comunidade_aula ADD COLUMN playlist_id uuid;

-- Todo aulão existente nasce sem playlist, e sem playlist a ordem é sempre 0 (a lista desempata pela data): a ordem antiga era global.
UPDATE comunidade_aula SET ordem = 0;

ALTER TABLE comunidade_aula ADD CONSTRAINT fk_comunidade_aula_playlist
    FOREIGN KEY (consultoria_id, playlist_id) REFERENCES comunidade_playlist (consultoria_id, id)
    ON DELETE SET NULL (playlist_id);

-- O índice de ordem da V065 passa a cobrir a playlist; o prefixo (consultoria_id, playlist_id) também serve ao SET NULL da FK.
DROP INDEX idx_comunidade_aula_consultoria_ordem;
CREATE INDEX idx_comunidade_aula_consultoria_ordem ON comunidade_aula (consultoria_id, playlist_id, ordem, criada_em);
