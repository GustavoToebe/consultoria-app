-- Responsável financeiro do aluno (D15 de docs/planos/financeiro-em-fases.md): quem recebe os lembretes de cobrança (e-mail e
-- "Abrir WhatsApp com a mensagem") no lugar do aluno. No máximo um por aluno. É dado pessoal de TERCEIRO (e, muitas vezes, do
-- responsável por um menor): nunca em log, auditoria, mensagem de erro nem toString. O CPF é opcional, guardado formatado
-- (Formatos.cpf) e SEM unicidade: o mesmo responsável pode responder por mais de um aluno. Nome obrigatório; parentesco, CPF,
-- telefone e e-mail opcionais. A linha some junto com o aluno (ON DELETE CASCADE); a anonimização e "Excluir minha conta" não
-- apagam o aluno e por isso apagam a linha explicitamente (PagamentosDoAluno.apagarDoAluno).
CREATE TABLE responsavel_financeiro (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    aluno_id       uuid NOT NULL,
    nome           varchar(120) NOT NULL,
    parentesco     varchar(30),
    cpf            varchar(14),
    telefone       varchar(20),
    email          varchar(254),
    versao         bigint NOT NULL DEFAULT 0,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_responsavel_financeiro_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id) ON DELETE CASCADE,
    -- Um por aluno; também serve à leitura por aluno.
    CONSTRAINT ux_responsavel_financeiro_aluno UNIQUE (consultoria_id, aluno_id)
);
