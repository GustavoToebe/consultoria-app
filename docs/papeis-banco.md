# Papéis do banco: migrador e API

O consultoria-app usa o Postgres único da VPS (serviço próprio, sem porta publicada, `scram-sha-256`), num banco só dele, `consultoria`.
Quem altera o schema não é quem roda a API: uma falha ou injeção na API não cria, altera, apaga nem esvazia tabelas e não reescreve o
histórico do Flyway. Nenhuma API usa o superusuário.

## Papéis
- **`consultoria_migracao`** (migrador): dono do banco, do schema `public` e de todo objeto que o Flyway cria; também cria e é dono do schema
  `plataforma` (módulo de autenticação). Só roda migrations. Sem superusuário, sem criar papel nem banco.
- **`consultoria_app`** (API, `DB_USUARIO`): só `SELECT`, `INSERT`, `UPDATE`, `DELETE` nas tabelas e uso das sequências do `public` e do
  `plataforma`. Nenhum acesso aos históricos (`public.flyway_schema_history` e `plataforma.historico_migracao`). Sem `BYPASSRLS`: este banco
  não usa RLS (o isolamento é por `consultoria_id` na aplicação).
- Só os dois entram no banco `consultoria` (`REVOKE CONNECT ... FROM PUBLIC`), e eles não entram no banco de outro aplicativo.
  O superusuário (`postgres`) tem a senha em `/opt/ecossistema/postgres.env` (chmod 600), que nenhum aplicativo lê.

## Configuração
No perfil `docker` (produção), `application-docker.yml`:
- `MIGRATION_DB_USER` / `MIGRATION_DB_PASSWORD` (e `MIGRATION_DB_URL`, se a conexão for outra) alimentam `spring.flyway.*` e
  `plataforma.auth.migracao.*`; sem elas valem `DB_*` (um usuário só, como no `docker-compose.yml` local).
- `PLATAFORMA_PAPEL_APP` = `consultoria_app`: **obrigatória, sem valor padrão**. O módulo de autenticação dá a esse papel uso do schema
  `plataforma` e DML nas tabelas (menos `historico_migracao`), e o callback `afterMigrate__revogar_historico_do_app.sql` tira dele o acesso
  ao `flyway_schema_history`. Com API e Flyway no mesmo usuário (local), informe esse usuário: o callback o ignora.
- Fora do perfil `docker` (testes, dev) o placeholder é vazio e o callback não faz nada.

## O histórico do Flyway
O `ALTER DEFAULT PRIVILEGES` de `api/scripts/roles-banco.sql` dá DML ao app em toda tabela que o migrador cria, inclusive o
`flyway_schema_history`, que só nasce na primeira subida. O callback roda **a cada subida** (também sem migration nova) e fecha essa
porta, sem passo manual. O `plataforma.historico_migracao` o próprio módulo deixa fora dos grants. Papel informado que não existe falha
a subida.

## Criar o banco (VPS)
`deploy/postgres/criar-banco-app.sh consultoria` no repositório `central-api-back`: gera as duas senhas na própria VPS, cria o banco, aplica
uma cópia do `api/scripts/roles-banco.sql` (**mantenha as duas iguais**) e grava `DB_*`, `MIGRATION_DB_*` e `PLATAFORMA_PAPEL_APP` em
`/opt/ecossistema/consultoria.env`, sem imprimir nenhuma senha. Roda uma vez, antes da primeira subida da API.

## O que o teste garante
`PapeisBancoIntegrationTest` (Postgres 18 e 17): banco novo e vazio → `roles-banco.sql` → a **API sobe de verdade** (perfil `docker`) com o
migrador e o papel só de dados → o app é recusado nos dois históricos já na primeira subida e na segunda, lê, grava e apaga dados (inclusive
numa tabela criada depois só pelo migrador, com sequência), é recusado em `CREATE`, `ALTER`, `DROP` e `TRUNCATE` nos dois schemas e não
conecta no banco de outro aplicativo. Cobre também o callback: reabrir o histórico à mão é desfeito na subida seguinte; papel vazio ou
igual ao do Flyway não faz nada; papel inexistente falha.

## Cuidados
- Migration futura que cria função com `SECURITY DEFINER`, extensão ou objeto fora de `public`/`plataforma` precisa de revisão do grant.
- Reverter: apontar `DB_*` para o usuário migrador e deixar `PLATAFORMA_PAPEL_APP` igual a ele. Nada é apagado.
