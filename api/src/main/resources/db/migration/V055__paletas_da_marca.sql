-- Paletas da marca (plano docs/planos/paletas-da-marca.md, decisão 1): o tema padrão dos alunos deixa de ser só Escuro ou Claro
-- e passa a ser uma paleta da lista fechada; o modo (escuro ou claro) de cada uma é decidido no app. Sem compatibilidade com a
-- lista antiga: ESCURO e CLARO continuam valendo porque fazem parte da lista nova.
ALTER TABLE consultoria ALTER COLUMN tema_padrao TYPE character varying(20);
ALTER TABLE consultoria DROP CONSTRAINT consultoria_tema_padrao_check;
ALTER TABLE consultoria ADD CONSTRAINT consultoria_tema_padrao_check CHECK (tema_padrao IN
    ('ESCURO', 'MEIA_NOITE', 'AMEIXA', 'OCEANO', 'CAFE', 'CLARO', 'AREIA', 'LAVANDA', 'CEU', 'ROSA'));
