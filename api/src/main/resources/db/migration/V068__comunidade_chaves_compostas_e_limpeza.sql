-- V068: acerto da comunidade (V065) e da importação assistida (V066), já em produção: a V065 e a V066 não se editam.
--
-- 1. FK composta (consultoria_id, id), o padrão do projeto (ex.: fk_aluno_responsavel). Com a FK simples o banco aceitava, por
--    exemplo, um comentário da consultoria A numa aula da consultoria B. As tabelas pai ganham a UNIQUE (consultoria_id, id) que a
--    FK composta exige (aluno e usuario já têm: aluno_consultoria_id_id_key e ux_usuario_consultoria_id).
-- 2. Linhas que já violam a regra nova (consultoria diferente entre filho e pai, só possível pelo bug que esta migration fecha) são
--    apagadas ANTES das FKs, para a migration não falhar por dado existente: o filho está na consultoria errada e nenhuma outra
--    consultoria o enxerga. Com os dados normais não apaga nada.
-- 3. As FKs entram NOT VALID e são validadas em seguida (trava curta nas duas tabelas, sem varrer com lock pesado).
-- 4. uk_mural_reacao_usuario passa a levar consultoria_id (a nova é mais frouxa que a antiga, então nenhum dado existente a viola).
-- 5. CHECK de estado e formato da importação assistida, NOT VALID: vale para linha nova e não olha as antigas (uma sessão de teste
--    com estado fora da lista não pode derrubar a subida). O objetivo da sessão fica sem CHECK: o corpo da requisição o aceita
--    livre e só um valor é conhecido; validar na rota primeiro, depois a constraint.
-- 6. Sai a coluna do ranking de força (aluno.participa_ranking_forca): o ranking que a usava foi removido (inventava carga).

-- ---- 2. Limpeza das linhas de consultoria trocada ----

DELETE FROM comunidade_aula_comentario c
 WHERE NOT EXISTS (SELECT 1 FROM comunidade_aula a WHERE a.id = c.aula_id AND a.consultoria_id = c.consultoria_id)
    OR NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = c.autor_id AND u.consultoria_id = c.consultoria_id);

DELETE FROM comunidade_mural_reacao r
 WHERE NOT EXISTS (SELECT 1 FROM comunidade_mural_post p WHERE p.id = r.post_id AND p.consultoria_id = r.consultoria_id)
    OR NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = r.usuario_id AND u.consultoria_id = r.consultoria_id);

DELETE FROM comunidade_mural_comentario c
 WHERE NOT EXISTS (SELECT 1 FROM comunidade_mural_post p WHERE p.id = c.post_id AND p.consultoria_id = c.consultoria_id)
    OR NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = c.autor_id AND u.consultoria_id = c.consultoria_id);

DELETE FROM comunidade_mural_post p
 WHERE NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = p.autor_id AND u.consultoria_id = p.consultoria_id);

DELETE FROM conquista_aluno c
 WHERE NOT EXISTS (SELECT 1 FROM aluno a WHERE a.id = c.aluno_id AND a.consultoria_id = c.consultoria_id);

-- Importação assistida: sessão e arquivos expiram em 7 dias, então o que se apaga aqui já seria descartado.
DELETE FROM importacao_arquivo f
 WHERE NOT EXISTS (SELECT 1 FROM importacao_sessao s WHERE s.id = f.sessao_id AND s.consultoria_id = f.consultoria_id);

DELETE FROM importacao_sessao s
 WHERE NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = s.criado_por AND u.consultoria_id = s.consultoria_id);

-- ---- 1. UNIQUE (consultoria_id, id) nas tabelas pai ----

ALTER TABLE comunidade_aula
    ADD CONSTRAINT comunidade_aula_consultoria_id_id_key UNIQUE (consultoria_id, id);
ALTER TABLE comunidade_mural_post
    ADD CONSTRAINT comunidade_mural_post_consultoria_id_id_key UNIQUE (consultoria_id, id);
ALTER TABLE importacao_sessao
    ADD CONSTRAINT importacao_sessao_consultoria_id_id_key UNIQUE (consultoria_id, id);

-- ---- 1/3. FKs compostas no lugar das simples ----

ALTER TABLE comunidade_aula_comentario
    DROP CONSTRAINT IF EXISTS comunidade_aula_comentario_aula_id_fkey,
    DROP CONSTRAINT IF EXISTS comunidade_aula_comentario_autor_id_fkey,
    ADD CONSTRAINT fk_comunidade_aula_comentario_aula FOREIGN KEY (consultoria_id, aula_id)
        REFERENCES comunidade_aula (consultoria_id, id) ON DELETE CASCADE NOT VALID,
    ADD CONSTRAINT fk_comunidade_aula_comentario_autor FOREIGN KEY (consultoria_id, autor_id)
        REFERENCES usuario (consultoria_id, id) NOT VALID;

