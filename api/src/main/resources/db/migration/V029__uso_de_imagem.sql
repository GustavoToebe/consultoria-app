-- Autorização do aluno para a consultoria usar as fotos de evolução em imagem de divulgação.
-- Nulo = não autorizado. O treinador não grava esta coluna.
alter table aluno add column uso_de_imagem_autorizado_em timestamptz;
