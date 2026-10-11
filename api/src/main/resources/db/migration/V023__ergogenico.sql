-- Medicação e ergogênicos da biblioteca da consultoria: só o que está no rótulo (nome, princípio ativo, concentração,
-- apresentação). Sem dose, ciclo, preço nem indicação: o sistema não interpreta nada. Visível só com ERGOGENICO_LER
-- (por padrão, só o Administrador, que tem acesso total); as permissões ficam no código (CatalogoPermissoes).
create table ergogenico (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  categoria varchar(20) not null check (categoria in ('INJETAVEL','ORAL','PEPTIDEO','MEDICAMENTO','OUTRO')),
  nome varchar(120) not null,
  nome_busca varchar(120) not null,
  principio_ativo varchar(160),
  principio_busca varchar(160) not null default '',  -- sem acento, para a busca
  concentracao varchar(40),                    -- texto como está na embalagem: "200 mg/ml", "5000 UI", "0,93%"
  apresentacao varchar(40),                    -- "10 ml", "50 caps"
  observacao varchar(500),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao bigint not null default 0
);
-- A mesma substância aparece com concentrações diferentes; ausente conta como vazio (null não repete no índice).
create unique index ux_ergogenico_nome on ergogenico
  (consultoria_id, nome_busca, coalesce(concentracao, ''), coalesce(apresentacao, '')) where ativo;
create index ix_ergogenico_categoria on ergogenico (consultoria_id, categoria) where ativo;
