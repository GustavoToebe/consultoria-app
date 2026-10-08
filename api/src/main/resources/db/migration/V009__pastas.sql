-- Pastas de plano: agrupam treinos e dietas do aluno e definem o período que vale para todos.

create table pasta_plano (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  aluno_id uuid not null references aluno(id),
  titulo varchar(120) not null,
  inicio date,
  fim date,
  criado_em timestamptz not null default now()
);
create index ix_pasta_plano_aluno on pasta_plano (consultoria_id, aluno_id, criado_em desc);

alter table plano_treino add column pasta_id uuid references pasta_plano(id);
alter table plano_dieta add column pasta_id uuid references pasta_plano(id);
create index ix_plano_treino_pasta on plano_treino (consultoria_id, pasta_id);
create index ix_plano_dieta_pasta on plano_dieta (consultoria_id, pasta_id);
