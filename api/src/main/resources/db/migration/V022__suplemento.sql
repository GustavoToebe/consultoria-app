-- Suplementos da biblioteca da consultoria: só nome, marca, categoria, porção, sabores e link. Nada de valor
-- nutricional, preço ou efeito: o suplemento não entra na soma da dieta (a "Sugestão de suplementação" não calcula nada).
create table suplemento (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  nome varchar(120) not null,
  nome_busca varchar(120) not null,
  marca varchar(80),
  categoria varchar(60),
  porcao varchar(80),
  porcoes_por_embalagem varchar(40),           -- texto: vem "cerca de 26"
  sabores jsonb not null default '[]'::jsonb,
  link varchar(500),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao bigint not null default 0
);
-- Único entre os ativos, como exercício e alimento: excluir (inativar) libera o nome.
create unique index ux_suplemento_nome on suplemento (consultoria_id, nome_busca) where ativo;
create index ix_suplemento_categoria on suplemento (consultoria_id, categoria) where ativo;
