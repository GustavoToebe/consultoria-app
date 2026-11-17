-- Macros opcionais no alimento (D15, plano docs/planos/dieta-pronta-para-comecar.md): alimento comum novo sem os três macros
-- fica sem kcal ("—", ausência nunca vira zero). O CHECK da V061 só tinha essa regra (suplemento OU kcal não nula); a coluna
-- já aceita nulo (a V061 tirou o NOT NULL), então derrubar o CHECK basta. A faixa de kcal continua no DTO e no servidor.
ALTER TABLE alimento DROP CONSTRAINT alimento_kcal_obrigatoria_check;
