-- Modelos reutilizáveis e remoção sem apagar versões publicadas.
alter table receita drop constraint receita_tipo_check;
alter table receita add constraint receita_tipo_check check (tipo in
 ('SERIES','PLANO_TREINO','PLANO_DIETA','METODOLOGIA','SESSAO_TREINO','REFEICAO','PASTA_PLANO'));
create table pasta_modelo (
 id uuid primary key, consultoria_id uuid not null references consultoria(id),
 nome varchar(120) not null, versao bigint not null default 0,
 unique (id, consultoria_id)
);
alter table receita add column pasta_id uuid;
alter table receita add constraint fk_receita_pasta foreign key (pasta_id, consultoria_id)
 references pasta_modelo(id, consultoria_id);
alter table plano_treino add column arquivado boolean not null default false;
alter table plano_dieta add column arquivado boolean not null default false;
alter table pasta_plano add column arquivado boolean not null default false;
insert into receita(id,consultoria_id,tipo,nome,descricao,conteudo,ordem)
 select gen_random_uuid(),id,'METODOLOGIA','Metodologia da consultoria',
 'Regras existentes, copiadas para o Planejamento.',configuracao,0 from consultoria;
-- Só modelos editáveis recebem a referência; nenhum plano publicado é reescrito.
update receita r set conteudo=r.conteudo || jsonb_build_object('metodologia',
 jsonb_build_object('id',m.id,'nome',m.nome,'configuracao',m.conteudo))
 from receita m where r.tipo='PLANO_TREINO' and m.tipo='METODOLOGIA'
 and r.consultoria_id=m.consultoria_id and not (r.conteudo ? 'metodologia');
