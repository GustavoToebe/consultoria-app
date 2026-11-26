-- Desativar o acesso do aluno ao app sem apagar nada e sem inativar o aluno (plano docs/planos/ajustes-da-tarde-25-11.md, D3).
-- Nulos = acesso normal. As duas colunas andam juntas; hoje o único motivo é MANUAL (a pausa por atraso, Fase 2, acrescenta outro).
-- Sem preenchimento retroativo: quem já existe segue com o acesso ativo.
ALTER TABLE aluno
    ADD COLUMN acesso_desativado_em timestamptz,
    ADD COLUMN acesso_desativado_motivo varchar(20);
ALTER TABLE aluno ADD CONSTRAINT ck_aluno_acesso_desativado CHECK (
    (acesso_desativado_em IS NULL) = (acesso_desativado_motivo IS NULL)
    AND (acesso_desativado_motivo IS NULL OR acesso_desativado_motivo IN ('MANUAL')));
