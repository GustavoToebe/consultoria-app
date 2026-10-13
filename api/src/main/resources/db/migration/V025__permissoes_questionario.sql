-- Permissões dos questionários de atualização (QUESTIONARIO_LER / QUESTIONARIO_ALTERAR; publicar, duplicar, arquivar,
-- excluir e definir o padrão ficam dentro de ALTERAR). O Administrador (acesso_total) recebe o catálogo inteiro sem linhas.

-- Perfis padrão que já existem: localizados pelo id determinístico da V018, nunca pelo nome. Perfil apagado é ignorado
-- (o join não acha) e perfil que o dono já editou só ganha o que falta.
insert into perfil_permissao(perfil_id, codigo)
select p.id, x.codigo
from consultoria c
join (values ('Treinador', 'QUESTIONARIO_LER'), ('Treinador', 'QUESTIONARIO_ALTERAR'),
             ('Nutricionista', 'QUESTIONARIO_LER'), ('Nutricionista', 'QUESTIONARIO_ALTERAR'),
             ('Assistente', 'QUESTIONARIO_LER')) as x(perfil, codigo) on true
join perfil p on p.id = md5(c.id::text || ':' || x.perfil)::uuid
on conflict do nothing;

-- Consultorias novas: a mesma função da V018, com as quatro listas inteiras e os códigos novos (o trigger da V018
-- chama a função pelo nome; não precisa ser recriado).
create or replace function criar_perfis_padrao(cid uuid) returns void language plpgsql as $$
begin
 insert into perfil(id,consultoria_id,nome,acesso_total,sistema)
 values (md5(cid::text || ':Administrador')::uuid,cid,'Administrador',true,true);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Treinador')::uuid,cid,'Treinador');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Treinador')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_CONVITE', 'ALUNO_SENSIVEL_LER', 'ALUNO_SENSIVEL_ALTERAR', 'REGISTRO_LER', 'PASTA_ALTERAR', 'TREINO_LER', 'TREINO_ALTERAR', 'TREINO_PUBLICAR', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER', 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR', 'QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR']);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Nutricionista')::uuid,cid,'Nutricionista');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Nutricionista')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_SENSIVEL_LER', 'REGISTRO_LER', 'TREINO_LER', 'DIETA_LER', 'DIETA_ALTERAR', 'DIETA_PUBLICAR', 'ATUALIZACAO_LER', 'ATUALIZACAO_RESPONDER', 'BIBLIOTECA_LER', 'BIBLIOTECA_ALTERAR', 'MODELO_LER', 'MODELO_ALTERAR', 'MODELO_APLICAR', 'QUESTIONARIO_LER', 'QUESTIONARIO_ALTERAR']);
 insert into perfil(id,consultoria_id,nome) values(md5(cid::text || ':Assistente')::uuid,cid,'Assistente');
 insert into perfil_permissao(perfil_id,codigo) select md5(cid::text || ':Assistente')::uuid, unnest(array['PAINEL_VER', 'ALUNO_LER', 'ALUNO_ALTERAR', 'ALUNO_CONVITE', 'TREINO_LER', 'DIETA_LER', 'BIBLIOTECA_LER', 'MODELO_LER', 'QUESTIONARIO_LER']);
end; $$;
