-- Perfis da consultoria, convites da equipe e auditoria. Sem conteúdo sensível.
create table perfil (
 id uuid primary key, consultoria_id uuid not null references consultoria(id),
 nome varchar(120) not null, descricao varchar(500), acesso_total boolean not null default false,
 sistema boolean not null default false, ativo boolean not null default true,
 versao bigint not null default 0, criado_em timestamptz not null default now(),
 unique (consultoria_id, id), check (not sistema or (acesso_total and ativo))
);
create unique index ux_perfil_nome on perfil(consultoria_id, lower(nome));
create table perfil_permissao (
 perfil_id uuid not null references perfil(id) on delete cascade,
 codigo varchar(60) not null, primary key(perfil_id, codigo)
);

-- Executado também na criação de consultoria: o usuário nasce com perfil obrigatório,
-- mesmo no cadastro público e no seed, antes de haver uma sessão com tenant.
create function criar_perfis_padrao(cid uuid) returns void language plpgsql as $$
begin
 insert into perfil(id,consultoria_id,nome,acesso_total,sistema)
 values (md5(cid::text || ':Administrador')::uuid,cid,'Administrador',true,true);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Treinador')::uuid,cid,'Treinador');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Treinador')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_CONVITE', 'ALUNO_SENSIVEL_LER', 'ALUNO_SENSIVEL_ALTERAR', 'REGISTRO_LER', 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER', 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR']);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Nutricionista')::uuid,cid,'Nutricionista');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Nutricionista')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_SENSIVEL_LER', 'REGISTRO_LER', 'TREINO_LER', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER', 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR']);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Assistente')::uuid,cid,'Assistente');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Assistente')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_CONVITE', 'TREINO_LER', 'DIETA_LER', 'BIBLIOTECA_LER', 'MODELO_LER']);
end; $$;
select criar_perfis_padrao(id) from consultoria;
create function consultoria_perfis_padrao() returns trigger language plpgsql as $$
begin perform criar_perfis_padrao(new.id); return new; end; $$;
create trigger consultoria_perfis_padrao after insert on consultoria
 for each row execute function consultoria_perfis_padrao();

alter table usuario add column perfil_id uuid;
alter table usuario add column telefone varchar(20);
update usuario set perfil_id=md5(consultoria_id::text || ':Administrador')::uuid where papel='TREINADOR';
alter table usuario add constraint fk_usuario_perfil foreign key(consultoria_id,perfil_id) references perfil(consultoria_id,id);
alter table usuario add constraint ck_usuario_perfil check
 ((papel='TREINADOR' and perfil_id is not null) or (papel='ALUNO' and perfil_id is null));
create function usuario_perfil_inicial() returns trigger language plpgsql as $$
begin
 if new.papel='TREINADOR' and new.perfil_id is null then
   new.perfil_id=md5(new.consultoria_id::text || ':Administrador')::uuid;
 end if;
 return new;
end; $$;
create trigger usuario_perfil_inicial before insert on usuario
 for each row execute function usuario_perfil_inicial();

alter table usuario add constraint ux_usuario_consultoria_id unique(consultoria_id,id);
alter table aluno add column responsavel_id uuid;
alter table aluno add constraint fk_aluno_responsavel foreign key(consultoria_id,responsavel_id) references usuario(consultoria_id,id);
update aluno a set responsavel_id=(select u.id from usuario u
 where u.consultoria_id=a.consultoria_id and u.papel='TREINADOR' order by u.criado_em,u.id limit 1);

create table usuario_convite (
 id uuid primary key, consultoria_id uuid not null references consultoria(id),
 email varchar(254) not null, nome varchar(120) not null, perfil_id uuid not null,
 codigo_hash char(64) not null unique, expira_em timestamptz not null,
 usado_em timestamptz, criado_por uuid not null, criado_em timestamptz not null default now(),
 foreign key(consultoria_id,perfil_id) references perfil(consultoria_id,id),
 foreign key(consultoria_id,criado_por) references usuario(consultoria_id,id)
);
create index ix_usuario_convite_consultoria_email on usuario_convite(consultoria_id,lower(email));
create table auditoria (
 id uuid primary key, consultoria_id uuid not null references consultoria(id),
 usuario_id uuid, acao varchar(60) not null, entidade varchar(40) not null,
 entidade_id uuid, resumo varchar(300) not null, ip varchar(45), user_agent varchar(200),
 criado_em timestamptz not null default now(),
 foreign key(consultoria_id,usuario_id) references usuario(consultoria_id,id)
);
create index ix_auditoria_consultoria_data on auditoria(consultoria_id,criado_em desc);
