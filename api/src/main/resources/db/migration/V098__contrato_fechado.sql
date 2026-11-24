-- Contrato fechado (Fase 1, docs/planos/contrato-fechado.md): a contratação ganha o modo de cobrança e o valor total do contrato; a
-- entrada, as parcelas e os pagamentos do saldo são cobranças AVULSA e RENEGOCIACAO ligadas à contratação, e o acordo de parcelas do
-- contrato é marcado com a contratação. Sem compatibilidade com o antigo (ainda não há cliente real). As tabelas já têm linhas
-- (cobranca_aluno é grande), então os CHECKs e as FKs novos entram NOT VALID: valem para o que for gravado daqui em diante, sem varrer
-- a tabela sob trava. Todos relaxam ou acrescentam regra que as linhas antigas já cumprem (nenhuma tem contratação em AVULSA ou
-- RENEGOCIACAO, nem modo diferente do padrão), por isso não há VALIDATE.

-- 1. Contratação: modo de cobrança (RECORRENTE é o de sempre) e valor total, só nos modos fechados. `valor_centavos` (já > 0) recebe o
--    valor total no modo fechado.
ALTER TABLE contratacao_aluno
    ADD COLUMN modo_cobranca varchar(14) NOT NULL DEFAULT 'RECORRENTE',
    ADD COLUMN valor_total_centavos bigint,
    ADD CONSTRAINT ck_contratacao_modo CHECK (modo_cobranca IN ('RECORRENTE', 'PARCELADO_FIXO', 'SALDO_ABERTO')) NOT VALID,
    ADD CONSTRAINT ck_contratacao_valor_total CHECK (
        (modo_cobranca = 'RECORRENTE' AND valor_total_centavos IS NULL)
        OR (modo_cobranca <> 'RECORRENTE' AND valor_total_centavos IS NOT NULL AND valor_total_centavos > 0)) NOT VALID;

-- 2. Cobrança: AVULSA e RENEGOCIACAO podem ter contratação (a entrada, as parcelas e os pagamentos do saldo do contrato). A competência
--    segue nula nelas; a mensalidade e a saída seguem exigindo contratação e competência. O nome da constraint não muda (testes e
--    mensagens a conhecem). `ck_cobranca_descricao_so_avulsa`, `ck_cobranca_pedido_e_parcela` e `ck_cobranca_acordo` não mudam: a
--    descrição obrigatória, o pedido e a parcela só da AVULSA e o acordo junto de RENEGOCIACAO/RENEGOCIADA continuam valendo. A FK
--    composta `fk_cobranca_contratacao` (consultoria, contratacao, aluno) já garante que a contratação é do mesmo aluno e da consultoria.
ALTER TABLE cobranca_aluno DROP CONSTRAINT ck_cobranca_contratacao_so_avulsa;
ALTER TABLE cobranca_aluno
    ADD CONSTRAINT ck_cobranca_contratacao_so_avulsa CHECK (
        (tipo IN ('AVULSA', 'RENEGOCIACAO') AND competencia IS NULL)
        OR (tipo NOT IN ('AVULSA', 'RENEGOCIACAO') AND contratacao_id IS NOT NULL AND competencia IS NOT NULL)) NOT VALID;

-- 3. Acordo: o do contrato carrega a contratação (FK composta, MATCH SIMPLE: nula nos acordos de renegociação) e não renegocia nada
--    (`renegociadas = 0`); o de renegociação segue com 1 a 100. Um acordo por contratação, no máximo.
ALTER TABLE acordo_de_cobranca
    ADD COLUMN contratacao_id uuid,
    ADD CONSTRAINT fk_acordo_contratacao FOREIGN KEY (consultoria_id, contratacao_id, aluno_id)
        REFERENCES contratacao_aluno (consultoria_id, id, aluno_id) NOT VALID;
ALTER TABLE acordo_de_cobranca DROP CONSTRAINT ck_acordo_renegociadas;
ALTER TABLE acordo_de_cobranca
    ADD CONSTRAINT ck_acordo_renegociadas CHECK (
        (contratacao_id IS NULL AND renegociadas BETWEEN 1 AND 100)
        OR (contratacao_id IS NOT NULL AND renegociadas = 0)) NOT VALID;
CREATE UNIQUE INDEX ux_acordo_contratacao ON acordo_de_cobranca (consultoria_id, contratacao_id) WHERE contratacao_id IS NOT NULL;

-- 4. "As cobranças ligadas ao contrato" (bloco do contrato, pagamento do saldo, encerrar): `ix_cobranca_contratacao`
--    (consultoria, contratacao, competencia) já serve ao prefixo; "alunos em atraso" usa `ix_cobranca_fila` (consultoria, situacao,
--    vencimento). Nenhum índice novo em cobranca_aluno.
