-- Cupom no suplemento (plano cupom-suplemento, C51): texto opcional de até 40 caracteres que o treinador guarda na
-- biblioteca e o aluno vê na dieta, junto do link. Nulo = sem cupom. O app não calcula nem aplica desconto.
ALTER TABLE suplemento
    ADD COLUMN cupom varchar(40);
