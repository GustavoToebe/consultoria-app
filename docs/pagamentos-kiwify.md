# Kiwify automática: configurar o webhook e ligar em produção

A Kiwify cobra a assinatura mensal do aluno e avisa a API por webhook. A API não dá baixa pelo aviso: consulta a venda na
Kiwify (`GET /v1/sales/{id}`) e só então baixa a mensalidade. O app não gera link nem Pix para essa mensalidade. Código em
`api/.../pagamentos/Kiwify*`, regras no `AGENTS.md` (item "Kiwify automática") e decisões D16 a D20 em
`docs/planos/financeiro-em-fases.md`. Desligada por padrão.

**Antes de ligar em produção:** os nomes de menu da Kiwify abaixo podem ter mudado, e o payload real do evento de compra
aprovada **ainda não foi capturado**. A API assume `order_id`, `webhook_event_type` e `subscription_id` no aviso, e `id`,
`status`, `product.id`, `customer.email`, `payment.charge_amount` (em centavos) e `payment.charge_currency` na venda. Antes
de ligar, dispare "Testar Webhook" na Kiwify e confira em "Ver logs" o corpo real; se um nome diferir, o ajuste é em
`AvisoKiwifyService` (`EVENTOS` e os `path`) e `KiwifyCliente.lerVenda`.

## Passo a passo do webhook (treinador)

1. No Overtraining (Financeiro, aba Recebimento, cartão "Assinaturas pela Kiwify"), invente um token do webhook com 16
   caracteres ou mais, guardado só por você. Ele é a chave da assinatura dos avisos.
2. Na Kiwify, crie a chave de API (Apps, API): ela dá `client_id`, `client_secret` e `account_id`.
3. No Overtraining, preencha os quatro valores e salve. A tela mostra a URL do webhook
   (`<url pública>/publico/pagamentos/kiwify/<token do caminho>`) e os 4 últimos caracteres do `client_id`. Os valores nunca
   voltam à tela depois de salvos.
4. Na Kiwify, crie o webhook (Apps, Webhooks): URL = a copiada; token = o digitado no passo 1; produtos = os dos planos;
   eventos = compra aprovada (`order_approved`), assinatura renovada (`subscription_renewed`), assinatura cancelada
   (`subscription_canceled`), compra reembolsada (`order_refunded`) e chargeback (`chargeback`). Os outros eventos são
   respondidos com 200 e ignorados.
5. No plano comercial mensal, marque "Assinatura cobrada pela Kiwify" e informe o ID do produto na Kiwify. Cada produto vale
   para um plano não arquivado por consultoria; plano que não é mensal não aceita.
6. Confira que o e-mail do aluno no cadastro é o mesmo da compra (a baixa casa por e-mail, sem diferença de caixa).
7. Teste com uma compra de valor baixo. Esperado: em até cerca de 10 s a mensalidade aberta vira paga (forma Kiwify). Se não
   casar, aparece em "Para conferir" com o motivo (pagamento confirmado nunca é ignorado, ver "Riscos conhecidos").
8. Trocar o token: salve o novo na Kiwify e no Overtraining (o anterior continua valendo por 24 h). Remover a Kiwify: apague
   também o webhook na Kiwify, pois a URL antiga passa a dar 404.

## Variáveis de ambiente (só os nomes; nunca valores neste arquivo)

| Variável | Padrão | Papel |
|---|---|---|
| `TREINOS_PAGAMENTOS_KIWIFY_HABILITADO` | `false` | liga a Kiwify; desligada, as rotas dão 503 `KIWIFY_INDISPONIVEL` |
| `TREINOS_PAGAMENTOS_KIWIFY_URL_API` | `https://public-api.kiwify.com` | base da API da Kiwify; https (http só em localhost e 127.0.0.1) |
| `TREINOS_PAGAMENTOS_KIWIFY_CONCILIACAO_ATIVA` | `true` | liga o conciliador agendado; `false` só nos testes |
| `TREINOS_PAGAMENTOS_CHAVES` | sem padrão | cifra AES-GCM das credenciais (as mesmas da InfinitePay) |
| `TREINOS_PAGAMENTOS_CHAVE_ATIVA` | sem padrão | id da chave de cifra em uso |
| `TREINOS_PAGAMENTOS_URL_PUBLICA` | sem padrão | base https da URL do webhook |

Ligada, a API só sobe com as três últimas (https na URL pública) e confere se as credenciais já cifradas têm id de chave
conhecido. O `docker-compose.yml` local não repassa as três variáveis da Kiwify: em produção elas entram no
`consultoria.env` da VPS.

## Checklist de produção

- [ ] Payload real de `compra_aprovada` (`order_approved`) capturado com "Testar Webhook" e "Ver logs", e os campos assumidos
      conferidos (ver o aviso no alto).
