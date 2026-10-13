-- Integração com a Central (docs/integracao-central.md, contrato-integracao-v1 seções 2.4, 5.1 e 7).
-- Tabelas GLOBAIS (sem @TenantId): o filtro de integração roda fora do contexto de qualquer consultoria.

-- Anti-repetição das chamadas assinadas: (chave, nonce) único; a limpeza apaga o que passou do dobro da janela.
create table integracao_nonce (
 chave_id varchar(80) not null, nonce varchar(128) not null, recebido_em timestamptz not null default now(),
 primary key (chave_id, nonce)
);
create index ix_integracao_nonce_recebido on integracao_nonce(recebido_em);

-- Provisionamento idempotente: a mesma Idempotency-Key com o mesmo corpo devolve a resposta gravada.
-- A resposta guardada NÃO leva o código de convite (segredo): ele só vai na primeira resposta.
create table integracao_operacao (
 idempotency_key uuid primary key, tipo varchar(40) not null, hash_corpo char(64) not null,
 status_http int not null, resposta jsonb not null, criado_em timestamptz not null default now()
);

-- Convite do primeiro administrador de uma consultoria criada pela Central: ainda não existe usuário para constar como
-- autor. criado_por nulo = convite do sistema (a chave estrangeira composta não é conferida com coluna nula).
alter table usuario_convite alter column criado_por drop not null;
