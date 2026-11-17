-- Pods da comunidade (plano pods-da-comunidade, passo 1): grupos pequenos dentro da comunidade de uma consultoria, com um mural
-- próprio que só os membros e a equipe veem. Quem cria e atribui é a equipe. Sem mensagem direta, convite nem ranking do pod.
--
-- comunidade_pod: UNIQUE (consultoria_id, id) para as FKs compostas (o padrão do projeto: nada de outra consultoria entra).
-- Nome único por consultoria sem diferença de maiúsculas; 2 a 40 caracteres (a API já tira os espaços das pontas).
CREATE TABLE comunidade_pod (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consultoria_id uuid NOT NULL REFERENCES consultoria (id) ON DELETE CASCADE,
    nome varchar(40) NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT comunidade_pod_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT ck_comunidade_pod_nome CHECK (char_length(nome) BETWEEN 2 AND 40)
);

CREATE UNIQUE INDEX ux_comunidade_pod_nome ON comunidade_pod (consultoria_id, lower(nome));

-- aluno.pod_id: um aluno em um pod só (a unicidade vem da coluna). SET NULL só da coluna do pod: sem a lista, o SET NULL tentaria
-- anular consultoria_id (NOT NULL). Exige PG 15+ (o projeto usa o 18). Inativar, anonimizar e "Excluir minha conta" zeram a coluna
-- por UPDATE explícito (a FK só age em DELETE físico do pod, que a v1 não tem).
ALTER TABLE aluno ADD COLUMN pod_id uuid;

ALTER TABLE aluno ADD CONSTRAINT fk_aluno_pod
    FOREIGN KEY (consultoria_id, pod_id) REFERENCES comunidade_pod (consultoria_id, id)
    ON DELETE SET NULL (pod_id);

-- Lado da FK sem índice próprio: serve à contagem do teto de membros e ao SET NULL.
CREATE INDEX ix_aluno_pod ON aluno (consultoria_id, pod_id) WHERE pod_id IS NOT NULL;

-- comunidade_mural_post.pod_id: nulo = mural geral. NO ACTION, nunca SET NULL: apagar o pod com post falha (o post privado
-- vazaria para o geral). NO ACTION confere só no fim do comando, então a cascata da consultoria (que apaga pod e post) não
-- depende da ordem em que as cascatas rodam; conferido no PostgreSQL 18 nas duas ordens.
ALTER TABLE comunidade_mural_post ADD COLUMN pod_id uuid;

ALTER TABLE comunidade_mural_post ADD CONSTRAINT fk_comunidade_mural_post_pod
    FOREIGN KEY (consultoria_id, pod_id) REFERENCES comunidade_pod (consultoria_id, id)
    ON DELETE NO ACTION;

CREATE INDEX ix_comunidade_mural_post_pod ON comunidade_mural_post (consultoria_id, pod_id, fixado DESC, criado_em DESC)
    WHERE pod_id IS NOT NULL;
