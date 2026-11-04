# Mercado Pago da Central: o `ts` muda no reenvio? (roteiro de 04/11)

Situação: Roteiro pronto, **aguarda o teste do Gustavo** · Onde: Central (nenhum código mexido) · Atualizado: 04/11/2026

## Por que testar
O webhook da Central (`POST /webhooks/mercadopago`, `NotificacaoMercadoPagoController`) só aceita a notificação se a assinatura
`x-signature` fecha **e** o `ts` dela está a no máximo 5 minutos do relógio do servidor, nos dois sentidos
(`AssinaturaMercadoPago.TOLERANCIA = 5 min`, conferida na linha `Duration.between(momento, agora).abs() > TOLERANCIA`). Fora disso
a resposta é 401 e nada é gravado. A documentação da Central (`docs/mercadopago.md`) afirma que "o Mercado Pago reentrega com
assinatura nova", mas **isso nunca foi provado**. Se o reenvio reaproveitar o `ts` do envio original, toda reentrega feita depois de
5 minutos (que é justamente quando ela serve para alguma coisa) toma 401 e o webhook perde o sentido como rede de segurança.

Rede que já existe se o pior acontecer: a `VarreduraMercadoPago` (a cada 15 min) acha pagamento aprovado que o webhook perdeu e o põe
na fila de conciliação. Então um 401 não perde baixa; só atrasa até a próxima varredura.

