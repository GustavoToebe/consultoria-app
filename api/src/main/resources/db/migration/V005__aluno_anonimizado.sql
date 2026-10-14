-- Aluno que saiu e teve os dados pessoais apagados (LGPD). Nulo = cadastro normal.
ALTER TABLE aluno ADD COLUMN anonimizado_em timestamptz;
