-- Biblioteca da consultoria (exercícios e alimentos), catálogos públicos e receitas.

create table exercicio (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  nome varchar(120) not null,
  grupo_muscular varchar(60),
  equipamento varchar(60),
  modalidade varchar(20) not null default 'MAQUINA'
    check (modalidade in ('LIVRE','MAQUINA','ELASTICO','PESO_CORPORAL','CARDIO','OUTRO')),
  video_url varchar(500),
  observacoes text,
  ativo boolean not null default true,
  origem varchar(20) not null default 'MANUAL' check (origem in ('MANUAL','CATALOGO','IMPORTACAO')),
  criado_em timestamptz not null default now(),
  versao bigint not null default 0
);
create unique index ux_exercicio_nome on exercicio (consultoria_id, lower(nome)) where ativo;

create table alimento (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  nome varchar(160) not null,
  base_quantidade numeric(8,2) not null default 100,
  base_unidade varchar(10) not null default 'g' check (base_unidade in ('g','ml','un')),
  kcal numeric(8,2) not null,
  proteina numeric(8,2) not null,
  carboidrato numeric(8,2) not null,
  gordura numeric(8,2) not null,
  gramas_por_unidade numeric(8,2),
  fonte varchar(200),
  ativo boolean not null default true,
  origem varchar(20) not null default 'MANUAL' check (origem in ('MANUAL','CATALOGO','IMPORTACAO')),
  criado_em timestamptz not null default now(),
  versao bigint not null default 0
);
create unique index ux_alimento_nome on alimento (consultoria_id, lower(nome)) where ativo;

create table catalogo_exercicio (     -- global, sem consultoria
  id uuid primary key,
  nome varchar(120) not null unique,
  grupo_muscular varchar(60),
  equipamento varchar(60),
  modalidade varchar(20) not null
);

create table catalogo_alimento (      -- global, sem consultoria
  id uuid primary key,
  nome varchar(160) not null unique,
  base_quantidade numeric(8,2) not null default 100,
  base_unidade varchar(10) not null default 'g',
  kcal numeric(8,2) not null,
  proteina numeric(8,2) not null,
  carboidrato numeric(8,2) not null,
  gordura numeric(8,2) not null,
  gramas_por_unidade numeric(8,2),
  fonte varchar(200) not null
);

create table receita (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  tipo varchar(20) not null check (tipo in ('SERIES','PLANO_TREINO','PLANO_DIETA')),
  nome varchar(120) not null,
  descricao varchar(400),
  conteudo jsonb not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  versao bigint not null default 0
);
create index ix_receita_consultoria on receita (consultoria_id, tipo, ordem);
