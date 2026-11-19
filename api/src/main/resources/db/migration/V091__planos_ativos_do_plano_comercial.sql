-- Planos ativos do aluno (D1, docs/planos/planos-ativos-do-aluno.md): o plano comercial diz o que inclui, Treino e/ou Dieta.
-- Os planos que já existem ficam "inclui tudo" (padrão true). Pelo menos um dos dois fica ligado.
ALTER TABLE plano_comercial ADD COLUMN inclui_treino boolean NOT NULL DEFAULT true;
ALTER TABLE plano_comercial ADD COLUMN inclui_dieta boolean NOT NULL DEFAULT true;
ALTER TABLE plano_comercial
    ADD CONSTRAINT ck_plano_comercial_inclui_algo CHECK (inclui_treino OR inclui_dieta);
