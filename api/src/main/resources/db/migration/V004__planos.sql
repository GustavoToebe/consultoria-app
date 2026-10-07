-- Planos de treino e de dieta: rascunho editável + versões publicadas imutáveis.

create table plano_treino (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  aluno_id uuid references aluno(id),          -- null = modelo reutilizável
  titulo varchar(120) not null,
  inicio date,
  fim date,
  ativo boolean not null default false,        -- plano vigente do aluno
  rascunho jsonb not null,
  rascunho_alterado_em timestamptz not null default now(),
  versao_publicada int not null default 0,     -- 0 = nunca publicado
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  versao bigint not null default 0
);
create unique index ux_plano_treino_ativo on plano_treino (aluno_id) where ativo;
create index ix_plano_treino_aluno on plano_treino (consultoria_id, aluno_id, criado_em desc);

create table plano_treino_versao (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  plano_id uuid not null references plano_treino(id),
  numero int not null,
  titulo varchar(120) not null,
  inicio date,
  fim date,
  conteudo jsonb not null,
  publicado_em timestamptz not null default now(),
  publicado_por uuid not null references usuario(id),
  unique (plano_id, numero)
);
create index ix_plano_treino_versao_consultoria on plano_treino_versao (consultoria_id, plano_id);

create table plano_dieta (
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
  versao bigint not null default 0
);
create unique index ux_plano_dieta_ativo on plano_dieta (aluno_id) where ativo;
create index ix_plano_dieta_aluno on plano_dieta (consultoria_id, aluno_id, criado_em desc);

create table plano_dieta_versao (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  plano_id uuid not null references plano_dieta(id),
  numero int not null,
  titulo varchar(120) not null,
  inicio date,
  fim date,
  conteudo jsonb not null,
  publicado_em timestamptz not null default now(),
  publicado_por uuid not null references usuario(id),
  unique (plano_id, numero)
);
create index ix_plano_dieta_versao_consultoria on plano_dieta_versao (consultoria_id, plano_id);
