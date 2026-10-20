# Pagamentos do aluno ao treinador: pesquisa da InfinitePay (Fase 0)

Pesquisa feita em 20/10/2026, antes de qualquer código de provedor. Cada resposta traz a fonte. O que **não** foi
encontrado está dito como "não encontrado": nada aqui é suposição apresentada como fato. Quem decide é o Gustavo (ver
"Perguntas que só o Gustavo responde", no fim).

Contexto: o treinador cobra o aluno, **na conta InfinitePay do próprio treinador**. O dinheiro não passa pela conta do
Gustavo nem da plataforma. Isto não tem relação com o Mercado Pago da Central (a Central cobra o treinador).

## Resumo em 10 linhas
1. A InfinitePay tem o **Checkout Integrado**: a API gera um link de pagamento na conta do vendedor, identificada pela
   **InfiniteTag** (identificador público, sem segredo).
2. Formas pela API: **Pix e cartão de crédito** (até 12 parcelas). **Boleto não existe** pela API.
3. Há uma **API Key opcional**, um segredo (header `X-Api-Key`), para recursos avançados. Se for usada, vai cifrada no banco.
4. O **webhook existe, mas não é assinado** (nada documentado). Não dá para provar a origem pela mensagem.
5. Por isso a baixa só pode vir da **consulta** `payment_check` feita pela nossa API, nunca do corpo do webhook nem do retorno do
   navegador.
6. A API **não devolve taxa, valor por parcela nem líquido**. Só o app da InfinitePay tem a calculadora. O treinador teria de
   digitar as taxas; sem elas, "—".
7. **Não há sandbox** documentado. Testes com um provedor de mentira; depois um pagamento real de R$ 1.
8. Estorno: o webhook tem o evento `refunded`. **Contestação (chargeback) não tem evento** documentado.
9. Por isso "agenda de recebimentos" e "contestações" (as telas dos prints) **não entram**: a API não dá esses dados.
10. Lojas de aplicativo: risco real. Recomendação conservadora no fim, **sem decisão minha**.

