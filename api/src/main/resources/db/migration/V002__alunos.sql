-- Aluno da consultoria. "Ativo" (base da futura cobrança) é decisão do treinador; não depende de login.

create table aluno (
  id uuid primary key,
  consultoria_id uuid not null references consultoria(id),
  nome varchar(120) not null,
  email varchar(254),
  objetivo varchar(200),
  observacoes text,
  ativo boolean not null default true,
  inativado_em timestamptz,
  convite_hash char(64) unique,
  convite_expira_em timestamptz,
  usuario_id uuid unique references usuario(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao bigint not null default 0
);
create index ix_aluno_consultoria on aluno (consultoria_id, ativo, nome);
alter table usuario add constraint fk_usuario_aluno foreign key (aluno_id) references aluno(id);
