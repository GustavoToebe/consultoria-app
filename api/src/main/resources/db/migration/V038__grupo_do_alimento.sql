-- Grupo do alimento da biblioteca ("Carnes e derivados", "Leite e derivados"...), para a lista de compras do aluno sair
-- agrupada (pedido do Gustavo em 28/10). Texto livre do treinador, opcional: nulo = sem grupo ("Outros itens").
-- A publicação da dieta copia o grupo do momento para o item da versão imutável, como os fatores.
ALTER TABLE alimento ADD COLUMN grupo varchar(60);

-- Os alimentos que vieram do catálogo público ganham o grupo do item de mesmo nome (sem diferença de maiúsculas e
-- espaços nas pontas), só quando há exatamente um item correspondente com grupo. Não sobrescreve nada (a coluna é
-- nova, mas o filtro fica para a regra ficar explícita). Alimento renomeado pelo treinador não casa e fica sem grupo.
update alimento as a
set grupo = left(btrim(c.grupo), 60)
from catalogo_alimento as c
where a.origem = 'CATALOGO'
  and a.grupo is null
  and lower(btrim(a.nome)) = lower(btrim(c.nome))
  and nullif(btrim(c.grupo), '') is not null
  and (select count(*) from catalogo_alimento as c2 where lower(btrim(c2.nome)) = lower(btrim(a.nome))) = 1;
