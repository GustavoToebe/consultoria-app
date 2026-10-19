-- Fator de correção e fator de cocção do alimento (reunião de 17/10, itens R13/R14/R32: lista de compras do aluno).
-- FC = peso bruto ÷ peso líquido (casca, osso, aparas); FCc = peso pronto ÷ peso cru. Os dois são dado da consultoria:
-- o treinador digita os que usa. Nenhuma tabela de terceiros entra aqui (direitos autorais). Nulo = não informado, e
-- nunca vira 1: sem fator, a lista de compras usa a quantidade da dieta como está.
ALTER TABLE alimento ADD COLUMN fator_correcao numeric(5,2)
    CONSTRAINT alimento_fator_correcao_check CHECK (fator_correcao BETWEEN 1.00 AND 20.00);
ALTER TABLE alimento ADD COLUMN fator_coccao numeric(5,2)
    CONSTRAINT alimento_fator_coccao_check CHECK (fator_coccao BETWEEN 0.10 AND 10.00);
