-- Financeiro, fase 2 (D11, docs/planos/financeiro-em-fases.md): a cobrança avulsa não é gerada duas vezes. O app manda um UUID por pedido
-- (`pedido_id`) e a API devolve o que já gerou em vez de repetir. A V087 não tinha coluna de parcela (a posição só estava no texto da
-- descrição), então ela nasce aqui junto com o pedido. Sem compatibilidade com o antigo: a avulsa de antes fica com as duas nulas.

-- 1. `pedido_id` (não é dado pessoal: só liga as cobranças de um mesmo pedido) e `parcela` (1 a 12), só da avulsa e sempre juntos.
ALTER TABLE cobranca_aluno ADD COLUMN pedido_id uuid;
ALTER TABLE cobranca_aluno ADD COLUMN parcela smallint;
ALTER TABLE cobranca_aluno
    ADD CONSTRAINT ck_cobranca_pedido_e_parcela CHECK (
        (pedido_id IS NULL AND parcela IS NULL)
        OR (tipo = 'AVULSA' AND pedido_id IS NOT NULL AND parcela IS NOT NULL AND parcela BETWEEN 1 AND 12));

-- 2. Um pedido gera cada parcela de cada aluno uma vez só, por consultoria (o mesmo UUID em outra consultoria não conflita).
--    Também serve à consulta "esta consultoria já tem cobranças deste pedido?" (prefixo consultoria_id, pedido_id).
CREATE UNIQUE INDEX ux_cobranca_avulsa_pedido ON cobranca_aluno (consultoria_id, pedido_id, aluno_id, parcela)
    WHERE pedido_id IS NOT NULL;
