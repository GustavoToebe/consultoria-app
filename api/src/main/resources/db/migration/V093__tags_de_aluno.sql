-- Tags do aluno (docs/planos/tags-de-aluno.md): rótulos livres da consultoria para achar e filtrar a lista de alunos. Só a equipe vê; o aluno nunca.
-- Não é campo para saúde, mas o nome é texto digitado pelo treinador e pode identificar alguém: nunca em log nem em auditoria, e a
-- anonimização apaga a ligação aluno-tag (a tag da consultoria fica). `nome_normalizado` = nome sem acento, em minúsculas e com espaços
-- simples (o mesmo cálculo de `Buscas.semAcento` e do `nome_busca` do catálogo); é ele que a unicidade confere. Tem 60 porque a
-- decomposição (NFD) e a caixa baixa de alguns caracteres ocupam mais de um (hangul, por exemplo, vira 2 ou 3 letras por sílaba); o
-- serviço recusa o nome cujo normalizado passa de 60 (422 `TAG_INVALIDA`). `cor` é uma das cores de identificação do app (a marca e as cores de situação ficam de fora); o app
-- guarda só o código. O limite de 10 tags por aluno é do serviço (a linha do aluno fica travada ao gravar).
CREATE TABLE tag_aluno (
    id               uuid PRIMARY KEY,
    consultoria_id   uuid NOT NULL REFERENCES consultoria (id),
    nome             varchar(30) NOT NULL,
    nome_normalizado varchar(60) NOT NULL,
    cor              varchar(20) NOT NULL,
    criado_em        timestamptz NOT NULL DEFAULT now(),
    atualizado_em    timestamptz NOT NULL DEFAULT now(),
    versao           bigint NOT NULL DEFAULT 0,
    CONSTRAINT ck_tag_aluno_nome CHECK (char_length(nome) >= 1 AND nome_normalizado <> ''),
    CONSTRAINT ck_tag_aluno_cor CHECK (cor IN ('CIANO', 'AZUL', 'INDIGO', 'VIOLETA', 'MAGENTA')),
    -- Sem diferença de caixa nem de acento, dentro da consultoria.
    CONSTRAINT ux_tag_aluno_nome UNIQUE (consultoria_id, nome_normalizado),
    -- Alvo da FK composta da ligação (a tag nunca é de outra consultoria).
    CONSTRAINT ux_tag_aluno_consultoria_id UNIQUE (consultoria_id, id)
);

CREATE TABLE aluno_tag (
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    aluno_id       uuid NOT NULL,
    tag_id         uuid NOT NULL,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_aluno_tag PRIMARY KEY (aluno_id, tag_id),
    CONSTRAINT fk_aluno_tag_aluno FOREIGN KEY (consultoria_id, aluno_id)
        REFERENCES aluno (consultoria_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_aluno_tag_tag FOREIGN KEY (consultoria_id, tag_id)
        REFERENCES tag_aluno (consultoria_id, id) ON DELETE CASCADE
);

-- "Em quantos alunos está a tag", o filtro por tag e o cascade ao apagar a tag.
CREATE INDEX ix_aluno_tag_tag ON aluno_tag (consultoria_id, tag_id);
