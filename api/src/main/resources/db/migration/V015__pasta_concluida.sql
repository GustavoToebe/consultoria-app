-- Pasta de plano finalizada pelo treinador (o peso e a observação da finalização vão para o registro de peso).
alter table pasta_plano add column concluida_em timestamptz;
