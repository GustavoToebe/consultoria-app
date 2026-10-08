-- Dias do ciclo de atualização do aluno: sugere o período ao criar uma pasta de plano.
alter table aluno add column dias_atualizacao integer check (dias_atualizacao between 1 and 365);