ALTER TABLE comunidade_mural_post
    DROP CONSTRAINT IF EXISTS comunidade_mural_post_autor_id_fkey,
    ADD CONSTRAINT fk_comunidade_mural_post_autor FOREIGN KEY (consultoria_id, autor_id)
        REFERENCES usuario (consultoria_id, id) NOT VALID;

ALTER TABLE comunidade_mural_reacao
    DROP CONSTRAINT IF EXISTS comunidade_mural_reacao_post_id_fkey,
    DROP CONSTRAINT IF EXISTS comunidade_mural_reacao_usuario_id_fkey,
    ADD CONSTRAINT fk_comunidade_mural_reacao_post FOREIGN KEY (consultoria_id, post_id)
        REFERENCES comunidade_mural_post (consultoria_id, id) ON DELETE CASCADE NOT VALID,
    ADD CONSTRAINT fk_comunidade_mural_reacao_usuario FOREIGN KEY (consultoria_id, usuario_id)
        REFERENCES usuario (consultoria_id, id) NOT VALID;

ALTER TABLE comunidade_mural_comentario
    DROP CONSTRAINT IF EXISTS comunidade_mural_comentario_post_id_fkey,
    DROP CONSTRAINT IF EXISTS comunidade_mural_comentario_autor_id_fkey,
    ADD CONSTRAINT fk_comunidade_mural_comentario_post FOREIGN KEY (consultoria_id, post_id)
        REFERENCES comunidade_mural_post (consultoria_id, id) ON DELETE CASCADE NOT VALID,
    ADD CONSTRAINT fk_comunidade_mural_comentario_autor FOREIGN KEY (consultoria_id, autor_id)
        REFERENCES usuario (consultoria_id, id) NOT VALID;

ALTER TABLE conquista_aluno
    DROP CONSTRAINT IF EXISTS conquista_aluno_aluno_id_fkey,
    ADD CONSTRAINT fk_conquista_aluno_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE importacao_sessao
    DROP CONSTRAINT IF EXISTS importacao_sessao_criado_por_fkey,
    ADD CONSTRAINT fk_importacao_sessao_criado_por FOREIGN KEY (consultoria_id, criado_por)
        REFERENCES usuario (consultoria_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE importacao_arquivo
    DROP CONSTRAINT IF EXISTS importacao_arquivo_sessao_id_fkey,
    ADD CONSTRAINT fk_importacao_arquivo_sessao FOREIGN KEY (consultoria_id, sessao_id)
        REFERENCES importacao_sessao (consultoria_id, id) ON DELETE CASCADE NOT VALID;

ALTER TABLE comunidade_aula_comentario VALIDATE CONSTRAINT fk_comunidade_aula_comentario_aula;
ALTER TABLE comunidade_aula_comentario VALIDATE CONSTRAINT fk_comunidade_aula_comentario_autor;
ALTER TABLE comunidade_mural_post VALIDATE CONSTRAINT fk_comunidade_mural_post_autor;
ALTER TABLE comunidade_mural_reacao VALIDATE CONSTRAINT fk_comunidade_mural_reacao_post;
ALTER TABLE comunidade_mural_reacao VALIDATE CONSTRAINT fk_comunidade_mural_reacao_usuario;
ALTER TABLE comunidade_mural_comentario VALIDATE CONSTRAINT fk_comunidade_mural_comentario_post;
ALTER TABLE comunidade_mural_comentario VALIDATE CONSTRAINT fk_comunidade_mural_comentario_autor;
ALTER TABLE conquista_aluno VALIDATE CONSTRAINT fk_conquista_aluno_aluno;
ALTER TABLE importacao_sessao VALIDATE CONSTRAINT fk_importacao_sessao_criado_por;
ALTER TABLE importacao_arquivo VALIDATE CONSTRAINT fk_importacao_arquivo_sessao;

-- ---- 4. Reação única por usuário, post e emoji, com a consultoria na chave ----

ALTER TABLE comunidade_mural_reacao
    DROP CONSTRAINT uk_mural_reacao_usuario,
    ADD CONSTRAINT uk_mural_reacao_usuario UNIQUE (consultoria_id, post_id, usuario_id, emoji);

-- ---- 5. CHECK da importação assistida (NOT VALID: só linha nova) ----

ALTER TABLE importacao_sessao
    ADD CONSTRAINT ck_importacao_sessao_estado
        CHECK (estado IN ('RECEBENDO', 'PROCESSANDO', 'REVISANDO', 'CONCLUIDA')) NOT VALID;

ALTER TABLE importacao_arquivo
    ADD CONSTRAINT ck_importacao_arquivo_estado
        CHECK (estado IN ('RECEBIDO', 'PROCESSADO', 'ERRO')) NOT VALID,
    ADD CONSTRAINT ck_importacao_arquivo_formato
        CHECK (formato IN ('PDF', 'DOCX', 'XLSX', 'CSV', 'TEXTO_LIVRE')) NOT VALID;

-- ---- 6. Ranking de força removido ----

ALTER TABLE aluno DROP COLUMN IF EXISTS participa_ranking_forca;
