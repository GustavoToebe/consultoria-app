-- Página pública da loja, fase F2a do plano docs/planos/vitrine-e-loja.md (D10 e D17): só leitura, "Comprar" abre o link externo do
-- item. Sem pedido, sem dado de comprador e sem pagamento. (O plano diz V076, mas a V076 é do contato da consultoria.)

-- A) Uma linha por consultoria, criada quando a equipe liga a página ou pede o primeiro link. O código é gerado no servidor
-- (CodigoDeInscricao.novo(), 24 caracteres) e fica no caminho do link público; é único no banco inteiro, porque o link não leva a
-- consultoria. Sem preenchimento retroativo: consultoria sem linha tem a página desligada.
CREATE TABLE vitrine_configuracao (
    id             uuid PRIMARY KEY,
    consultoria_id uuid NOT NULL UNIQUE REFERENCES consultoria (id),
    codigo_publico varchar(64) NOT NULL,
    pagina_ligada  boolean NOT NULL DEFAULT false,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now(),
    versao         bigint NOT NULL DEFAULT 0,
    CONSTRAINT uq_vitrine_configuracao_codigo UNIQUE (codigo_publico)
);

-- B) Item marcado para aparecer na página. Só item DIGITAL pode (D10): a API recusa com 422; o CHECK é a rede de proteção do banco.
ALTER TABLE vitrine_item
    ADD COLUMN na_pagina_publica boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT ck_vitrine_item_pagina_so_digital CHECK (NOT na_pagina_publica OR tipo = 'DIGITAL');
