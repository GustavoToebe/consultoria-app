-- Histórico de lesões do aluno (dado sensível, LGPD): o treinador registra; o sistema não interpreta.

create table lesao_aluno (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  aluno_id uuid not null references aluno(id),
  regiao varchar(80) not null,
  descricao varchar(500),
  data_inicio date,
  data_fim date,
  situacao varchar(20) not null check (situacao in ('ATIVA', 'EM_RECUPERACAO', 'RECUPERADA')),
  observacao varchar(500),
  registrado_por uuid not null references usuario(id),
  criado_em timestamptz not null default now(),
  check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);
create index ix_lesao_aluno on lesao_aluno (consultoria_id, aluno_id, data_inicio desc nulls last);
