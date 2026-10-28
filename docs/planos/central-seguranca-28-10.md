# Central: lote de segurança de 28/10

Situação: Em andamento (PR #26 com CI verde, aguardando merge) · Onde: Central, branch `seguranca-lote-28-10` (um PR) · Atualizado: 28/10/2026

## Objetivo
Fechar na Central os itens baixos da revisão do `main` 1008d11 (28/10) e as pendências das revisões anteriores: conferir o link da
InfinitePay na baixa, limitar o webhook dela, deixar a regra de `@PreAuthorize` sem exceção escondida, achar pagamento do Mercado Pago
que o aviso perdeu e apertar validações e a varredura de vulnerabilidades.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Slug do link InfinitePay | Só o campo `slug` da resposta do `/links`; ausente = nulo e vale a regra de hoje. Nunca tirado da URL | Gustavo |
| 2 | Onde registrar a frente | Aqui, no consultoria; nenhuma pasta nova na Central | Gustavo |
| 3 | Trivy | Exceções 116587, 111943 e 111497 até 14/11 (proxy e Postgres); `central-web` corrige o brotli com `apk upgrade`, sem exceção | Gustavo |
| 4 | cloudflared (CVE-2026-63209) | Sem exceção: fixar a 2026.10.5. A troca na VPS é do Gustavo, em horário calmo | Gustavo |
| 5 | Varredura do Mercado Pago | Só `approved`; insere `PENDENTE` se não existe; reabre só linha fechada como não paga e não aplicada; nunca mexe em `REVISAR` nem `CONCILIADO`; nunca dá baixa | Gustavo |
| 6 | Webhook InfinitePay | Corpo até 16 KiB (413 `CORPO_EXCEDIDO`) e 20 transações distintas por `order_nsu` | Gustavo |

## Passos
- [x] 1. InfinitePay: slug do link guardado e conferido na baixa (`link_diferente` → REVISAR) — commit d7a2c30 (PR #26, run 40730560272)
- [x] 2. InfinitePay: teto de 16 KiB e de 20 transações por pedido — commit d7a2c30 (PR #26, run 40730560272)
- [x] 3. `@PreAuthorize("permitAll()")` nos dois webhooks e contrato regenerado — commit d7a2c30 (PR #26, run 40730560272)
- [x] 4. Mercado Pago: varredura dos checkouts sem confirmação — commit d756b99 (PR #26, run 40730560272)
- [x] 5. `ErroRecebido.status` 500–599 e `IntegracaoProperties.chaves()` estrito — commit de5a966 (PR #26, run 40730560272)
- [x] 6. Trivy (116587, 111943, 111497), `admin off` no proxy, cloudflared 2026.10.5, `apk upgrade` no `central-web` — commits 5f415b8 e 761976f (PR #26, run 40730560272)
- [x] 7. URL de integração do produto só `http`/`https` — commit de5a966 (PR #26, run 40730560272)
- [ ] 8. Troca do Caddy e do cloudflared na VPS (Gustavo) — commit/run: —

## Fora do escopo
- Cloudflared e Caddy na VPS: o comando e a conferência vão no relatório; quem executa é o Gustavo.
- Servirea: mesma exceção do Trivy no lote dele.

## O que ficou para trás
- CVE-2026-92392 (curl/libcurl 8.22.0-r0 em caddy e postgres:18.6): a varredura semanal de segunda 02/11 deve acusar. Mesma situação do
  brotli (curl não é chamado, imagens sem porta publicada); proposta: exceção com `exp:2026-11-14`. Não entrou no PR por não estar autorizada.
- Link refeito na mesma tentativa perde o slug antigo: pagamento tardio no link velho vai para REVISAR (limitação aceita).
- Teto de 20 transações por pedido é macio sob concorrência (duas requisições simultâneas podem passar de 20 por um triz).
- Conferir no primeiro link real da InfinitePay se o `/links` devolve `slug` igual ao `invoice_slug` do aviso; senão todo pagamento vai a REVISAR `link_diferente`.
- Se o índice de busca do Mercado Pago atrasar em relação ao `GET /payments/{id}` (ex.: estorno), a mesma linha pode ser reaberta a cada 15 min
  (limitada pela janela de 45 dias e pela cobrança aberta).
- Fora dos 7 itens: o 1º run do PR falhou com `too many clients` no Postgres de teste (91 de 100 conexões ociosas, uma pilha de pools de 10 por
  contexto em cache). Corrigido só em `application-test.yml` (`minimum-idle: 1`, `idle-timeout: 10s`; pico local 25), commit 78607f5. Hipótese,
  não provado: a `main` já ficava perto do limite e a ordem de execução da CI expôs.
- Passo 8 (VPS): troca do Caddy e do cloudflared 2026.10.5 é do Gustavo; só vale "em produção" com o deploy da Central verde.