## 1. API para gerar cobrança na conta de um vendedor
- **Criar link:** `POST https://api.checkout.infinitepay.io/links`. Corpo: `handle` (a InfiniteTag, sem o `$`), `items`
  (`quantity`, `price` em **centavos**, `description`), `order_nsu` (nosso identificador do pedido; usaremos o id da
  cobrança), `redirect_url`, `webhook_url`, e opcionais `customer` e `address`.
  - Fonte: [documentação do checkout](https://www.infinitepay.io/checkout-documentacao) e
    [artigo da central de ajuda](https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay)
    (atualizado em 19/10/2026).
- **Opções por link** (artigo da central de ajuda): `options.assured_installments` (0 a 12), `payment_methods_enabled`,
  `valid_until` (no futuro, até um ano), `discounts` (`pix` e `credit_card`) e `single_payment` (bloqueia nova tentativa no
  mesmo link depois de pago).
- **Credencial:** o identificador é a **InfiniteTag**, pública. O artigo de ajuda diz que o vendedor habilita o Checkout
  Integrado no app (Vendas › Checkout › Configurações) e que pode criar uma **API Key, opcional**: "sem ela, basta enviar a
  InfiniteTag, mas a chave é necessária para as opções avançadas". Com chave, o header é `X-Api-Key`.
- **Conflito entre as fontes (a confirmar no teste de R$ 1):** a resposta do `POST /links` aparece como `url`
  (central de ajuda) e como `link` + `slug` (um exemplo de terceiros, que também usa outro endereço,
  `api.infinitepay.io/invoices/public/checkout/links`). O `slug` é necessário para o `payment_check`. O adaptador vai aceitar o
  que a resposta real trouxer e o teste real confirma o formato.
- **Implicação de segurança:** InfiniteTag = identificador público, tratado como dado de configuração (nunca em log). API Key =
  segredo: cifrada no banco (AES-GCM, chave em variável de ambiente) e mostrada só como "configurada".

## 2. Formas de pagamento que existem de fato
- **Pix** e **cartão de crédito** (`capture_method`: `pix` e `credit_card`). O cartão está sempre disponível. Parcelamento em
  **até 12 vezes**; o vendedor escolhe assumir a taxa (parcelas sem juros) ou repassar ao cliente.
  - Fontes: [central de ajuda: link de pagamento](https://ajuda.infinitepay.io/pt-BR/articles/4616168-como-fazer-uma-venda-com-o-infinitelink),
    [repasse de taxas](https://ajuda.infinitepay.io/pt-BR/articles/11731276-como-configurar-o-repasse-de-taxas-no-link-de-pagamento).
- **Boleto: não encontrado** na API do checkout (nem na documentação, nem no artigo de ajuda). Cartão de débito e outras formas
  também não são citados na API.
- **Decisão para o Gustavo:** boleto via **Mercado Pago na conta do treinador** (o desenho genérico de provedores permite) ou
  **ficar sem boleto**.

## 3. Webhook e consulta de situação
- **Webhook existe.** Enviado quando o pagamento é aprovado (documentação do checkout) e, segundo o artigo de ajuda, com
  eventos `created`, `paid`, `settled`, `canceled`, `refunded` e `payment_failed`. Exige URL HTTPS. Espera resposta 200 em
  menos de 1 segundo; 400 faz a InfinitePay tentar de novo.
  - Corpo (exemplo da documentação): `invoice_slug`, `amount`, `paid_amount`, `installments`, `capture_method`,
    `transaction_nsu`, `order_nsu`, `receipt_url`, `items`.
- **Assinatura: não encontrada.** Nenhum HMAC, segredo ou token documentado. Não há como provar pela mensagem que ela veio da
  InfinitePay.
- **Consulta existe:** `POST https://api.checkout.infinitepay.io/payment_check` com `handle`, `order_nsu`, `transaction_nsu` e
  `slug`. Resposta: `success`, `paid`, `amount`, `paid_amount`, `installments`, `capture_method`. Com API Key, vai no header
  `X-Api-Key`. Não documentado: formato de erro, moeda explícita e unidade exata de `amount` (o exemplo sugere centavos).
- **Consequência para o desenho (regra do projeto):** o webhook é só **gatilho**. A baixa exige a consulta `payment_check`,
  com conferência de `paid`, do valor (`amount` igual ao da cobrança no servidor) e da referência (`order_nsu` = id da cobrança).
  `paid_amount` pode ser maior que `amount` (repasse de taxa ao aluno): isso não é divergência. O retorno do navegador
  (`redirect_url`) nunca dá baixa. Webhook repetido não duplica (idempotente por `transaction_nsu`).
- Retentativas: o texto diz que a entrega "pode ser tentada novamente"; número e intervalo **não encontrados**.

## 4. Taxas e simulação de parcelas
- A API **não devolve** taxa por parcela, valor da parcela nem líquido. A documentação cita só uma tabela de taxas e o repasse.
- A [calculadora de taxas](https://ajuda.infinitepay.io/pt-BR/articles/4800276-quais-sao-as-taxas-do-link-de-pagamento) existe
  **no app InfinitePay**, não na API.
- O exemplo do `payment_check` mostra `amount` 1500 e `paid_amount` 1510: a diferença indica repasse, mas **não há campo de
  taxa** nem de líquido.
- **Regra do projeto:** não inventar taxa. As taxas só entram se o **treinador as digitar** na configuração (Fase 2). Sem
  elas, a tela mostra "—" e "líquido indisponível". Nenhuma tabela de taxas no código.

## 5. Ambiente de teste (sandbox)
- **Não encontrado.** A documentação recomenda "testar bastante no ambiente de desenvolvimento", mas não descreve URL, credencial
  nem como acessar.
- **Plano:** testes automatizados com um **provedor de mentira** (servidor do JDK, como o `SiteverifyFalso`) que imita a
  resposta documentada; no fim, o Gustavo faz **um pagamento real de R$ 1** com um roteiro (inclui confirmar o formato da
  resposta do `POST /links`).

## 6. Estorno e contestação
- **Estorno:** o evento `refunded` consta na lista de eventos do webhook (artigo de ajuda). Processo de estorno **pela API**:
  não encontrado.
- **Contestação (chargeback):** **sem evento nem rota documentados.** Pelo artigo de ajuda, a contestação corre no banco do
  cliente e o valor é debitado de recebíveis futuros, e o estabelecimento pode apresentar provas
  ([fonte](https://ajuda.infinitepay.io/pt-BR/articles/3944818-o-que-acontece-se-meu-estabelecimento-tiver-uma-venda-contestada)).
  O treinador só saberia pelo app ou pelos recebíveis.
- **Consequência:** estorno vira `ESTORNADA` (por `refunded`, confirmado na consulta quando possível), sempre com aviso ao
  treinador e **sem apagar a baixa sozinho**. `CONTESTADA` só pode ser marcada à mão pelo treinador. **Agenda de recebimentos e
  tela de contestações não entram na Fase 2:** a API não dá esses dados, e não vamos simular.

## 7. Termos de uso para integração por terceiros
- [Termos de Uso](https://www.infinitepay.io/legal/termos-de-uso) (CloudWalk Instituição de Pagamento): **não tratam de
  integração por API, sistemas de terceiros ou InfiniteTag**. O **Contrato de Afiliação**, que pode ter regras sobre isso,
  **não foi lido** (aparece só como link no rodapé legal).
- Cláusulas que merecem atenção: 4.1 (a conta é pessoal e intransferível, sem uso por terceiros) e 14.1.5 (veda prestar serviço
  de pagamento sem autorização). Por isso o desenho **nunca intermedeia o dinheiro**: o aluno paga direto na conta do próprio
  treinador, e a plataforma só gera o link e consulta a situação.
- **Recomendação:** o treinador (Saraiva) confirmar com o suporte da InfinitePay que gerar links por API na conta dele para
  seus alunos é permitido, e ler o Contrato de Afiliação.

## Lojas de aplicativo
- **Apple.** A [diretriz 3.1.1](https://developer.apple.com/app-store/review/guidelines/) exige compra dentro do app (IAP) para
  liberar conteúdo ou funcionalidade. A **3.1.3(d)** permite outro meio de pagamento para "serviços em **tempo real** entre
  duas pessoas (por exemplo aulas particulares, consultas médicas, treino físico)"; serviços de um para poucos ou muitos, em
  tempo real, continuam em IAP. Consultoria em que o treinador monta um plano e o **entrega pelo app, de forma assíncrona**,
  pode ser lida como conteúdo/serviço digital (3.1.1), e há relatos de recusa por "não ser em tempo real" no
  [fórum de desenvolvedores da Apple](https://developer.apple.com/forums/thread/723322). Fora dos EUA, a regra proíbe botão, link
  ou chamada para pagar fora do app, salvo com o entitlement apropriado. **No Brasil**, desde o acordo com o CADE (em vigor
  desde 18/06/2026, iOS 26.5), existe um framework de pagamento externo com entitlement e comissão de 15% (10% para
  desenvolvedores menores), segundo reportagens ([exemplo](https://www.etvbharat.com/en/technology/apple-unveils-new-app-store-rules-in-brazil-following-regulator-agreement-enn26061904464));
  **os termos oficiais precisam ser conferidos no portal da Apple antes de decidir**. Se o serviço for treino **presencial**,
  vale a 3.1.3(e) (pagar fora do app).
- **Google Play.** A [política de pagamentos](https://support.google.com/googleplay/android-developer/answer/9858738)
  exige o Play Billing para recursos, serviços e conteúdo digital dentro do app, com exceções para bens e **serviços físicos**
  (a lista cita academias) e pagamentos entre pessoas. Consultoria online entregue pelo app pode ser tratada como serviço digital.
  Fora das exceções, o app **não pode levar o usuário a outro método de pagamento** (botão, link, webview). Há programas de
  billing alternativo e de ofertas externas em países elegíveis; a lista da [central de ajuda](https://support.google.com/googleplay/answer/11174377)
  inclui o Brasil, mas os termos do programa **não foram verificados**.
- **Risco:** plano entregue pelo app + botão "Pagar" que abre pagamento fora = risco de recusa ou de pedido de comissão nas duas
  lojas, conforme a leitura do revisor.
- **Recomendação conservadora (não decido):** no iOS e no Android, a tela mostra o plano e as cobranças, **sem botão "Pagar"**
  ("o seu treinador vai mandar o link"), e o "Pagar" só aparece na **web**. Isso é o que a Fase 1 já faz (sem "Pagar" em lugar
  nenhum). Quem decide é o Gustavo.

## Perguntas que só o Gustavo responde
1. **Boleto:** Mercado Pago na conta do treinador só para boleto, ou ficar sem boleto?
2. **Lojas:** aceitar a recomendação conservadora (sem "Pagar" no celular, só na web)? Ou pedir os entitlements da Apple e o
   programa do Google, assumindo comissão e processo de aprovação?
3. **Credencial:** basta a **InfiniteTag** (sem segredo) ou o Saraiva quer usar também a **API Key** (mais recursos, mas um
   segredo a guardar)? O fluxo mínimo da pesquisa funciona só com a InfiniteTag.
4. **Termos:** o Saraiva confirma com a InfinitePay (e lê o Contrato de Afiliação) que gerar links por API para os alunos dele é
   permitido?
5. **Taxas:** o treinador digita as taxas por forma e parcela, ou a tela só mostra o bruto e "líquido indisponível"?

A Fase 2 (InfinitePay) só começa depois destas respostas.
