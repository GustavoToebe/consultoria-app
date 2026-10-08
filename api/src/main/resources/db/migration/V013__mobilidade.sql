-- Modelos de mobilidade e alongamento (lista de itens com prescrição e link de vídeo).
alter table receita drop constraint receita_tipo_check;
alter table receita add constraint receita_tipo_check check (tipo in
 ('SERIES','PLANO_TREINO','PLANO_DIETA','METODOLOGIA','SESSAO_TREINO','REFEICAO','PASTA_PLANO','MOBILIDADE'));
