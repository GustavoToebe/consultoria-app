-- Agenda: compromisso com vários alunos (docs/planos/agenda-calendario.md, D11 e D12; V042).
-- O compromisso deixa de ter um aluno e uma situação: cada aluno é um participante (compromisso_aluno) com a situação dele
-- (AGENDADO, REALIZADO, FALTOU ou CANCELADO só para ele). compromisso.cancelado diz que o compromisso inteiro foi cancelado
-- (todos os participantes cancelados) e é só ele que libera o horário do responsável. A mesma migration traz as tabelas e
-- colunas que a série de compromissos (serie_id) e o aviso dentro do app (aviso_compromisso) vão usar nos passos seguintes.
-- O limite de 20 alunos por compromisso é regra do serviço (a trava da consultoria já serializa a escrita).

-- 1) Participantes. FK compostas (consultoria_id, ...) como a V036: um participante nunca aponta para outra consultoria.
CREATE TABLE compromisso_aluno (
    id              uuid PRIMARY KEY,
    consultoria_id  uuid NOT NULL REFERENCES consultoria (id),
    compromisso_id  uuid NOT NULL,
    aluno_id        uuid NOT NULL,
    situacao        varchar(20) NOT NULL DEFAULT 'AGENDADO'
        CHECK (situacao IN ('AGENDADO', 'REALIZADO', 'CANCELADO', 'FALTOU')),
    criado_em       timestamptz NOT NULL DEFAULT now(),
    atualizado_em   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT compromisso_aluno_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT compromisso_aluno_unico UNIQUE (consultoria_id, compromisso_id, aluno_id),
    CONSTRAINT fk_compromisso_aluno_compromisso FOREIGN KEY (consultoria_id, compromisso_id)
        REFERENCES compromisso (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_compromisso_aluno_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id) ON DELETE CASCADE
);
-- Compromissos de um aluno (lista do aluno, aluno ocupado, exportação) e participantes de um compromisso.
CREATE INDEX ix_compromisso_aluno_do_aluno ON compromisso_aluno (consultoria_id, aluno_id, compromisso_id);
CREATE INDEX ix_compromisso_aluno_do_compromisso ON compromisso_aluno (consultoria_id, compromisso_id);

-- 2) Os compromissos de hoje passam para o formato novo aqui mesmo, sem código de transição: um participante por
-- compromisso, com a mesma situação.
INSERT INTO compromisso_aluno (id, consultoria_id, compromisso_id, aluno_id, situacao, criado_em, atualizado_em)
SELECT gen_random_uuid(), consultoria_id, id, aluno_id, situacao, criado_em, atualizado_em FROM compromisso;

-- 3) O compromisso inteiro cancelado. Realizado e falta antigos ficam como situação do único participante e continuam
-- ocupando o horário (cancelado = false), como antes.
ALTER TABLE compromisso ADD COLUMN cancelado boolean NOT NULL DEFAULT false;
UPDATE compromisso SET cancelado = (situacao = 'CANCELADO');

-- 4) Sai o que era do modelo de um aluno só. Os índices vão primeiro, às claras (o do responsável tem situacao no WHERE).
DROP INDEX ix_compromisso_responsavel;
DROP INDEX ix_compromisso_aluno;
ALTER TABLE compromisso DROP CONSTRAINT fk_compromisso_aluno;
ALTER TABLE compromisso DROP COLUMN aluno_id;
ALTER TABLE compromisso DROP COLUMN situacao;

-- 5) Conflito do responsável: só os não cancelados.
CREATE INDEX ix_compromisso_responsavel ON compromisso (consultoria_id, responsavel_id, inicio) WHERE NOT cancelado;

-- 6) Série de compromissos (P3, passo 2): só liga as ocorrências, sem tabela de série.
ALTER TABLE compromisso ADD COLUMN serie_id uuid;
CREATE INDEX ix_compromisso_serie ON compromisso (consultoria_id, serie_id, inicio);

-- 7) Aviso dentro do app (D12, passo 3). O aviso guarda uma cópia do momento (início e nome do responsável) para o texto não
-- mudar se o compromisso mudar de novo; sem observação, sem local e sem nome de outro aluno. Responsável nulo = "a equipe".
-- O limite de 120 do nome é o de usuario.nome.
CREATE TABLE aviso_compromisso (
    id               uuid PRIMARY KEY,
    consultoria_id   uuid NOT NULL REFERENCES consultoria (id),
    aluno_id         uuid NOT NULL,
    compromisso_id   uuid NOT NULL,
    tipo             varchar(20) NOT NULL CHECK (tipo IN ('NOVO', 'REMARCADO', 'CANCELADO')),
    inicio           timestamptz NOT NULL,
    responsavel_nome varchar(120),
    criado_em        timestamptz NOT NULL DEFAULT now(),
    visto_em         timestamptz,
    CONSTRAINT aviso_compromisso_consultoria_id_id_key UNIQUE (consultoria_id, id),
    CONSTRAINT fk_aviso_compromisso_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_aviso_compromisso_compromisso FOREIGN KEY (consultoria_id, compromisso_id)
        REFERENCES compromisso (consultoria_id, id) ON DELETE CASCADE
);
-- Os avisos ainda não vistos de um aluno, do mais novo ao mais antigo.
CREATE INDEX ix_aviso_compromisso_nao_visto ON aviso_compromisso (consultoria_id, aluno_id, criado_em) WHERE visto_em IS NULL;
-- Apagar o compromisso (CASCADE) e substituir o aviso anterior do mesmo compromisso e aluno.
CREATE INDEX ix_aviso_compromisso_do_compromisso ON aviso_compromisso (consultoria_id, compromisso_id, aluno_id);
