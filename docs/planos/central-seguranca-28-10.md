# Central: lote de segurança de 28/10

Situação: Em andamento · Onde: Central, branch `seguranca-lote-28-10` (um PR) · Atualizado: 28/10/2026

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
- [ ] 1. InfinitePay: slug do link guardado e conferido na baixa (`link_diferente` → REVISAR) — commit/run: —
- [ ] 2. InfinitePay: teto de 16 KiB e de 20 transações por pedido — commit/run: —
- [ ] 3. `@PreAuthorize("permitAll()")` nos dois webhooks e contrato regenerado — commit/run: —
- [ ] 4. Mercado Pago: varredura dos checkouts sem confirmação — commit/run: —
- [ ] 5. `ErroRecebido.status` 500–599 e `IntegracaoProperties.chaves()` estrito — commit/run: —
- [ ] 6. Trivy (116587, 111943, 111497), `admin off` no proxy, cloudflared 2026.10.5, `apk upgrade` no `central-web` — commit/run: —
- [ ] 7. URL de integração do produto só `http`/`https` — commit/run: —
- [ ] 8. Troca do Caddy e do cloudflared na VPS (Gustavo) — commit/run: —

## Fora do escopo
- Cloudflared e Caddy na VPS: o comando e a conferência vão no relatório; quem executa é o Gustavo.
- Servirea: mesma exceção do Trivy no lote dele.

## O que ficou para trás
- (preencher ao terminar)
