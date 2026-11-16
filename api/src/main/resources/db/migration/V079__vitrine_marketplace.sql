-- Vitrine entre consultorias (marketplace sem comissão), fase F3.1 do plano docs/planos/vitrine-e-loja.md (D15): opt-in duplo.
-- A consultoria entra (vitrine_configuracao) e escolhe os itens (vitrine_item); os dois começam em falso, sem preenchimento
-- retroativo. A V078 está reservada a outra frente; esta é a V079.
-- shortcut: sem índice parcial em vitrine_configuracao (uma linha por consultoria); criar um (no_marketplace and pagina_ligada) se
-- a tabela passar de alguns milhares de linhas.

ALTER TABLE vitrine_configuracao
    ADD COLUMN no_marketplace boolean NOT NULL DEFAULT false;

-- Só item DIGITAL vai ao marketplace (mesma regra da página pública, V077): a API recusa com 422; o CHECK é a rede de proteção.
-- Estar também na página pública (na_pagina_publica) é conferido na consulta, não aqui: desmarcar a página não pode falhar.
ALTER TABLE vitrine_item
    ADD COLUMN no_marketplace boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT ck_vitrine_item_marketplace_so_digital CHECK (NOT no_marketplace OR tipo = 'DIGITAL');
