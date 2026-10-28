# Revisão de segurança de 28/10 (consultoria-app e Central)

Situação: Em andamento · Onde: `main` (consultoria-app); Central sem mudança · Atualizado: 28/10/2026

## Objetivo
Tratar os 3 itens de gravidade baixa e as 2 notas do relatório de 28/10 (leitura de código, sem falha crítica nem alta).
O relatório olhou checkouts antigos da Central (de 16/10), então cada item foi conferido no código atual antes de mexer.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Item 3 sem dependência nova: teste que ataca todo campo de texto livre dos cinco PDFs, em vez de sanitizador | `app/src/pdf/injecao.test.ts` | Gustavo |
| D2 | O teste envenena **toda** string das entradas, em duas variações: "tudo envenenado" (poupa só as chaves de ligação entre objetos: `uid`, `id`, `grupoUid`...) e "códigos preservados" (poupa também código, enum, data). Campo novo de texto livre entra no teste sozinho | idem | Claude |
| D3 | Montar o conteúdo sem `innerHTML` em `imprimir.web.ts` **não** foi feito (o pedido era dizer antes). Opinião: não vale agora. Exigiria reescrever os cinco geradores de string para nós de DOM; a trava de teste cobre o risco real (campo novo sem `esc()`) | ver "Fora do escopo" | Gustavo (pode discordar) |
| D4 | Item 1 (janela do `ts`) não mexe: já existe e a documentação do Mercado Pago não responde as duas perguntas | ver abaixo | Claude |

## Conferência dos itens no código atual
- **Item 1 (`ts` do Mercado Pago):** já corrigido. `AssinaturaMercadoPago.TOLERANCIA` = 5 min, com `ts` em segundos ou
  milissegundos e testes de ts velho/futuro (`AssinaturaMercadoPagoTest`). Entrou na `main` da Central em 16/10 (commit
  `1cf554e`, "janela do ts no Mercado Pago"), antes do checkout que o relatório auditou.
- **Item 2 (`rel` do link de suporte):** já corrigido. `contratacao-detalhe.component.ts:239` e
  `cobranca-detalhe-modal.component.ts:101` têm `rel="noopener noreferrer"`. Não há outro `target="_blank"` em `src/`. Os dois
  `window.open('about:blank', '_blank')` (`cliente-detalhe:134` e `contratacao-detalhe:1074`) abrem a aba antes de saber a URL.
  Conferido: os dois fazem `aba.opener = null` antes de `location.href` (`cliente-detalhe:150`, `contratacao-detalhe:1090`; o
  spec do `cliente-detalhe` confere `aba.opener` nulo) e o proxy da Central manda `Referrer-Policy: strict-origin-when-cross-origin`
  (`deploy/proxy/Caddyfile:29`). Não é achado; nada foi alterado.
- **Item 3 (`innerHTML` do PDF na web):** existe (`imprimir.web.ts:24`) e hoje é seguro; ganhou a trava de teste (D1).
- **Notas 4 e 5 (Central):** continuam como estavam; não entraram (ver "Fora do escopo").

## Item 1: o que a documentação do Mercado Pago diz
Consultada em 28/10 (página de webhooks, mercadopago.com.br):
- Unidade do `ts`: **não especificada**. O exemplo da página tem 10 dígitos (`ts=1704908010`, segundos). O código aceita os dois.
- Reenvio: sem resposta ao webhook em 22 s, repete a cada 15 min, e depois de três tentativas o intervalo cresce.
  **Não diz** se o reenvio traz `ts`, `x-signature` e `x-request-id` novos ou repete os originais.
- Não recomenda janela de tempo para o `ts`.

Risco aberto: se o reenvio repetir o `ts` original, ele chega com mais de 5 min e leva 401. Isso só pesa se a primeira entrega
falhou (Central fora do ar ou 5xx por mais de 5 min). O botão "reconciliar" do operador só age em pagamento que já tem linha em
`pagamento_mercadopago`, e a linha nasce da notificação aceita. Para decidir, falta uma prova com um reenvio real.

## Passos
- [x] 1. Conferir os itens no código atual — sem commit (conferência)
- [x] 2. Item 3: `app/src/pdf/injecao.test.ts` (47 casos: cada gerador em duas variações de entrada + cor da marca), com prova de que falha quando um `esc()` some — commit `afd5a76`; run 40714486714: testes verdes, **Trivy reprovou a imagem da web** (go-jose do `caddy:2-alpine`), `publicar` não rodou
- [ ] 3. Prova de reenvio do Mercado Pago (item 1) — Gustavo/Claude

## Trivy: go-jose do Caddy (CVE-2026-116587), 28/10/2026
O run 40714486714 caiu no Trivy da imagem da web: `go-jose` v4.1.5 (HIGH, corrigido na 4.1.6) dentro do binário do `caddy:2-alpine`.
- **O que o aviso diz** (GHSA-mgcc-cww5-fp2q, CVSS 7.5): ao ler um JWK, o go-jose não limita o módulo e os primos de uma chave
  RSA antes de validá-los; no Go 1.24+ a validação é cúbica, então uma chave forjada consome CPU (só disponibilidade). Afeta quem
  lê JWK de fonte não confiável (`jose.ParseSigned`, JWK no cabeçalho). Sem contorno; corrigido na 4.1.6.
- **Conferência:** Caddyfile de produção da web (`central-api-back/deploy/apps/consultoria/web.Caddyfile`, montado no compose) e o
  `deploy-local/Caddyfile`: só `:80` estático, `admin off`, `auto_https off`, sem `tls`, ACME, `pki`, `acme_server` nem JWT. O
  proxy da VPS (`deploy/proxy/Caddyfile`) também não usa ACME, `tls internal`, PKI, `acme_server` nem JWT (TLS é da Cloudflare;
  só `basic_auth` do WhatsApp). Observação: o proxy não tem `admin off` explícito (a API admin não é publicada e não lê JWK).
- **Decisão (Gustavo):** exceção com justificativa e prazo no `.trivyignore` da raiz, `exp:2026-11-14`, a mesma data das outras
  exceções do Caddy. O arquivo vale também para a imagem da API (Java, sem go-jose).
- **Lembrete até 14/11/2026:** conferir se o `caddy:2-alpine` já traz go-jose 4.1.6, Go 1.26.10 e x/net 0.60.0. Se sim, apagar
  todas as exceções do Caddy; se não, renovar com nova justificativa.
- **Central e Servirea** (mesmo `caddy:2-alpine`): a mesma exceção entra no próximo lote de cada repositório
  (`central-api-front/.trivyignore`, `central-api-back/.trivyignore-terceiros`; Servirea: repositório não está nesta máquina).

## Fora do escopo
- **Montar o PDF da web sem `innerHTML`** (D3): mudaria como o documento chega à página e o CSS de impressão. Fica a decisão do Gustavo.
- **Notas 4 e 5 da Central** (`ErroRecebido.status` 500–599; `IntegracaoProperties.chaves()` com entrada malformada): o pedido as
  deixou para quando houvesse um lote da Central, e não há. Um PR só por isso gasta minutos de CI (plano perto do limite).
- Auditar o pacote `plataforma` (HMAC, `caminhoDaApi`) e um módulo de treinador a fundo: sugestões do relatório, sessão à parte.

## O que ficou para trás
- Prova do reenvio do Mercado Pago e decisão sobre a janela (README, Pendências soltas).
- Notas 4 e 5 da Central, no próximo lote da Central.
- Decisão sobre tirar o `innerHTML` de `imprimir.web.ts`.