## Como o `ts` entra na conta (para interpretar o resultado)
- Manifesto assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` com HMAC-SHA256 e o segredo do webhook (nunca no texto, nunca no chat).
- O `ts` aceito pode vir em segundos ou milissegundos.
- `x-request-id` e `data.id` também entram no manifesto. Reenvio com `x-request-id` novo e `ts` velho não fecha a assinatura
  (o hash é do trio); por isso o resultado só tem duas saídas possíveis: assinatura nova inteira (200) ou assinatura velha inteira (401 por `ts` antigo).

## O teste (sem código novo, sem segredo)
Precisa de uma notificação **real** já entregue, de preferência a de um pagamento de teste seu (valor mínimo, conta de teste ou
uma cobrança sua), e do painel do Mercado Pago (Suas integrações, a aplicação da Central, Webhooks, histórico de notificações).

1. Escolha uma notificação do tópico `payment` que o painel mostre como entregue (resposta 200). Anote o horário dela (hora do painel
   e hora local) e o `id` do pagamento. **Não anote o segredo nem o cabeçalho inteiro.**
2. **Controle (dentro da janela).** Reenvie essa notificação pelo painel até 4 minutos depois do envio original, se for possível
   (pagamento recém-feito). Anote o código HTTP que o painel mostra. Esperado: 200. Se o painel não permitir reenviar uma notificação tão
   nova, pule para o passo 3.
3. **Prova (fora da janela).** Espere **pelo menos 10 minutos** depois do envio original (margem de 5 min sobre a tolerância, para não
   confundir com relógio). Reenvie a mesma notificação pelo painel. Anote o código HTTP e o horário do reenvio.
4. Confirme o lado da Central. O Caddyfile do proxy (`deploy/proxy/Caddyfile`) **não tem a diretiva `log`**, então não há log de acesso
   para ler: a prova é o **código HTTP que o painel do Mercado Pago mostra** para a entrega. Se o painel só mostrar "falhou"/"entregue" sem
   o código, a resposta (200 contra 401) ainda separa os casos: 401 aparece como falha de entrega. O log da API também não mostra o `ts`.
   Não ligue log de acesso só para este teste (ele guardaria a URL e a query com o `data.id`).
5. Se quiser ver o `ts` em si: o painel do Mercado Pago, nos detalhes da entrega, pode mostrar os cabeçalhos enviados. Se mostrar,
   compare só o número depois de `ts=` entre o envio original e o reenvio (não copie o `v1=`). Se não mostrar, o passo 4 basta.

6. **Reentrega automática (a que importa).** O reenvio manual do painel pode não seguir o mesmo caminho da reentrega automática que o
   Mercado Pago faz quando recebe resposta diferente de 2xx. Procure no histórico do painel uma notificação que já tenha **várias tentativas
   automáticas** (qualquer pagamento antigo cuja primeira entrega falhou, por exemplo numa janela em que a API estava fora do ar) e anote o
   código de cada tentativa e o intervalo entre elas. Tentativa automática depois de 5 min que deu 200 prova `ts` novo; que deu 401 prova o
   contrário. Se não existir notificação assim, o resultado do reenvio manual vale só para o reenvio manual, e a conclusão sobre a
   reentrega automática fica "não provada" (a opção 1 abaixo cobre o risco pela varredura de 15 min).

## Como ler o resultado
| Reenvio com 10 min ou mais | O que significa | O que fazer |
| --- | --- | --- |
| **200** | O reenvio traz `ts` novo (assinatura nova). A frase da documentação está certa | Nada. Só trocar em `docs/mercadopago.md` "o Mercado Pago reentrega com assinatura nova" por "provado em DD/MM/AAAA com reenvio real" |
| **401** | O reenvio reaproveita o `ts` original. Qualquer reentrega depois de 5 min é recusada | Ver "Se o `ts` se repetir" abaixo |
| Outro código (403, 5xx, timeout) | Problema fora da assinatura (Cloudflare, proxy, API fora do ar). Teste inválido | Refazer; olhar o log do proxy e a regra da Cloudflare para o caminho do webhook |

## Se o `ts` se repetir (só então mexer no código)
Ponto exato: `central-api-back/src/main/java/br/com/central/api/pagamento/AssinaturaMercadoPago.java`, constante `TOLERANCIA` e o `if` que
compara `momento` com `agora`; teste `AssinaturaMercadoPagoTest`; texto em `docs/mercadopago.md` (parágrafo do POST
`/webhooks/mercadopago`). Opções, para o Gustavo decidir (não é decisão do código):

1. **Não mudar nada.** A varredura de 15 min já cobre o que o webhook perder. Custo: atraso de até 15 min em pagamento cuja primeira
   entrega falhou. Corrigir só a frase da documentação ("reentrega com assinatura nova" deixa de ser verdade).
2. **Alargar a janela** até o horizonte de reentrega do Mercado Pago (conferir o prazo atual na documentação oficial de notificações; não
   está provado aqui). O que a janela protege é replay de uma notificação assinada; o efeito de um replay é só reabrir a conferência
   (`situacao` volta a `PENDENTE`) e gerar uma consulta à API oficial, porque a baixa só roda com `aplicado=false` e vem da consulta
   oficial, nunca do corpo. Custo: replay possível por mais tempo, sem poder de baixa. Muda a constante e os testes de limite.
3. **Janela de 5 min só para a primeira entrega e outra regra para reentrega** (por exemplo, aceitar `ts` antigo se o `x-request-id` já
   foi visto). Mais código e estado novo (guardar `x-request-id`); só vale se a 2 não for aceitável.

Qualquer que seja a escolha: teste novo em `AssinaturaMercadoPagoTest` para o limite (dentro, fora, segundos e milissegundos) e
atualizar `docs/mercadopago.md` no mesmo commit.

## Fora do escopo
- Mexer na `TOLERANCIA` antes do resultado do teste.
- Webhook da InfinitePay (não é assinado; só o `payment_check` dá baixa, `docs/infinitepay.md`).
- Qualquer ação no painel ou na VPS feita pelo Claude: o teste é do Gustavo.

## Resultado (preencher depois do teste)
- Data e hora do envio original: —
- Data e hora do reenvio: —
- Código HTTP no painel e no log do proxy: —
- `ts` mudou? (só se o painel mostrou): —
- Decisão (1, 2 ou 3): —
