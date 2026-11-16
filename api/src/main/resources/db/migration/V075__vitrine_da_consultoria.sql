-- Vitrine da consultoria, fase F1 do plano docs/planos/vitrine-e-loja.md (D2, D3 e D5): o treinador mostra ao aluno o que tem
-- (planilha de treino, roupa), com preço, preço especial com validade e cupom. Sem pagamento, sem pedido e sem dado de comprador.

-- A) Item. Dinheiro em centavos (bigint), até R$ 10.000.000,00. A regra completa (nome, tamanhos, https, faixa da data, teto de 30
-- itens por consultoria) é da API; o CHECK é a rede de proteção do banco e nunca recusa o que a API aceita.
-- Preço especial só existe com preço normal e é menor que ele; a data de validade só existe com preço especial (dia de Brasília,
-- inclusive; nula = sem fim). Sem data de início da promoção: ela começa ao salvar.
CREATE TABLE vitrine_item (
    id                      uuid PRIMARY KEY,
    consultoria_id          uuid NOT NULL REFERENCES consultoria (id),
    nome                    varchar(100) NOT NULL,
    descricao               varchar(300),
    tipo                    varchar(10) NOT NULL,
    preco_centavos          bigint,
    preco_especial_centavos bigint,
    especial_ate            date,
    cupom                   varchar(40),
    link_url                varchar(500),
    ativo                   boolean NOT NULL,
    ordem                   integer NOT NULL,
    criado_em               timestamptz NOT NULL DEFAULT now(),
    atualizado_em           timestamptz NOT NULL DEFAULT now(),
    versao                  bigint NOT NULL DEFAULT 0,
    CONSTRAINT ck_vitrine_item_tipo CHECK (tipo IN ('DIGITAL', 'FISICO')),
    CONSTRAINT ck_vitrine_item_ordem CHECK (ordem >= 0),
    CONSTRAINT ck_vitrine_item_preco CHECK (preco_centavos IS NULL OR preco_centavos BETWEEN 1 AND 1000000000),
    CONSTRAINT ck_vitrine_item_especial CHECK (preco_especial_centavos IS NULL
        OR (preco_centavos IS NOT NULL AND preco_especial_centavos BETWEEN 1 AND preco_centavos - 1)),
    CONSTRAINT ck_vitrine_item_especial_ate CHECK (especial_ate IS NULL OR preco_especial_centavos IS NOT NULL),
    -- Chave para a FK composta da foto: o item e a foto nunca são de consultorias diferentes.
    CONSTRAINT uq_vitrine_item_consultoria_id UNIQUE (consultoria_id, id)
);
CREATE INDEX ix_vitrine_item_ordem ON vitrine_item (consultoria_id, ordem);

-- B) Foto do item, 1:1, no banco (como a foto de perfil e a imagem do exercício): JPEG já regravado sem metadados. Existe só
-- depois do item (PUT sobre item que já existe), então não há foto pendente nem órfã; apagar o item apaga a foto.
CREATE TABLE vitrine_item_foto (
    item_id        uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL REFERENCES consultoria (id),
    jpeg           bytea NOT NULL,
    tamanho        integer NOT NULL CHECK (tamanho > 0),
    atualizada_em  timestamptz NOT NULL,
    CONSTRAINT fk_vitrine_item_foto_item FOREIGN KEY (consultoria_id, item_id)
        REFERENCES vitrine_item (consultoria_id, id) ON DELETE CASCADE
);

-- C) Permissões VITRINE_LER e VITRINE_ALTERAR (a segunda depende da primeira, no CatalogoPermissoes). O Administrador tem acesso
-- total e não guarda linhas. Sem preenchimento retroativo: consultoria que já existe só dá a permissão a quem escolher; a
-- consultoria nova nasce com o Treinador padrão com as duas. Função e gatilho próprios, como na V069: o gatilho roda depois do
-- consultoria_perfis_padrao (ordem alfabética dos nomes), quando os perfis já existem.
CREATE FUNCTION public.criar_permissoes_vitrine(cid uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
 insert into perfil_permissao(perfil_id,codigo)
 select p.id, c.codigo from perfil p cross join (values ('VITRINE_LER'), ('VITRINE_ALTERAR')) as c(codigo)
 where p.consultoria_id = cid and p.id = md5(cid::text || ':Treinador')::uuid
 on conflict do nothing;
end; $$;

CREATE FUNCTION public.consultoria_perfis_padrao_vitrine() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin perform criar_permissoes_vitrine(new.id); return new; end; $$;

CREATE TRIGGER consultoria_perfis_padrao_vitrine AFTER INSERT ON public.consultoria
    FOR EACH ROW EXECUTE FUNCTION public.consultoria_perfis_padrao_vitrine();
