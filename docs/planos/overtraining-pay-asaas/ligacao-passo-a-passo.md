# Ligar o Asaas em produção: passo a passo (só orientação; nada é executado na VPS pelo Claude)

Situação: preparado em 27/11/2026, conta Asaas aprovada. Decisão do Gustavo: o Asaas fica ligado como padrão (`CENTRAL_PAGAMENTO_PROVEDOR=ASAAS`). Nada daqui foi aplicado: os valores e os comandos abaixo são para o Gustavo executar. Nunca cole chave, token ou carteira no chat, no git ou em log.

Pré-requisitos de código (a rodada "antes de ligar" deste lote, ver `overtraining-pay-asaas.md`): Central e consultoria-app com os commits da rodada no ar, na ordem do plano (lote das 3 frentes → Central → consultoria-app). Sem isso, não ligue.

**Ordem que não pode ser invertida: as variáveis do Asaas entram na `central.env` ANTES do deploy da Central.** O padrão do código passou a ser `ASAAS`; se a Central subir com o padrão e sem as variáveis do Asaas, o "Pagar" responde 503 `PAGAMENTO_INDISPONIVEL` até alguém gravá-las. Ou seja: grave as variáveis (seção 1), conclua o cadastro do webhook no painel e só então faça o merge e o deploy da Central. Se preferir testar o deploy antes, grave `CENTRAL_PAGAMENTO_PROVEDOR` com o provedor que está em uso hoje e troque para `ASAAS` só quando o resto estiver pronto.

## 1. Central: variáveis em `/opt/ecossistema/central.env` (VPS)

Segredos entram por `deploy/gravar-segredo.sh` (uma variável por vez, sem eco). Não-segredos podem ser acrescentados ao arquivo. Depois: `deploy/recriar.sh central api` e conferir o health.

| Variável | Valor | De onde vem |
| --- | --- | --- |
| `CENTRAL_PAGAMENTO_PROVEDOR` | `ASAAS` | decisão (já é o padrão do código; grave explícito para não depender do padrão) |
| `CENTRAL_ASAAS_HABILITADO` | `true` | decisão |
| `CENTRAL_ASAAS_URL_BASE` | `https://api.asaas.com/v3` (produção) | documentação do Asaas; o padrão do código é o sandbox, **troque** |
| `CENTRAL_ASAAS_API_KEY` | chave de API da conta principal | painel do Asaas, Integrações, Chaves de API (a chave só aparece na criação: guarde na hora). **Segredo** |
| `CENTRAL_ASAAS_WEBHOOK_TOKEN` | texto aleatório de 32 a 128 letras, números, `_` ou `-` | você gera (por exemplo `openssl rand -hex 32` no seu computador). O mesmo valor vai no painel (item abaixo). **Segredo**. Não pode ser a chave de API |
| `CENTRAL_ASAAS_SOCIO_WALLET_ID` | carteira (walletId) do sócio que recebe os 35% | veja "walletId" abaixo. A carteira da conta principal **nunca** entra aqui |
| `CENTRAL_ASAAS_VARREDURA_ENABLED` | `true` (padrão; não precisa gravar) | liga a varredura de 15 min que acha pagamentos cujo webhook se perdeu (rede de segurança; não cancela nada) |
| `CENTRAL_ASAAS_CANCELAMENTO_ENABLED` | `false` (padrão do código; **não grave `true` agora**) | liga o cancelamento no Asaas da cobrança obsoleta (job de 1 min e cancelamento do Pix antigo). Vem desligado por padrão. **Só ligue depois que o sandbox confirmar que o `DELETE /v3/payments/{id}` recusa cobrança `RECEIVED`/`CONFIRMED`**; se o Asaas aceitar, a checagem prévia de status precisa estar no código antes de ligar (ver `asaas-pagamentos.md` da Central, item 7) |
| `CENTRAL_ASAAS_SOCIO_PERCENTUAL` | `35.00` (padrão) | decisão de 26/11 |
| `CENTRAL_ASAAS_URL_PUBLICA` | `https://api-central.servirea.com.br` | endereço público da API da Central (não é segredo) |

