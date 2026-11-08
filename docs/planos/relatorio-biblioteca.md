# Relatório — biblioteca unificada

Frente 1, para o commit local na branch `biblioteca-unificada`. Sem push.

## O que ficou

Suplemento deixou de ser tabela e rota. `Suplemento.java`, `SuplementoController`, `SuplementoService`, `SuplementoRepository` e `SuplementoDtos` foram removidos. A V061 copia `suplemento` para `alimento` com `tipo = SUPLEMENTO` (mesmo id, marca, link, cupom, sabores, porção e `nome_busca`; kcal e macros nulos; base 100 g só para a coluna) e apaga a tabela.

`GET /alimentos` sem `tipo` continua só ALIMENTO. Suplemento é `GET /alimentos?tipo=SUPLEMENTO`. O app usa essa rota; a aba Suplementos da Biblioteca ficou no filtro da aba Alimentos.

O Whey do rótulo entra em `garantirSuplementosPadrao`: nome "Whey Protein", sem marca, 30 g, 124 kcal, carboidrato 2,3 g, proteína 24 g, gordura 2,1 g, porção "30 g (2 dosadores)", cerca de 33 porções. Nome que já existe não é alterado. Editar o suplemento sem mandar kcal preserva o que está gravado.

`SuplementoIntegrationTest` passou a falar com `/alimentos?tipo=SUPLEMENTO` e confere o Whey e a ausência da tabela. `BibliotecaUnificadaMigrationTest` migra um segundo banco até a V060, grava suplemento e alimento, aplica a V061 e confere a cópia, o `consultoria_id`, Creatina ativa como ALIMENTO e como SUPLEMENTO, o mesmo `nome_busca` em outra consultoria, suplemento inativo com o mesmo `nome_busca` e a recusa de ALIMENTO com kcal nula (`alimento_kcal_obrigatoria_check`).

Totais do Flyway desta frente: 61 (`FlywayMigrationIntegrationTest` e `PapeisBancoIntegrationTest`). A V062 das dietas fica fora deste commit.

`mvn verify` em `api/` em 07/11/2026: BUILD SUCCESS em 12 min 50 s, 2151 testes, 0 falhas, JaCoCo no mínimo. A árvore testada ainda tinha a V062 (62 migrations); o commit desta frente grava o total 61.

## V059 editada

A V059 já rodou em produção em 05/11/2026. O código dela foi editado nesta frente: "suplemento" saiu da lista `DA_CONSULTORIA` (e do conjunto `IGUAIS` do teste). Desde a V061 o suplemento é alimento com tipo SUPLEMENTO, e o delete de `alimento` cobre a linha. A V059 estende `BaseJavaMigration` sem `getChecksum()`: o checksum gravado é nulo e o Flyway não o confere. Não há repair nem risco de checksum. O risco que sobra, ao restaurar um dump anterior a 05/11, é só a FK de `suplemento` na V059. A regra de sem compatibilidade cobre.

## Fora deste commit

As 11 dietas estão na V062, em commit à parte, sem push. Semanas, Dias e Mobilidades não estão nesta branch.
