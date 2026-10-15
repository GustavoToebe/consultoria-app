# Biblioteca comum (`plataforma`)

A API usa o `plataforma-parent` e os módulos `plataforma-comum-*` (repositório `GustavoToebe/plataforma`, GitHub Packages) no lugar de cópias próprias. Versão em uso: **1.9.0** (e-mail de acesso e redefinição de senha; as 1.1.0 a 1.5.0 não devem ser usadas).

| Módulo | O que traz | Estado aqui |
| --- | --- | --- |
| `plataforma-parent` | Java 25, Spring Boot, Error Prone, JaCoCo, Surefire, imagem do Postgres dos testes | adotado |
| `plataforma-comum-teste` | `PostgresDeTeste` e `RegrasDeArquitetura` | adotado |
| `plataforma-comum-web` | `ApiError`, exceções 4xx, handler global, request id, limite de corpo | adotado; ficam no app só `NaoEncontradoException`, `ValidacaoException` (422 com `fieldErrors`) e `MuitasRequisicoesException` (429 com `Retry-After`), tratadas por `TratadorDoApp` |
| `plataforma-comum-monitoramento` | filtro de token e `/monitoramento/metrics` (formato Prometheus) | adotado, sem coleta externa (`MONITORAMENTO_TOKEN` vazio fecha a rota) |
| `plataforma-comum-seguranca` | limite de login, HMAC, TOTP | adotado (via `auth`) |
| `plataforma-comum-auth` | login, JWT, refresh, CSRF, MFA | adotado (V006 apaga `refresh_token`; o módulo cria o esquema `plataforma`) |
| `plataforma-comum-central` | integração com a Central (filtro HMAC, idempotência, direitos) | **Fase 6** (a API ainda tem a integração própria) |

## Baixar a biblioteca

O GitHub Packages exige token mesmo para leitura. Duas formas:

- **Maven na máquina**: `~/.m2/settings.xml` com um `<server>` de `<id>github</id>`, usuário `GustavoToebe` e um token com `read:packages`. Sem isso, `mvn` só funciona se a versão já estiver no `~/.m2` (por exemplo, instalada a partir da tag `v1.9.0` do repositório `plataforma`).
- **Docker** (`docker compose up --build`): o Compose entrega o token ao BuildKit como segredo `gh_token`, lido do arquivo `deploy-local/segredos/gh_token` (fora do git, modo 600, só o token numa linha). O Dockerfile grava um `settings.xml` temporário no mesmo `RUN` e o apaga ao terminar, inclusive em falha; o token não usa `ARG` nem `ENV` e não vai para a imagem. Fora do Compose: `docker build --secret id=gh_token,src=/caminho/fora/do/git/gh_token api`.

Sem o arquivo do segredo o `docker compose up --build` falha antes de começar: crie o arquivo (ou use a API já construída).

## Regras

- Subir a versão da biblioteca é uma linha no `pom.xml` (parent e módulos juntos); rodar `mvn verify` com Postgres 18 e 17 (`-Dplataforma.postgres.imagem=postgres:17-alpine`).
- Nada de segredo com valor padrão: segredos só em variáveis de ambiente.
- O JSON de erro (`timestamp, status, error, message, codigo, path, requestId, fieldErrors`) é o que o app lê em `app/src/api/cliente.ts`; qualquer mudança nele vem com teste.