Sem nenhuma `CENTRAL_ASAAS_*` (situação atual da VPS, conferida em 27/11), `CENTRAL_ASAAS_HABILITADO` vale `false`, o Asaas fica desligado e a Central sobe normal; o "Pagar" responde 503 `PAGAMENTO_INDISPONIVEL` enquanto o provedor padrão for `ASAAS` e ele não estiver habilitado.

Com a rodada deste lote, a Central **não sobe** com `CENTRAL_ASAAS_HABILITADO=true` e `CENTRAL_ASAAS_SOCIO_WALLET_ID` vazia (mensagem clara no log do contêiner).

No painel do Asaas (conta principal):
1. **Split:** Integrações, Segurança, "Habilitar Split" (feito pela conta principal, vale para as subcontas).
2. **Webhook da Central:** Integrações, Webhooks, criar: URL `https://api-central.servirea.com.br/webhooks/asaas`, token de autenticação = o valor de `CENTRAL_ASAAS_WEBHOOK_TOKEN` (o Asaas manda no cabeçalho `asaas-access-token`), eventos de cobrança (`PAYMENT_*`: criada, confirmada, recebida, estornada, estorno parcial, chargeback). **Marque à mão `PAYMENT_PARTIALLY_REFUNDED` e os eventos de chargeback** (por padrão podem vir desmarcados): a Central trata os quatro eventos de estorno e chargeback levando o pagamento para `REVISAR`, mas só os recebe se estiverem assinados. A Central não cria esse webhook sozinha.

## 2. consultoria-app: variáveis em `/opt/ecossistema/consultoria.env` (VPS)

O consultoria-app cria o webhook de cada subconta pela API, com token próprio por subconta (cifrado no banco): não há webhook para cadastrar à mão.

| Variável | Valor | De onde vem |
| --- | --- | --- |
| `TREINOS_PAGAMENTOS_HABILITADO` | `true` (se ainda não estiver) | financeiro ligado |
| `TREINOS_PAGAMENTOS_CHAVES`, `TREINOS_PAGAMENTOS_CHAVE_ATIVA` | par `id` e chave AES de 32 bytes em base64 (por exemplo `k1`) | você gera; é a chave de cifra no banco, não é do Asaas. Se a InfinitePay ou a Kiwify já usam, **não troque**. **Segredo** |
| `TREINOS_PAGAMENTOS_URL_PUBLICA` | `https://overtraining.app/api` | já usado pela InfinitePay |
| `TREINOS_PAGAMENTOS_ASAAS_HABILITADO` | `true` | decisão. Ligado, a subida exige as demais |
| `TREINOS_PAGAMENTOS_ASAAS_URL_BASE` | `https://api.asaas.com/v3` | padrão do código é o sandbox, **troque** |
| `TREINOS_PAGAMENTOS_ASAAS_API_KEY_MATRIZ` | chave de API da conta principal (a mesma conta da Central, ou a conta que cria as subcontas) | painel do Asaas, Chaves de API. **Segredo** |
| `TREINOS_PAGAMENTOS_ASAAS_URL_PUBLICA` | `https://overtraining.app/api` | cai em `TREINOS_PAGAMENTOS_URL_PUBLICA` se vazia |
| `TREINOS_PAGAMENTOS_ASAAS_WALLET_MATRIZ` | walletId da conta principal | veja "walletId" |
| `TREINOS_PAGAMENTOS_ASAAS_WALLET_SOCIO` | walletId do sócio (35%) | veja "walletId" |
| `TREINOS_PAGAMENTOS_ASAAS_PERCENTUAL_SOCIO_BPS` | `3500` (padrão) | 35,00% |
| `TREINOS_PAGAMENTOS_ASAAS_CONCILIACAO_ATIVA` | `true` (padrão) | não mexa |

Com a rodada deste lote, o consultoria-app **não sobe** com o Asaas ligado e uma das duas carteiras vazia. Depois: `deploy/recriar.sh consultoria api` e conferir o health.

