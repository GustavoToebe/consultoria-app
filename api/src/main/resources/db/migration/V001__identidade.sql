-- Consultoria (cada treinador), usuários (login global), sessões e contador de login.

create table consultoria (
  id uuid primary key,
  nome varchar(120) not null,
  slug varchar(60) not null unique,
  lema varchar(160),
  cor_primaria varchar(7) not null default '#C62828' check (cor_primaria ~ '^#[0-9A-Fa-f]{6}$'),
  fonte_titulo varchar(20) not null default 'PADRAO' check (fonte_titulo in ('PADRAO','METAL')),
  tema_padrao varchar(10) not null default 'ESCURO' check (tema_padrao in ('ESCURO','CLARO')),
  logo bytea,
  logo_tipo varchar(20) check (logo_tipo in ('image/png','image/jpeg')),
  logo_versao int not null default 0,
  configuracao jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  versao bigint not null default 0
);

create table usuario (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  email varchar(254) not null,
  nome varchar(120) not null,
  senha_hash varchar(100) not null,
  papel varchar(20) not null check (papel in ('TREINADOR','ALUNO')),
  aluno_id uuid,                               -- FK adicionada na V002
  ativo boolean not null default true,
  credenciais_versao bigint not null default 0,
  criado_em timestamptz not null default now(),
  ultimo_login_em timestamptz
);
create unique index ux_usuario_email on usuario (lower(email));
create index ix_usuario_consultoria on usuario (consultoria_id);

create table refresh_token (
  id uuid primary key,
  usuario_id uuid not null references usuario(id) on delete cascade,
  token_hash char(64) not null unique,
  cliente varchar(10) not null check (cliente in ('WEB','NATIVO')),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  revogado_em timestamptz
);
create index ix_refresh_usuario on refresh_token (usuario_id);

-- Igual à Central (V016): uma linha por chave (hash com sal), janela fixa. IP e e-mail nunca em claro.
create table login_tentativa (
  chave varchar(100) primary key,
  janela_ate timestamptz not null,
  tentativas integer not null check (tentativas >= 1)
);
create index ix_login_tentativa_janela on login_tentativa (janela_ate);
