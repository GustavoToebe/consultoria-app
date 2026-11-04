-- Limite de alunos por membro da equipe (supervisão da equipe, D2, D13, D14): quantos alunos ativos o membro pode ter
-- como responsável. Nulo = sem limite; 0 = não recebe aluno novo. Quem já passou do limite não perde aluno (D4).
ALTER TABLE usuario
    ADD COLUMN limite_de_alunos integer,
    ADD CONSTRAINT ck_usuario_limite_de_alunos CHECK (limite_de_alunos IS NULL OR limite_de_alunos BETWEEN 0 AND 999);
