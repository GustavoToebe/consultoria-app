# Dependabot de 28/10

Situação: Em andamento (lotes montados no local; nenhum push antes de 01/11, pacote do Actions esgotado) · Onde: Central, Servirea e consultoria-app · Atualizado: 28/10/2026

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
| 7 | `zod` 3.25.76 → 4.6.6 (CVE-2023-54404, HIGH, com correção) no `trivy fs` do consultoria | **Pendente: o Gustavo decide** antes de qualquer exceção | Gustavo decide |

## Passos
- [x] 1. Dispensar o `braces` nos 3 repositórios — feito em 28/10 pela API do GitHub
- [x] 2. Quill no Servirea: conferido, há limpeza no servidor
- [ ] 3. **Central** (um PR, branch curta `deps-front-28-10`, worktree `central-deps-front`): `9f9f1e8` lock (dompurify 3.4.17, follow-redirects 1.16.2, hono 4.13.14, launch-editor 2.14.2; `package.json` igual); `1717810` patch do tooling do Angular 21.2.26 → 21.2.29 só no lock (traz vite 7.3.7 e sdk 1.32.1, mas também ~70 pacotes de build: **precisa do ok do Gustavo, senão sai do PR**); `20b0433` step `trivy fs` no job `front - testar`. Local: lint, test, e2e:tipos, build:prod e e2e (39) verdes; `trivy fs` 0 achados — PR/run: —
- [ ] 4. **Servirea** (um PR, branch curta): locks equivalentes (sdk, follow-redirects, hono, vite; `dompurify` já na 3.4.17), `trivy fs` no front e `.trivyignore` do front com go-jose CVE-2026-116587 até 14/11 (conferir antes se a imagem dispara também 111943, 111497 e 92392: se sim, trazer ao Gustavo) — PR/run: —
- [ ] 5. **Consultoria** (lote próprio, só depois do publicar da correção do ciclo e da K, sem misturar): este registro de aceite de `decode-uri-component`, `node-forge` e `uuid`, `trivy fs` sobre `app/package-lock.json` no job do app, e a decisão do `zod` — commit/run: —
- [ ] 6. `/root/.ssh/authorized_keys.tmp-antes-eab` na VPS: apagar depois do primeiro publicar verde do consultoria e mandar o `ls -la /root/.ssh` ao Gustavo — feito em: —
- [ ] 7. Revisão em 14/11: reabrir `decode-uri-component`, `node-forge`, `uuid` e as exceções do Caddy/go-jose nos `.trivyignore`

## Fora do escopo
- Aceitar PR do Dependabot ou abrir PR dele: só por ordem do Gustavo.
- Subir o Angular (21.2.28+) além do patch do passo 3.

## O que ficou para trás
- (nada ainda; o que sobrar vai para "Pendências soltas" do README)