- [ ] `TREINOS_PAGAMENTOS_CHAVES`, `TREINOS_PAGAMENTOS_CHAVE_ATIVA` e `TREINOS_PAGAMENTOS_URL_PUBLICA` já gravados (se a
      InfinitePay já está ligada, são as mesmas). Segredos entram pelo `gravar-segredo.sh` do `central-api-back/deploy`, como
      em `docs/pagamentos-infinitepay.md`; nunca pelo chat, pelo git ou por log.
- [ ] URL pública em https e alcançável pela Kiwify.
- [ ] Só depois, `TREINOS_PAGAMENTOS_KIWIFY_HABILITADO=true` no `consultoria.env` e recriar a API (`recriar.sh`).
- [ ] Credenciais configuradas pelo treinador no app, webhook criado na Kiwify e compra de teste de valor baixo feita
      (passos 1 a 7).
- [ ] Planos mensais marcados com o produto da Kiwify; e-mails dos alunos conferidos.

## Riscos conhecidos

- **Replay do webhook.** A assinatura (HMAC-SHA1 do corpo cru, em `?signature=`) não leva data nem id de entrega; quem
  capturar uma entrega válida pode repeti-la. Mitigações: o aviso grava só identificadores, é idempotente (`order_id` +
  evento), tem teto de 16 KiB e a baixa nunca nasce do aviso, e sim da consulta da venda à Kiwify.
- **Token no caminho.** O token do caminho pode aparecer no log de acesso do proxy; sozinho ele só permite gravar avisos que
  serão conferidos. O HMAC só prova que quem enviou conhece o token do webhook.
- **E-mail do comprador.** A baixa automática depende de o e-mail da compra ser o de um único aluno ativo. Comprador com
  e-mail de terceiro ou alias, ou e-mail errado no cadastro, vai para "Para conferir" (ou, no pior caso, o treinador dá a
  baixa à mão).
- **Pagamento confirmado que não casa nunca some.** Venda com `status=paid` (compra aprovada ou renovada) sem baixa que não
  casa com mensalidade vira "Para conferir" e nunca `IGNORADO`, inclusive a de um produto que não é de plano algum
  (arquivados incluídos), com o motivo `COBRANCA_NAO_ENCONTRADA` e só o valor pago gravado. Quem decide é o treinador:
  dinheiro entrou na conta da Kiwify. Venda não paga (aguardando, recusada) e os avisos de cancelamento, reembolso e
  chargeback de produto de fora dos planos continuam `IGNORADO`; avisos `IGNORADO` e baixados somem 180 dias depois, os de
  "Para conferir" só quando conferidos. A regra "só um aluno ativo com contratação Kiwify" não existe: o e-mail precisa casar
  com um único aluno ativo, como sempre.
- **Juros de parcelamento em `charge_amount`.** Se a Kiwify devolver valor diferente do plano em venda parcelada, vira
  `VALOR_DIFERENTE` (seguro, mas exige conferência manual). Só se confirma com a venda de teste.
- **Sem varredura de vendas.** Não há varredura de vendas: se a Kiwify desistir dos reenvios (API ou chave fora do ar), a
  baixa se perde e a mensalidade automática não tem lembrete nem link; só a equipe vendo a cobrança vencida percebe.
- **Moeda ausente.** `payment.charge_amount` sem moeda na venda é aceito como BRL.
- **Limites desconhecidos.** Taxa de requisições e validade do token OAuth reais da Kiwify não foram medidos (os testes usam
  uma Kiwify de mentira).
- **Credencial na memória.** Fica decifrada em memória durante a conferência e a consulta, e o token OAuth fica em cache em
  memória; nada disso vai a log, auditoria ou mensagem de erro.

## Decisões abertas (Gustavo)

1. **Lembrete depois de vencida (D18).** Hoje a mensalidade da Kiwify não recebe lembrete nenhum, nem antes nem depois de
   vencer. Falta confirmar se, vencida, ela deve receber.
2. **Token do webhook: digitado ou gerado.** A pesquisa não confirma se a Kiwify gera o token ou se a pessoa o digita. Hoje
   o treinador digita (mínimo de 16, escolha nossa); um botão "Gerar token" seria uma melhoria.
3. **Regra das lojas (D7).** No celular com a chave da loja desligada, o aluno vê "Cobrança automática pela Kiwify". A frase
   cita um meio de pagamento de fora do app; confirmar que cabe na D7.
4. **Mensalidade vencida da Kiwify no Início do aluno.** Hoje não entra como "Pagamento em aberto" (pela D18).

Decidido em 18/11/2026 (era a decisão aberta 2): mensalidade da Kiwify **não se renegocia**. `POST /cobrancas/renegociar/previa`
e `POST /cobrancas/renegociar` respondem 409 `RENEGOCIACAO_COBRANCA_AUTOMATICA` ("Esta cobrança é cobrada automaticamente
pela Kiwify e não pode ser renegociada."), sem efeito, e uma só cobrança dessas recusa o lote inteiro. Sem a credencial ou
com a Kiwify desligada, a mensalidade volta a ser comum e renegocia. Isso evita a cobrança em dobro (acordo e cartão).
