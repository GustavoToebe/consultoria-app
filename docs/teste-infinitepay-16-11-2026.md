# Teste real da InfinitePay em 16/11/2026

Pagamento de R$ 1,00 feito de verdade no Checkout Integrado, na conta InfinitePay do Saraiva. Não houve sandbox. O dinheiro caiu na conta dele. A plataforma não intermediou.

O checkout e o cartão funcionaram. A baixa automática nesta cópia local não aconteceu: o webhook foi para a API de produção.

## O que ficou ligado

No `.env` local (não vai para o git) e na API recriada em seguida, que subiu saudável:

- `TREINOS_PAGAMENTOS_HABILITADO` já estava `true`.
- `TREINOS_PAGAMENTOS_INFINITEPAY_HABILITADO=true`.
- `TREINOS_PAGAMENTOS_CHAVES` e `TREINOS_PAGAMENTOS_CHAVE_ATIVA=k1`: chave AES de 32 bytes, só para cifrar a API Key no banco. Não é a chave da InfinitePay.
- `TREINOS_PAGAMENTOS_URL_PUBLICA=https://overtraining.app/api`.

`APP_URL` continuou `http://localhost:8088`. O app local é `http://localhost:8088`.

## O que foi configurado na conta

No app da InfinitePay (Vendas › Checkout › Configurações) o Checkout Integrado foi habilitado e uma API Key foi criada. A chave começa com `inchk_` e só aparece na criação. Ela não foi para o `.env` nem para este arquivo.

No consultoria, em Financeiro › Recebimento online, a tela ficou **Configurado**:

- InfiniteTag `saraivateamltda` (no app da InfinitePay, `$saraivateamltda`).
- API Key gravada. A tela só mostra "Chave configurada".
- Juros do parcelamento em **Aluno**: a taxa do cartão fica com quem paga (`assured_installments` 0).

Com a API Key, o link que o consultoria gera aceita um pagamento só e vale 30 dias a partir do vencimento da cobrança, ou de hoje se o vencimento já passou.

## A cobrança e o pagamento

Plano comercial de teste, mensal, R$ 1,00, vencimento todo dia 16, vigência de 16/11/2026 a 16/12/2026. Cobrança de nov/2026, R$ 1,00, vencimento 16/11/2026.

O link abriu o checkout da InfinitePay. O pagamento com cartão de crédito foi aprovado em 16/11/2026 às 16:36. O comprovante da InfinitePay mostrou:

- Recebedor: Saraiva Team.
- Tipo: link integrado.
- Meio: crédito.
- Valor pago: **R$ 1,05**.

O R$ 1,00 é a cobrança. Os R$ 0,05 a mais são a taxa do cartão repassada a quem pagou, coerente com a opção **Aluno**.

## O que o webhook fez

O webhook existe. Na geração do link, a API informou à InfinitePay:

`https://overtraining.app/api/publico/pagamentos/infinitepay/{token}`

O token é aleatório por consultoria e fica na credencial. Com API Key, os eventos pedidos são `paid` e `refunded`. O aviso não é assinado e não dá baixa sozinho: grava "consulte de novo". O conciliador, a cada cerca de 10 segundos, confirma na InfinitePay com `payment_check` e só então marca a cobrança paga.

Esse endereço é a API de produção. A cobrança deste teste está no banco local. A produção não a encontra. O `localhost` não recebe o aviso. Por isso a cobrança continuou **Em aberto** depois do comprovante.

A volta do navegador para `/aluno/conta` também não entrou no link: o `APP_URL` local é `http`, e o código só manda `redirect_url` quando a URL é `https`.

## O que este teste responde

- Com InfiniteTag e API Key, o consultoria gera um link e a InfinitePay cobra no cartão.
- Com os juros em **Aluno**, o comprovante mostra um valor maior que o da cobrança. A diferença é a taxa, não um erro de valor.
- O webhook configurado aponta para `TREINOS_PAGAMENTOS_URL_PUBLICA`. Se essa URL não for a API que criou a cobrança, a baixa automática não ocorre.

## O que este teste não fez

O roteiro de `docs/pagamentos-infinitepay.md` (seção "Roteiro do teste real de R$ 1") continua em aberto nestes pontos:

- Gerar o link só com a InfiniteTag, sem API Key.
- Pagar com PIX.
- Pagar o mesmo link duas vezes e ver o `single_payment`.
- Parcelar em 2 vezes e anotar `amount` e `paid_amount`.
- Estornar pelo app da InfinitePay e ver o aviso `refunded`.
- Receber o webhook na mesma API que gerou a cobrança e ver a baixa automática.

Para a baixa automática valer num teste local, `TREINOS_PAGAMENTOS_URL_PUBLICA` precisa ser um https que a InfinitePay alcance e que chegue nesta API, não em `https://overtraining.app/api`.

Para fechar esta cobrança de R$ 1,00 na cópia local, o caminho é a baixa manual: abrir nov/2026 e usar **Registrar pagamento**. Nas formas manuais não há cartão. Cartão online só entra pelo webhook. A forma manual correspondente a este teste é **Outro**. O valor registrado continua R$ 1,00.
