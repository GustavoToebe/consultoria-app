-- Tira o tema Café (17/11/2026): a consultoria que usava CAFE como tema padrão passa para ESCURO e o CHECK da V055 é refeito
-- sem ele. É a única coluna de tema do banco (a escolha de cada usuário vive no aparelho).
UPDATE consultoria SET tema_padrao = 'ESCURO' WHERE tema_padrao = 'CAFE';
ALTER TABLE consultoria DROP CONSTRAINT consultoria_tema_padrao_check;
ALTER TABLE consultoria ADD CONSTRAINT consultoria_tema_padrao_check CHECK (tema_padrao IN
    ('ESCURO', 'MEIA_NOITE', 'AMEIXA', 'OCEANO', 'CLARO', 'AREIA', 'LAVANDA', 'CEU', 'ROSA'));
