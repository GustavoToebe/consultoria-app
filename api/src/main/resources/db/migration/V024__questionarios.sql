-- Questionários de atualização por consultoria: rascunho + versões publicadas imutáveis.
-- A tabela global atualizacao_modelo vira só a "fábrica" (fonte do questionário Padrão e de "novo a partir do padrão").
create table questionario (
 id uuid primary key, consultoria_id uuid not null references consultoria(id),
 nome varchar(120) not null, descricao varchar(400),
 padrao boolean not null default false, arquivado boolean not null default false,
 rascunho jsonb not null, rascunho_alterado_em timestamptz not null default now(),
 versao_publicada integer not null default 0, publicado_em timestamptz,
 criado_em timestamptz not null default now(), versao bigint not null default 0,
 unique (consultoria_id, id),
 check (not padrao or (not arquivado and versao_publicada > 0))
);
create unique index ux_questionario_padrao on questionario(consultoria_id) where padrao;
create unique index ux_questionario_nome on questionario(consultoria_id, lower(nome)) where not arquivado;

create table questionario_versao (
 id uuid primary key, consultoria_id uuid not null references consultoria(id),
 questionario_id uuid not null, numero integer not null, conteudo jsonb not null,
 publicado_em timestamptz not null default now(), publicado_por uuid,
 unique (questionario_id, numero), unique (consultoria_id, id),
 foreign key (consultoria_id, questionario_id) references questionario(consultoria_id, id) on delete cascade
);
create function questionario_versao_imutavel() returns trigger language plpgsql as $$
begin raise exception 'Versão publicada de questionário não pode ser alterada.' using errcode = 'integrity_constraint_violation'; end; $$;
create trigger questionario_versao_imutavel before update on questionario_versao
 for each row execute function questionario_versao_imutavel();

-- Fábrica v2: o questionário v1 no formato novo (mesmos ids de pergunta; uid nas seções; destaques do resumo do
-- treinador; ajuda automática da média de dias de treino).
insert into atualizacao_modelo(id, versao, conteudo)
select 'b4c3e9d2-5a07-4b6e-9c11-2f7d6a8e1c42'::uuid, 2,
 jsonb_build_object(
  'formato', 2,
  'instrucoes', m.conteudo->'instrucoes',
  'secoes', (
   select jsonb_agg(jsonb_build_object(
     'uid', 'secao-' || s.ord,
     'titulo', s.sec->'titulo',
     'perguntas', (
      select jsonb_agg(p.item || coalesce(x.extras->(p.item->>'id'), '{}'::jsonb) order by p.ord)
      from jsonb_array_elements(s.sec->'perguntas') with ordinality as p(item, ord))
    ) order by s.ord)
   from jsonb_array_elements(m.conteudo->'secoes') with ordinality as s(sec, ord)))
from atualizacao_modelo m,
 (select '{"sono": {"destaque": true, "rotuloCurto": "Sono"},
           "alim_desempenho": {"destaque": true, "rotuloCurto": "Alimentar"},
           "treino_desempenho": {"destaque": true, "rotuloCurto": "Treino"},
           "treino_dias": {"ajudaAutomatica": "MEDIA_DIAS_TREINO"}}'::jsonb as extras) x
where m.versao = 1;

-- Executado também na criação de consultoria (como criar_perfis_padrao): sem padrão a atualização daria 404.
create function criar_questionario_padrao(cid uuid) returns void language plpgsql as $$
declare modelo jsonb;
begin
 select conteudo into modelo from atualizacao_modelo order by versao desc limit 1;
 insert into questionario(id,consultoria_id,nome,descricao,padrao,rascunho,versao_publicada,publicado_em)
 values (md5(cid::text || ':questionario-padrao')::uuid,cid,'Padrão','Questionário de atualização padrão da consultoria.',true,modelo,1,now());
 insert into questionario_versao(id,consultoria_id,questionario_id,numero,conteudo)
 values (md5(cid::text || ':questionario-padrao:1')::uuid,cid,md5(cid::text || ':questionario-padrao')::uuid,1,modelo);
end; $$;
select criar_questionario_padrao(id) from consultoria;
create function consultoria_questionario_padrao() returns trigger language plpgsql as $$
begin perform criar_questionario_padrao(new.id); return new; end; $$;
create trigger consultoria_questionario_padrao after insert on consultoria
 for each row execute function consultoria_questionario_padrao();

-- Atualização: passa a apontar para a versão publicada que foi respondida (fixada no envio).
do $$ begin
 if exists (select 1 from atualizacao where modelo_versao <> 1) then
  raise exception 'Atualização com modelo diferente da v1: migrar à mão antes de aplicar a V024.';
 end if;
end $$;
alter table atualizacao add column questionario_versao_id uuid;
update atualizacao set questionario_versao_id = md5(consultoria_id::text || ':questionario-padrao:1')::uuid
 where estado <> 'ABERTA';
alter table atualizacao add constraint fk_atualizacao_questionario_versao
 foreign key (consultoria_id, questionario_versao_id) references questionario_versao(consultoria_id, id);
alter table atualizacao add constraint ck_atualizacao_versao_no_envio
 check (estado = 'ABERTA' or questionario_versao_id is not null);
alter table atualizacao drop column modelo_versao;
create index ix_atualizacao_questionario_versao on atualizacao(questionario_versao_id);

-- Escolha do questionário: no aluno e, só para um período, na pasta (nulo = usa o do aluno / o padrão).
alter table aluno add column questionario_id uuid;
alter table aluno add constraint fk_aluno_questionario
 foreign key (consultoria_id, questionario_id) references questionario(consultoria_id, id) on delete set null (questionario_id);
alter table pasta_plano add column questionario_id uuid;
alter table pasta_plano add constraint fk_pasta_questionario
 foreign key (consultoria_id, questionario_id) references questionario(consultoria_id, id) on delete set null (questionario_id);
