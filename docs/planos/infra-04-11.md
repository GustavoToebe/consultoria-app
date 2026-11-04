# Infra de 04/11 (Caddy, Dependabot, lock_timeout, Mercado Pago)

Situação: Em andamento (alterações no worktree, sem commit nem push) · Onde: branch infra-04-11 (consultoria-app, Servirea e Central) · Atualizado: 04/11/2026

## Objetivo
Fechar quatro pendências de infraestrutura sem tocar em produção: conferir se o Caddy já corrige os achados do Trivy, conferir se o app já pode sair das
exceções do `decode-uri-component` e do `uuid`, pôr o `lock_timeout` de 60 s na migração do módulo auth do Servirea e da Central (como no consultoria) e
deixar pronto o roteiro que prova se o reenvio do Mercado Pago muda o `ts` da assinatura.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Caddy | `caddy:2-alpine` continua no digest `sha256:e70b164da81e…` (v2.11.7, criada em 21/10): `docker pull` em 04/11 respondeu "up to date"; ainda Go 1.26.8, x/net 0.59.0 e go-jose 4.1.5. Nenhuma exceção apagada (consultoria e Servirea); próxima conferência em 28/11 | Claude, 04/11 (leitura local) |
| 2 | `decode-uri-component` e `uuid` no app | Sem versão compatível com o SDK 57: ver [dependabot-28-10.md](dependabot-28-10.md), decisão 17. Nada alterado em `package.json`/`package-lock.json` | Claude, 04/11 (leitura) |
| 3 | `lock_timeout` no módulo auth | `?options=-c%20lock_timeout%3D60s` em `plataforma.auth.migracao.url` do `application-prod.yml`, como no consultoria. Teste novo no `PapeisBancoIntegrationTest` dos dois abre conexão com a URL do `application-prod.yml` e confere `lock_timeout` = 60000. Servirea e Central, uma branch `infra-04-11` em cada (worktrees `wt-servirea-04-11-G` e `wt-central-04-11-G`). Só o módulo auth: o Flyway da aplicação e o módulo `central` do Servirea ficam como estavam | pedido do coordenador |
| 4 | Mercado Pago | Só roteiro ([mercado-pago-roteiro-04-11.md](mercado-pago-roteiro-04-11.md)); nenhum código da Central mexido antes do teste | pedido do coordenador |

## Passos
- [x] 1. Conferir o Caddy (04/11): sem correção na imagem, exceções mantidas — commit/run: —
- [x] 2. `decode-uri-component` e `uuid`: sem versão compatível, anotado no plano do Dependabot — commit/run: —
- [x] 3a. Servirea: `lock_timeout` na URL do módulo auth + teste de configuração + nota no `docs/papeis-banco.md` — commit/run: —
- [x] 3b. Central (PR #28 mesclado em 02/11): mesma mudança — commit/run: —
- [x] 4. Roteiro do Mercado Pago escrito — commit/run: —
- [ ] 5. Gustavo roda o teste do Mercado Pago e preenche o "Resultado" do roteiro

## Fora do escopo
- Módulo `central` do Servirea (`plataforma.central.migracao.url`) e `spring.flyway` do Servirea e da Central (o consultoria usa `init-sqls`; os outros dois não têm): sem `lock_timeout`. Decidir à parte.
- Mudar a `TOLERANCIA` de 5 min do webhook do Mercado Pago antes do resultado do teste.

## O que ficou para trás
- Antes do merge do Servirea e da Central (o merge na `main` publica): conferir na VPS que `DB_URL` e `MIGRATION_DB_URL` não têm `?` (roteiro no relatório da frente).
- `lock_timeout` no Flyway da aplicação e no módulo `central` do Servirea.
- Rodar o roteiro do Mercado Pago (Gustavo).
- Revisão de 28/11: Caddy, `decode-uri-component`, `uuid` e `zod`.
