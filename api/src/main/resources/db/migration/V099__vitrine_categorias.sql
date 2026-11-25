-- Categorias da vitrine (docs/planos/vitrine-categorias.md, D3): o treinador agrupa os itens da vitrine em categorias que ele mesmo
-- cria e ordena; item sem categoria é válido. Nada é criado automaticamente. O nome é texto digitado pelo treinador: nunca em log nem
-- em auditoria. Sem dado de pessoa.
-- `nome_normalizado` = nome sem acento, em minúsculas e com espaços simples (o mesmo cálculo de `Buscas.semAcento`); é ele que a
-- unicidade confere. Tem 80 (o dobro de `nome`) porque a decomposição (NFD) de alguns alfabetos ocupa mais de uma letra por caractere;
-- o serviço recusa o nome cujo normalizado passa de 80 (422 `VITRINE_CATEGORIA_INVALIDA`). O limite de 30 categorias por consultoria
-- é do serviço (a consultoria fica travada ao criar). `ordem` não é única: a API renumera de 0 a N-1 sob a trava da consultoria.
CREATE TABLE vitrine_categoria (
    id               uuid PRIMARY KEY,
    consultoria_id   uuid NOT NULL REFERENCES consultoria (id),
    nome             varchar(40) NOT NULL,
    nome_normalizado varchar(80) NOT NULL,
    ordem            integer NOT NULL,
    versao           bigint NOT NULL DEFAULT 0,
    criado_em        timestamptz NOT NULL DEFAULT now(),
    atualizado_em    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_vitrine_categoria_nome CHECK (char_length(nome) >= 1 AND nome_normalizado <> ''),
    CONSTRAINT ck_vitrine_categoria_ordem CHECK (ordem >= 0),
    -- Sem diferença de caixa nem de acento, dentro da consultoria.
    CONSTRAINT ux_vitrine_categoria_nome UNIQUE (consultoria_id, nome_normalizado),
    -- Alvo da FK composta do item (a categoria nunca é de outra consultoria).
    CONSTRAINT ux_vitrine_categoria_consultoria_id UNIQUE (consultoria_id, id)
);

CREATE INDEX ix_vitrine_categoria_ordem ON vitrine_categoria (consultoria_id, ordem);

-- vitrine_item.categoria_id: nulo = sem categoria. SET NULL só da coluna da categoria: sem a lista, o SET NULL tentaria anular
-- consultoria_id (NOT NULL). Exige PG 15+ (o projeto usa o 18), como a V082 e a V088. Excluir a categoria deixa os itens sem
-- categoria, nunca os apaga.
ALTER TABLE vitrine_item ADD COLUMN categoria_id uuid;

ALTER TABLE vitrine_item ADD CONSTRAINT fk_vitrine_item_categoria
    FOREIGN KEY (consultoria_id, categoria_id) REFERENCES vitrine_categoria (consultoria_id, id)
    ON DELETE SET NULL (categoria_id);

-- "Quantos itens tem a categoria" e o SET NULL da FK ao excluir (só os itens com categoria entram no índice).
CREATE INDEX ix_vitrine_item_categoria ON vitrine_item (consultoria_id, categoria_id) WHERE categoria_id IS NOT NULL;