Depois de no ar, cada treinador liga o Overtraining Pay em Financeiro › Recebimento (cria a subconta, envia os dados da conta e passa pela análise do Asaas; a cobrança de teste de R$ 5,00 promove a subconta para `ATIVA`, e só então a forma "Overtraining Pay" pode ser ligada).

## walletId (de onde vem)
- **Conta principal:** pela API do Asaas com a chave dela (`GET /v3/wallets/`); a documentação do Asaas também mostra o walletId em "Recuperar WalletId" na página de Split.
- **Sócio:** se for subconta, a resposta da criação traz `apiKey` e `walletId`; se for conta própria, ele consulta com a chave dele (nunca peça a chave de API de outra pessoa: peça só o walletId).
- O walletId é identificador, não senha, mas trate como dado interno: só em variável de ambiente.

## 3. Depois do deploy: o que conferir (pagamento de teste real, valor baixo)
1. Health das duas APIs ok e sem erro de subida nos logs (carteira ausente, token de webhook inválido).
2. Central: no painel `/homologacao-split`, a configuração do Asaas aparece como configurada; faça a **cobrança de teste Pix de R$ 5,00** com o seu Pix: tem de aparecer QR Code, o pagamento confirmar sozinho (webhook + consulta) e a situação virar paga. No Asaas, a cobrança aparece com o split de 35% para a carteira do sócio.
3. Central: uma cobrança real baixa (por exemplo mensalidade de uma conta sua de teste) pelo "Pagar": Pix dentro do app e cartão pela página do Asaas (`invoiceUrl`). Use o seu cartão, valor baixo, e estorne depois no painel do Asaas se quiser: o estorno vira `REVISAR`, nunca apaga a baixa.
4. consultoria-app, **primeiro teste só numa consultoria de teste com o seu número, nunca na do Saraiva**: crie a subconta, rode "Sincronizar status", faça a cobrança de teste de R$ 5,00 e depois uma cobrança de aluno de teste de valor baixo (Pix dentro do app e cartão pela página do Asaas). Confira: cobrança vira PAGA sozinha, `valor_liquido_centavos` gravado, split 65/35 no extrato do Asaas, nada em CONFERIR.
5. Conferir no painel do Asaas que o webhook da subconta existe e está sem fila de erro (Integrações, Webhooks), e que a Central não mostra pagamento em `REVISAR`.
6. Se algo falhar: desligar com `TREINOS_PAGAMENTOS_ASAAS_HABILITADO=false` (consultoria) e, na Central, `CENTRAL_PAGAMENTO_PROVEDOR` para o provedor anterior + `recriar.sh`. Nada é apagado; cobranças já criadas no Asaas continuam lá (cancelar à mão no painel).

## 4. Sandbox (rodada "antes de ligar")
O sandbox do Asaas é outra conta (`sandbox.asaas.com`), com chave e carteiras próprias. A rodada usa `https://api-sandbox.asaas.com/v3` e **só precisa de uma conta e de uma chave**: o script cria uma subconta de teste pela API (a resposta traz o walletId dela) e usa esse walletId como o "sócio" do split. A confirmação do pagamento é pela API do sandbox (`POST /v3/sandbox/payment/{id}/confirm`); não é preciso uma segunda conta pagando o QR Code. Se a conta sandbox não puder criar subconta (erro de permissão do Asaas na criação), o script avisa e para: aí vale pedir ao suporte do Asaas a permissão ou usar uma segunda conta sandbox e informar o walletId dela em `ASAAS_SANDBOX_WALLET_SOCIO`.

Arquivo da chave (fora do git): `C:\Users\gusta\.asaas-sandbox.env` com uma linha `ASAAS_SANDBOX_API_KEY=...`. O script o lê sem mostrar o valor, usa dados fictícios (nenhum dado seu ou de aluno) e grava só o resumo da rodada, sem chaves.

**Depois da rodada: apague o `.asaas-sandbox.env` e revogue a chave do sandbox no painel do sandbox (Integrações, Chaves de API).** A subconta criada pelo script pode ficar no sandbox (é de teste).

Detalhes e resultados em `overtraining-pay-asaas.md`.
