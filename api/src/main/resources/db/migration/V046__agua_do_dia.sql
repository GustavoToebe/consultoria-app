-- Água que o aluno marcou num dia (docs/planos/agua-do-aluno.md): copos de 250 ml no app, guardados em mililitros (0 a
-- 20.000), para um dia aceitar valor livre sem migration. Um registro por aluno e dia; o id nasce no aparelho (UUID), então
-- reenviar não duplica, e tirar um copo é o mesmo registro com menos mililitros (o último a chegar vence, pelo horário do
-- aparelho, como na mobilidade). Zero é zero (o aluno tirou os copos); dia sem linha é "não registrou", nunca zero.
-- Dado de dieta (LGPD): a equipe lê com a permissão sensível, a anonimização e "Excluir minha conta" apagam as linhas.
-- Recusas (data fora do aceito, id de outro registro) só saem na resposta, para nunca sobrescrever um registro aceito.
CREATE TABLE agua_do_dia (
    id                      uuid PRIMARY KEY,
    consultoria_id          uuid NOT NULL REFERENCES consultoria (id),
    aluno_id                uuid NOT NULL,
    data                    date NOT NULL,
    agua_ml                 integer NOT NULL CHECK (agua_ml BETWEEN 0 AND 20000),
    alterado_no_aparelho_em timestamptz NOT NULL,
    criado_em               timestamptz NOT NULL DEFAULT now(),
    atualizado_em           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_agua_do_dia_aluno FOREIGN KEY (consultoria_id, aluno_id) REFERENCES aluno (consultoria_id, id),
    CONSTRAINT agua_do_dia_chave_key UNIQUE (aluno_id, data)
);

CREATE INDEX ix_agua_do_dia_aluno_data ON agua_do_dia (consultoria_id, aluno_id, data DESC);
