-- Imagem ou GIF no exercício (21/10). Sem compatibilidade: ainda não há cliente real.

-- 1. De qual exercício do catálogo o da biblioteca veio (nulo = não veio do catálogo). Preenchido na importação; os que já
--    existem com origem CATALOGO são ligados pelo nome (catalogo_exercicio.nome é único). Nome editado depois da
--    importação não casa e fica sem ligação (nulo), que é o lado conservador: sem foto, nunca a foto de outro exercício.
ALTER TABLE exercicio ADD COLUMN catalogo_id uuid REFERENCES catalogo_exercicio (id);
UPDATE exercicio e SET catalogo_id = c.id
  FROM catalogo_exercicio c
 WHERE e.origem = 'CATALOGO' AND e.nome = c.nome;

-- 2. Imagem ou GIF próprio do treinador, no banco (como a imagem do questionário e a logo). JPEG, PNG ou GIF
--    regravados sem metadados, até 1 MB e 800 px. Uma por exercício; apagar o exercício leva a imagem junto. A chave
--    estrangeira composta garante que a imagem é da mesma consultoria do exercício.
ALTER TABLE exercicio ADD CONSTRAINT exercicio_consultoria_id_id_key UNIQUE (consultoria_id, id);
CREATE TABLE exercicio_imagem (
    exercicio_id   uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    tipo           varchar(20) NOT NULL
        CONSTRAINT ck_exercicio_imagem_tipo CHECK (tipo IN ('image/png', 'image/jpeg', 'image/gif')),
    bytes          bytea NOT NULL,
    tamanho        integer NOT NULL CHECK (tamanho > 0),
    atualizada_em  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_exercicio_imagem_exercicio FOREIGN KEY (consultoria_id, exercicio_id)
        REFERENCES exercicio (consultoria_id, id) ON DELETE CASCADE
);
