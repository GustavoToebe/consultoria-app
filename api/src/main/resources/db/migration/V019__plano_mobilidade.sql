-- Plano de mobilidade do aluno: mesmo ciclo da dieta (rascunho + versões publicadas imutáveis), dentro da pasta.

create table plano_mobilidade (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  aluno_id uuid references aluno(id),
  titulo varchar(120) not null,
  inicio date,
  fim date,
  ativo boolean not null default false,
  rascunho jsonb not null,
  rascunho_alterado_em timestamptz not null default now(),
  versao_publicada int not null default 0,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  versao bigint not null default 0,
  pasta_id uuid references pasta_plano(id),
  arquivado boolean not null default false
);
create unique index ux_plano_mobilidade_ativo on plano_mobilidade (aluno_id) where ativo;
create index ix_plano_mobilidade_aluno on plano_mobilidade (consultoria_id, aluno_id, criado_em desc);
create index ix_plano_mobilidade_pasta on plano_mobilidade (consultoria_id, pasta_id);

create table plano_mobilidade_versao (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  plano_id uuid not null references plano_mobilidade(id),
  numero int not null,
  titulo varchar(120) not null,
  inicio date,
  fim date,
  conteudo jsonb not null,
  publicado_em timestamptz not null default now(),
  publicado_por uuid not null references usuario(id),
  unique (plano_id, numero)
);
create index ix_plano_mobilidade_versao_consultoria on plano_mobilidade_versao (consultoria_id, plano_id);
