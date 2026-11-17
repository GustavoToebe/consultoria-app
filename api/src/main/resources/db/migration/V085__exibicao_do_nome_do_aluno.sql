-- Como o nome do aluno aparece para os colegas (plano docs/planos/nome-no-mural.md, D1): escolha do próprio aluno.
-- Nulo = não escolheu e vale NOME (só o primeiro nome); sem default de propósito, para quem já existe seguir o padrão mais reservado.
-- APELIDO e NOME_E_APELIDO sem apelido caem no primeiro nome (regra do servidor, não do banco).
ALTER TABLE aluno ADD COLUMN exibicao_do_nome varchar(20);
ALTER TABLE aluno ADD CONSTRAINT ck_aluno_exibicao_do_nome CHECK (
    exibicao_do_nome IS NULL OR exibicao_do_nome IN ('NOME', 'NOME_COMPLETO', 'APELIDO', 'NOME_E_APELIDO'));
