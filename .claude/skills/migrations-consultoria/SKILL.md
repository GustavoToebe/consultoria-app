---
name: migrations-consultoria
description: Lista de conferência de migration Flyway do consultoria-app (PostgreSQL 18, multi-tenant por consultoria_id). Use ao planejar, escrever ou revisar migration, tabela, coluna, índice, CHECK, FK, gatilho ou papel do banco.
---
# Migration do consultoria-app: lista de conferência

O `AGENTS.md` do repositório é a fonte e vence esta lista. Para tipo de coluna, índice e trava, use também a skill
`supabase-postgres-best-practices`, sem RLS, pooler nem auth do Supabase: aqui o isolamento é por `consultoria_id`.

## Onde e com que número
- SQL: `api/src/main/resources/db/migration/V0NN__assunto.sql`. Java: `api/src/main/java/db/migration/` (pacote
  `db.migration`, fora do `ArquiteturaTest`), com `consultoria_id` explícito em cada linha e a lógica estática e
  pública, para ter teste.
- Número: o próximo livre **olhando a pasta** e as outras frentes abertas (worktrees e branches podem já ter pegado
  o número). O Flyway roda sem `out-of-order`: a de número menor sai antes ou junto da maior.
- Nunca edite migration que já foi para a `main`. SQL gerado do catálogo (V002, V003, V030) não se edita à mão:
  fonte nova ou corrigida é migration nova, pelos scripts de `scripts/catalogo/`.

## Junto com a migration
- Suba o total em `FlywayMigrationIntegrationTest` e em `PapeisBancoIntegrationTest`.
- Atualize a linha "Migration nova" do `AGENTS.md` (total e uma frase do que ela faz).
- Coluna `char(n)` pede `@JdbcTypeCode(SqlTypes.CHAR)` na entidade.

## Desenho
- Tabela com dado de consultoria: `consultoria_id` not null, entidade com `@TenantId` e FK **composta** com
  `consultoria_id` (ex.: `(consultoria_id, aluno_id)`), para uma linha nunca apontar para outra consultoria.
- "Único quando preenchido" e "só um vivo por X" são índice único parcial, não regra só no service.
- Em tabela que já tem linhas: CHECK e FK novos com `NOT VALID` (e `VALIDATE` só se a mesma migration limpou os
  dados), para linha antiga não derrubar o deploy. Coluna nova not null vem com default ou preenchimento na mesma
  migration.
- A migration roda com `lock_timeout` de 60 s: se esperar uma trava, falha. Não contorne; reduza o que ela trava.
- Permissão nova: catálogo, as consultorias que já existem e o gatilho `consultoria_perfis_padrao_<assunto>` para as
  novas. Dado padrão por consultoria (perfil, questionário, modelo de mensagem) segue o mesmo par: insert para as
  existentes e gatilho em `consultoria` para as novas.

## Papéis
O Flyway roda como `consultoria_migracao` (dono) e a API como `consultoria_app` (só dados). Confira em
`docs/papeis-banco.md` e em `api/scripts/roles-banco.sql` como a tabela nova chega ao papel do app; o
`PapeisBancoIntegrationTest` é a prova. O callback `afterMigrate__revogar_historico_do_app.sql` fecha o
`flyway_schema_history` ao app.

## Dados
- Sem compatibilidade com formato antigo até o primeiro cliente: pode apagar, renomear e alterar, sem código de
  transição. Isso não autoriza apagar dado de produção sem o Gustavo pedir.
- Nada de dado real na migration nem no seed. Id de consultoria fixo só nos casos já documentados (V059, V073).

## Teste e publicação
- Migration com lógica (Java, preenchimento, limpeza) ganha um `...MigrationTest` com dados fictícios.
- `mvn verify` em `api/` (Postgres 18; o 17 só à mão, ao subir a biblioteca).
- Migration fica fora do lote de integração: vai em PR separado, para acompanhar e desfazer sozinha. Push na `main`
  publica produção e só acontece a pedido do Gustavo.
