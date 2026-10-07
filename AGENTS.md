# AGENTS.md — Saraiva-api (plataforma de treinos e dieta)

Plataforma para **vários treinadores**, cada um com sua consultoria isolada, montarem treino e dieta dos alunos.
O aluno vê o plano e registra carga e repetições no celular ou na web, inclusive sem internet. O Saraiva
(Saraiva Team) é o primeiro treinador. Idioma do código, comentários, mensagens de erro, interface e commits:
**português**.

- Plano de execução (fases, rotas, banco, telas): `PLANO-IMPLEMENTACAO.md`. Contexto de negócio:
  `DIRECIONAMENTO-APP-TREINOS.md` (onde conflitar, vale a seção 1.2 do plano).
- Padrões de segurança copiados da Central (`central-api-back`) e do Servirea (`servirea-api-front`,
  `destino-api.ts`). Ler o arquivo de lá antes de reimplementar algo equivalente.

## Manter este arquivo atualizado
Arquivo de instruções compartilhado entre ferramentas de IA; o `CLAUDE.md` só importa este (`@AGENTS.md`).
Edite **só aqui**. Mudança que invalida algo daqui atualiza este arquivo junto com a funcionalidade. Manter curto.

Trabalhar na branch `claude/saraiva-api-direcionamento-treinos-dv10io` até a demonstração; nunca commitar na `main`.

## Regras que não podem ser quebradas
- Um treinador **nunca** vê nem altera dado de outra consultoria; um aluno só vê os **próprios** dados. Toda leitura e
  escrita é autorizada no servidor; nunca confiar em id de consultoria ou aluno vindo do cliente. Recurso de outra
  consultoria responde 404.
- Isolamento por `consultoria_id` com `@TenantId` (Hibernate) preenchido do banco, nunca do token nem do corpo.
  `@TenantId` não protege SQL nativo: toda consulta nativa filtra `consultoria_id`/`aluno_id` explicitamente.
- Plano **publicado é imutável**: editar mexe só no rascunho; publicar cria versão nova. Registro do aluno aponta para
  a versão executada.
- Registro do aluno é **idempotente**: reenviar o mesmo registro não duplica.
- Peso, dieta, suplementação e observações são **dados sensíveis (LGPD)**: nunca em log, no git ou em outro serviço.
  Seed e testes só com dados fictícios.
- Segredos só em variável de ambiente, **sem valor padrão**. Nunca no git (`.env` ignorado; `.env.example` sem valores).
- O app anexa token e cookies **somente** à própria API (`destino-api.ts`). Link de vídeo abre fora do app, sem token.
- Nada de `alert()`, `confirm()` ou `Alert.alert`: confirmação é painel na tela.
- Não opinar nem calcular nada sobre saúde, suplementos ou protocolos. Não inventar carga, repetição ou valor
  nutricional: ausência de dado é "—". Recurso que não existe não aparece na tela.

## Stack
- `api/`: Java 21 · Spring Boot 4.1.1 · Hibernate 7 · Jackson 3 · PostgreSQL 17 · Flyway · Testcontainers · Maven.
  DTOs `record`, `ApiException` com `codigo`, `@Transactional` no service, `@PreAuthorize` em toda rota.
- `app/`: Expo SDK 57 (web, Android e iOS num app só, treinador e aluno), Expo Router, Node 24.21.0 (`app/.nvmrc`).
  Dependência só com `npx expo install`; React Native é o que o SDK fixa.
- Local: `docker-compose.yml` (Postgres + API + Caddy servindo a web em `:8088`, API em `/api`).

## API: convenções
- `web/` erros (`ApiError` com `codigo`), `RequestIdFilter`, corpo até 1 MiB (`LimiteCorpoFilter`, 413 `CORPO_EXCEDIDO`).
- `security/` JWT de 15 min com `cv`; refresh opaco com rotação (reuso derruba todas as sessões); web = cookie
  `TREINOS_REFRESH` + CSRF `TREINOS-XSRF-TOKEN`, nativo = refresh no corpo (`X-Treinos-Cliente: nativo`).
- `tenant/` `TenantContext` preenchido só pelo `JwtAuthenticationFilter` (ou `TenantContext.executarComo` em rota
  pública/seed, com a transação aberta **dentro** do bloco). Sem contexto = UUID zero (leitura vazia, escrita falha).
- `auth/LimiteTentativas`: `login_tentativa` igual à V016 da Central (uma linha por chave), não o esboço da seção 6
  do plano. No profile `test` os limites por IP são altos (a suíte toda sai de 127.0.0.1).
- Qualidade: Error Prone na compilação, `ArquiteturaTest` (`@TenantId`, `@PreAuthorize`, SQL nativo, Jackson 3) e
  JaCoCo ≥ 70% de linhas no `mvn verify`. Exceção nova entra na lista do teste com o porquê.
- Migration nova: subir o total em `FlywayMigrationIntegrationTest`. Coluna `char(n)` pede `@JdbcTypeCode(SqlTypes.CHAR)`.

## Onde está cada coisa
- `api/` — backend novo. `app/` — app Expo novo.
- `backend/` e `mobile/` — protótipo antigo: **não mexer, não apagar**. `mobile/src/database/pdf_plan_parser.ts` e
  `mobile/src/constants/exerciseVideos.ts` são fontes do seed.
- `docs/` — planilhas e CSVs antigos: não copiar dados pessoais deles.

## Comandos
- API: `cd api && mvn verify` (precisa de Docker para o Testcontainers). Maven usa o JDK do `JAVA_HOME` (21).
- App: `cd app && npm run typecheck && npm run lint && npm test`; `npx expo install --check` e `npx expo-doctor`.
- Tudo local: `cp .env.example .env` (preencher), `docker compose up -d --build`, abrir `http://localhost:8088`.
