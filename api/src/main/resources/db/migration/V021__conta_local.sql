-- "Minha conta" pré-montada, sem ligação com a Central: plano, dados comerciais e cobranças ficam em tabelas locais
-- e, na integração, só a fonte dos dados muda (docs/integracao-central.md). Formato igual ao contrato da Central
-- (seções 6.3 e 7). Tabelas GLOBAIS, sem @TenantId: o filtro de integração lê fora do contexto da consultoria, então
-- toda leitura filtra consultoria_id explicitamente. Nada é bloqueado por elas hoje: só Minha conta e Consumo as leem.
create table direitos_locais (
 consultoria_id uuid primary key references consultoria(id),
 contratacao_id uuid not null, versao bigint not null,
 situacao varchar(20) not null check (situacao in ('TRIAL','ATIVA','INADIMPLENTE','BLOQUEADA','CANCELADA')),
 acesso_liberado boolean not null, motivo_bloqueio varchar(300), vigente_ate date,
 plano_codigo varchar(60) not null, plano_nome varchar(120) not null,
 limites jsonb not null default '{}'::jsonb, funcionalidades text[] not null default '{}',
 confirmado_em timestamptz not null, atualizado_em timestamptz not null default now()
);
-- cliente e contratacao guardam o JSON da seção 6.3 do contrato como veio (documento, CEP e telefone já formatados).
create table conta_comercial_local (
 consultoria_id uuid primary key references consultoria(id),
 cliente jsonb not null, contratacao jsonb not null, atualizado_em timestamptz not null default now()
);
create table cobranca_local (
 id uuid primary key, consultoria_id uuid not null references consultoria(id),
 competencia_inicio date not null, competencia_fim date not null, vencimento date not null,
 valor numeric(12,2) not null check (valor >= 0),
 situacao varchar(10) not null check (situacao in ('ABERTA','PAGA','CANCELADA','ISENTA')),
 pago_em date, check (competencia_fim >= competencia_inicio)
);
create index ix_cobranca_local_consultoria on cobranca_local(consultoria_id, competencia_inicio desc);
