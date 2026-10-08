-- Todo plano de aluno passa a viver numa pasta. Os anteriores à V009 ganham uma pasta por aluno e período
-- (treino e dieta do mesmo período dividem a pasta), com o título do plano mais antigo do grupo.

create temporary table pasta_migrada on commit drop as
with orfaos as (
  select consultoria_id, aluno_id, titulo, inicio, fim, criado_em
    from plano_treino where pasta_id is null and aluno_id is not null
  union all
  select consultoria_id, aluno_id, titulo, inicio, fim, criado_em
    from plano_dieta where pasta_id is null and aluno_id is not null
)
select gen_random_uuid() as id, consultoria_id, aluno_id, inicio, fim,
       (array_agg(titulo order by criado_em))[1] as titulo,
       min(criado_em) as criado_em
  from orfaos
 group by consultoria_id, aluno_id, inicio, fim;

insert into pasta_plano (id, consultoria_id, aluno_id, titulo, inicio, fim, criado_em)
select id, consultoria_id, aluno_id, titulo, inicio, fim, criado_em from pasta_migrada;

update plano_treino p set pasta_id = m.id
  from pasta_migrada m
 where p.pasta_id is null and p.aluno_id = m.aluno_id and p.consultoria_id = m.consultoria_id
   and p.inicio is not distinct from m.inicio and p.fim is not distinct from m.fim;

update plano_dieta p set pasta_id = m.id
  from pasta_migrada m
 where p.pasta_id is null and p.aluno_id = m.aluno_id and p.consultoria_id = m.consultoria_id
   and p.inicio is not distinct from m.inicio and p.fim is not distinct from m.fim;
