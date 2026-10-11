-- Histórico e consultas por aluno (painel e listas de atualizações).
create index ix_atualizacao_aluno on atualizacao (aluno_id);
