-- Registros do aluno (séries feitas) e peso.

create table execucao_serie (
  id uuid primary key,                         -- gerado no aparelho
  consultoria_id uuid not null references consultoria(id),
  aluno_id uuid not null references aluno(id),
  plano_versao_id uuid not null references plano_treino_versao(id),
  sessao_uid uuid not null,
  exercicio_uid uuid not null,
  serie_uid uuid not null,
  exercicio_id uuid,                           -- biblioteca (histórico entre planos); vem da versão, não do cliente
  -- Série de trabalho (intensidade CARGA_TRABALHO) naquela versão; também vem da versão. Base da "última carga"
  -- sugerida ao aluno e do progresso, sem reabrir o JSON de cada versão.
  serie_trabalho boolean not null default false,
  data date not null,
  carga numeric(7,2) check (carga is null or (carga >= 0 and carga <= 2000)),
  unidade varchar(10) not null default 'kg',
  repeticoes int check (repeticoes is null or (repeticoes between 0 and 500)),
  concluida boolean not null default false,
  observacao varchar(500),
  alterado_no_aparelho_em timestamptz not null,
  recebido_em timestamptz not null default now(),
  unique (aluno_id, plano_versao_id, serie_uid, data)
);
create index ix_exec_aluno_data on execucao_serie (consultoria_id, aluno_id, data desc);
create index ix_exec_aluno_exercicio on execucao_serie (aluno_id, exercicio_id, data desc);
create index ix_exec_consultoria_recebido on execucao_serie (consultoria_id, recebido_em desc);

create table registro_peso (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  aluno_id uuid not null references aluno(id),
  data date not null,
  peso_kg numeric(5,2) not null check (peso_kg > 0 and peso_kg < 500),
  observacao varchar(300),
  registrado_por uuid not null references usuario(id),
  criado_em timestamptz not null default now(),
  unique (aluno_id, data)
);
create index ix_peso_consultoria on registro_peso (consultoria_id, aluno_id, data desc);
