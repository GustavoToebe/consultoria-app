# Dependabot de 28/10

Situação: Em andamento (PRs da Central #27 e do Servirea #16 mesclados (ec537cf, bdeb95c) e publicar da main verde nos dois; publicar da J verde (run 40751695095); lote do consultoria no ar, run 40753524829 verde; falta só a revisão de 14/11) · Onde: Central, Servirea e consultoria-app · Atualizado: 28/10/2026

## Objetivo
Zerar o que o Dependabot acusa nos três repositórios ativos sem gastar minutos do Actions à toa: atualizar só o lock quando o
`package.json` já cobre a versão, aceitar por escrito o que depende do Expo, e cobrir o bundle JS com `trivy fs` sobre o
`package-lock.json` (a varredura de imagem não enxerga as bibliotecas do bundle).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | `braces` (3 repositórios) | Alertas dispensados como "advisory retirado" (inaccurate). **Feito em 28/10.** Só esse | Gustavo, 28/10 |
| 2 | Minutos do Actions | Pacote incluído em 100%, orçamento extra $5,72 de $10,00 (57%), reset em 01/11. Acima de 90%: lotes e testes locais prontos, pushes a partir de 01/11 (a correção do ciclo do consultoria segue normal) | Gustavo, 28/10 |
| 3 | `decode-uri-component` (GHSA-vcc3-ghjq-m6fr) | Só DoS por CPU no navegador: aceitar, sem override, revisão em 14/11. Se o GHSA dissesse outra coisa, avisar antes de mexer | Gustavo, 28/10 |
| 4 | `node-forge` e `uuid` | Aceitos (só build do Expo), mesmo registro, revisão em 14/11 | Gustavo, 28/10 |
| 5 | `trivy fs` do front | `--scanners vuln --severity HIGH,CRITICAL --ignore-unfixed`, o mesmo `.trivyignore`, sem `--include-dev-deps`; roda local antes; achado com correção volta ao Gustavo antes de qualquer exceção | Gustavo, 28/10 |
| 6 | Quill 2.0.3 (CVE-2025-15056) no Servirea | Achado fechado: há limpeza no servidor (jsoup `Safelist` ao gravar o layout; Renderizador escapa; front com DOMPurify). Nada a implementar | Claude, 28/10 (leitura) |
| 8 | Patch do tooling do Angular (21.2.29, só lock; traz vite 7.3.7 e sdk 1.32.1 e ~70 pacotes de build) | **Mantém** nos dois repositórios | Gustavo, 28/10 |
| 9 | Servirea: exceções do Caddy | 116587 e 111943 entram no `.trivyignore` (texto da Central, `exp:2026-11-14`). 111497 (brotli) e 92392 (curl) **não**: `RUN apk upgrade --no-cache brotli-libs curl libcurl` na imagem, como Central e consultoria; exceção dessas duas só no `.trivyignore-terceiros` da Central | Gustavo, 28/10 |
| 10 | Push dos lotes | Central e Servirea sem push até 01/11. Em 01/11: `git merge origin/main` na branch (sem rebase), testes locais de novo, push, PR e avisar o Gustavo para revisar antes do merge | Gustavo, 28/10 |
| 7 | `zod` 3.25.76 → 4.6.6 (CVE-2023-54404 / GHSA-mrhx-c7xc-m3w5, HIGH, com correção) no `trivy fs` do consultoria | **Aprovado: exceção `CVE-2023-54404 exp:2026-11-14` no `.trivyignore` da raiz** (revisão 14/11: ver se o Expo já traz zod 4.6.6). Achados (28/10): afeta `< 4.6.6`; a falha é DoS por memória ao validar um array grande sem limite de tamanho (CVSS 7.5, só quando o app valida entrada externa com schema de array). No app em produção não está: vem de `@expo/cli` 57.0.31 (ferramenta de build do Expo, roda no `npx expo export` do Dockerfile e no EAS; exige `^3.25.76`) e de `eslint-plugin-react-hooks`/`zod-validation-error` (só desenvolvimento). Nenhum arquivo de `app/` importa zod. Subir para 4.x pede override (quebra o `@expo/cli`) ou um Expo novo. | Gustavo, 28/10 |

## Passos
- [x] 1. Dispensar o `braces` nos 3 repositórios — feito em 28/10 pela API do GitHub
- [x] 2. Quill no Servirea: conferido, há limpeza no servidor
- [x] 3. **Central** (um PR, branch curta `deps-front-28-10`, worktree `central-deps-front`): `9f9f1e8` lock (dompurify 3.4.17, follow-redirects 1.16.2, hono 4.13.14, launch-editor 2.14.2; `package.json` igual); `1717810` patch do tooling do Angular só no lock (mantido); `20b0433` step `trivy fs` no job `front - testar`. Local: lint, test, e2e:tipos, build:prod e e2e (39) verdes; `trivy fs` 0 achados. PR #27 (https://github.com/GustavoToebe/central/pull/27), CI verde (run 40746557052); aguarda o merge do Gustavo
- [x] 4. **Servirea** (um PR, branch curta `deps-front-28-10`, worktree `servirea-deps-front`): `5d89106` lock (follow-redirects, hono, launch-editor); `52d19e5` patch do Angular só no lock (mantido); `224644a` `trivy fs` no workflow + go-jose 116587; `b447546` + `46ded0f` 111943 no `.trivyignore` e `apk upgrade` de brotli/curl na imagem (111497 e 92392 sem exceção). Local: lint, 737 testes, build:prod e e2e (20) verdes; `trivy fs` 0 achados; imagem construída e varrida com 0 achados. PR #16 (https://github.com/GustavoToebe/servirea/pull/16), CI verde (run 40746589853); aguarda o merge do Gustavo. A imagem web com `apk upgrade` e a exceção 111943 só roda no publicar da `main`
- [x] 5. **Consultoria** (lote próprio, só depois do publicar da correção do ciclo e da K, sem misturar; branch `deps-consultoria-28-10`, worktree `consultoria-deps-lote`, preparado no local e **sem push**): (a) este registro de aceite de `decode-uri-component` (CVE-2026-45822, MÉDIA, só DoS por CPU no navegador), `node-forge` e `uuid` (CVE-2026-41907, MÉDIA; só build do Expo), revisão em 14/11; (b) step `trivy fs` sobre `app/package-lock.json` no job `testar-app` do `deploy.yml` (mesmas opções do front, `.trivyignore` da raiz); `trivy fs` local: só o zod aparece em HIGH/CRITICAL, com a exceção do zod aprovada (decisão 7) o resultado é 0; (c) trecho da VPS do `AGENTS.md` vira ponteiro para o da Central. Feito: merge da `main`, typecheck/lint/test (153 suítes, 2056 testes) e `trivy fs` local = 0; push único — commit: aa81c38 (405dc42, 56448c1), run 40753524829 verde (o step do `trivy fs` passou na CI), saúde 200
- [x] 6. `/root/.ssh/authorized_keys.tmp-antes-eab` na VPS: apagar depois do primeiro publicar verde do consultoria e mandar o `ls -la /root/.ssh` ao Gustavo — feito em: 28/10/2026 15:48 (publicar verde da Central e do Servirea; `/root/.ssh` ficou com `authorized_keys` de 4 chaves, `config`, `deploy_central`, `known_hosts`)
- [ ] 7. Revisão em 14/11: reabrir `decode-uri-component`, `node-forge`, `uuid` e as exceções do Caddy/go-jose nos `.trivyignore`

## Fora do escopo
- Aceitar PR do Dependabot ou abrir PR dele: só por ordem do Gustavo.
- Subir o Angular (21.2.28+) além do patch do passo 3.

## O que ficou para trás
- (nada ainda; o que sobrar vai para "Pendências soltas" do README)
