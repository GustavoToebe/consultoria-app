# Lembretes de cobrança (e-mail automático e WhatsApp manual)

Situação: Código pronto na branch, falta rodar os testes de integração (Docker) e juntar · Onde: branch `evo-lembretes` · Atualizado: 28/10/2026

## Objetivo
O treinador liga, no Financeiro, lembretes automáticos por e-mail para o aluno (antes do vencimento, no dia e depois), sem
mandar duas vezes o mesmo, e tem na folha da cobrança um botão que abre o WhatsApp com a mesma mensagem pronta. Pagamento
atrasado continua sem bloquear nada do aluno: o lembrete só informa.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Canal automático | Só e-mail, pelo `EnviadorDeEmail` do módulo auth (existe só com `TREINOS_EMAIL_HABILITADO`). Sem o bean nada é planejado e os `PENDENTE` viram `CANCELADO` (`EMAIL_DESLIGADO`): nada fica preso | Gustavo |
| 2 | Configuração por consultoria | Desligada por padrão; antes 0 a 15 (padrão 3), no dia sim/não (padrão sim), depois 0 a 30 (padrão 3); 0 = não manda. `GET/PUT /financeiro/lembretes`, PUT com `versao` | Gustavo |
| 3 | Sem duplicidade | Tabela `lembrete_cobranca` com chave única (consultoria, cobrança, tipo); `PENDENTE`/`ENVIADO`/`FALHOU`/`CANCELADO`; 3 tentativas, erro só como classe | Gustavo |
| 4 | Horário do job | De hora em hora, das 9h às 20h de Brasília (minuto 7). Cada rodada planeja (idempotente) e envia; a nova tentativa sai na hora seguinte | Claude |
| 5 | Janela de cada lembrete | ANTES: de `vencimento − dias` até 2 dias depois, sempre antes do vencimento; NO_DIA: só no dia; DEPOIS: de `vencimento + dias` até 2 dias depois. A folga de 2 dias cobre a API fora do ar sem mandar lembrete de cobrança antiga ao ligar a configuração | Claude |
| 6 | Conferência antes de enviar | Cobrança ABERTA, regra ainda devida hoje para o mesmo tipo (configuração desligada, alterada ou vencimento reajustado = `CANCELADO`), aluno ativo e não anonimizado, contratação ATIVA, e-mail válido | Gustavo (aberta) + Claude (resto) |
| 7 | Contratação pausada ou encerrada | Não envia (`CANCELADO`, `CONTRATACAO_NAO_ATIVA`): pausar costuma ser combinado com o aluno | Claude |
| 8 | Destino do e-mail | O e-mail do cadastro do aluno; sem ele, o e-mail de login; sem nenhum, `CANCELADO` (`SEM_EMAIL`), que a folha mostra ao treinador | Claude |
| 9 | Texto | Fixo, sem saúde: "Olá, {primeiro nome}. A mensalidade de {consultoria} no valor de R$ X vence em DD/MM." (variações para hoje e atrasada) + `APP_URL/aluno/conta`; nada de link de checkout. Nunca em log | Gustavo |
| 10 | Mensagem do WhatsApp | Montada pela API (`GET /cobrancas/{id}/lembretes`, campo `whatsapp`) com o mesmo `TextoDoLembrete` do e-mail, para ser igual; o app só monta o `wa.me` (`dominio/lembretesDeCobranca`) | Claude |
| 11 | Auditoria do envio | Nenhuma: a linha do lembrete é o registro. Só a configuração é auditada (`LEMBRETES_DE_COBRANCA_CONFIGURADOS`, resumo fixo, só quando muda) | Claude |
| 12 | LGPD | A linha não guarda e-mail, nome, valor nem texto: só tipo, situação, datas e classe do erro. Exportação leva (seção `financeiro.lembretes`); a anonimização não precisa apagar nada. Aluno que sai: as cobranças abertas são canceladas e o job cancela os pendentes | Claude |

## Passos
- [x] 1. API: migration V037, regra pura, texto, job, rotas, exportação, testes — commit: 83c2d09
- [x] 2. App: aba "Lembretes" do Financeiro (cartão "Lembretes de cobrança"), lista na folha da cobrança, botão do WhatsApp, regra pura com teste, ajuda e e2e — commit: d3e7ad9
- [ ] 3. Rodar `mvn verify` com Docker (os testes de integração novos não rodaram nesta máquina) e o e2e no checkout principal depois de juntar as frentes — Gustavo/coordenador

## Fora do escopo
- WhatsApp automático (precisa de provedor pago e autorização do aluno).
- Lembrete por notificação no celular.

## O que ficou para trás
- `LembretesDeCobrancaIntegrationTest` e o caso novo de `PagamentosDesligadosIntegrationTest` só foram compilados (sem Docker
  aqui). Rodar `mvn verify`.
- Ligar em produção exige o e-mail do app ligado (`TREINOS_EMAIL_HABILITADO`, Resend); o plano grátis do Resend tem 100
  e-mails por dia, que os lembretes passam a dividir com convites e "esqueci a senha".
- O aluno desliga os lembretes para si em Conta › Meu plano (`GET/PUT /aluno/lembretes-de-cobranca`); a folha da cobrança
  mostra "O aluno desligou os lembretes por e-mail". App feito; a API é de outro agente. Vale a revisão jurídica do e-mail
  transacional de cobrança.
- O texto não leva o nome do plano nem a competência; se o treinador pedir, entra em `TextoDoLembrete` (sem dado de saúde).

## Texto para o AGENTS.md
- Lembretes de cobrança (`pagamentos/`, V037; plano em `docs/planos/lembretes-de-cobranca.md`): **só e-mail**, pelo `EnviadorDeEmail` do módulo auth (existe só com `TREINOS_EMAIL_HABILITADO`; pego por `ObjectProvider`). Configuração por consultoria em `lembrete_configuracao` (`ConfiguracaoDeLembretes`, uma linha; sem linha = desligada, 3 dias antes, no dia, 3 dias depois): `GET/PUT /financeiro/lembretes` (`FINANCEIRO_LER`/`FINANCEIRO_ALTERAR`, `@ExigePagamentos`; PUT com `versao` como o recebimento online: criar com versão ou alterar sem/com versão velha = 409 `CONFLITO_EDICAO`; `diasAntes` 0–15 e `diasDepois` 0–30, 0 = não manda, fora disso 422 `LEMBRETES_INVALIDOS` no campo; resposta com `emailDisponivel`), auditoria `LEMBRETES_DE_COBRANCA_CONFIGURADOS` com resumo fixo só quando muda. Regra pura `RegraDosLembretes.devido(hoje, vencimento, config)` (sem banco nem relógio; teste `RegraDosLembretesTest`): ANTES de `vencimento − dias` até 2 dias depois e sempre antes do vencimento, NO_DIA só no dia, DEPOIS de `vencimento + dias` até 2 dias depois (`FOLGA_EM_DIAS`: cobre o job parado sem mandar lembrete de cobrança antiga ao ligar). Fila `lembrete_cobranca` (`LembreteDeCobranca`, `@Immutable` na JPA; chave única `(consultoria, cobrança, tipo)` = nunca dois do mesmo; `PENDENTE`/`ENVIADO`/`FALHOU`/`CANCELADO` com `motivo` `COBRANCA_NAO_ABERTA`, `NAO_E_MAIS_DEVIDO`, `CONTRATACAO_NAO_ATIVA`, `ALUNO_INATIVO`, `SEM_EMAIL` ou `EMAIL_DESLIGADO`; a linha não guarda endereço, nome, valor nem texto, e o erro só como classe). Job `LembretesDeCobranca` (`@Scheduled` de hora em hora das 9h às 20h de Brasília, minuto 7; só com o financeiro ligado; `TREINOS_PAGAMENTOS_LEMBRETES_AGENDADOS`, `false` nos testes, que chamam `rodar(hoje, enviador)`): planeja (insert `on conflict do nothing`), reserva lotes com `for update skip locked` (lease 300 s), confere tudo de novo logo antes de enviar numa transação curta somente leitura dentro da consultoria (`PreparoDoLembrete`: cobrança ABERTA, regra ainda devida para o mesmo tipo, contratação ATIVA, aluno ativo e não anonimizado, e-mail do cadastro ou, sem ele, o de login), envia **fora de transação** e conclui conferindo a posse; falha conta tentativa (3, depois `FALHOU`; nova tentativa em 50 min). Sem o `EnviadorDeEmail` nada é planejado e os pendentes viram `CANCELADO` (`EMAIL_DESLIGADO`). SQL nativo só em `LembretesRepositorio` (fila global, `consultoria_id` explícito; exceção no `ArquiteturaTest`). Texto fixo `TextoDoLembrete` (primeiro nome, consultoria, valor, vencimento e `APP_URL/aluno/conta`; nunca saúde nem link de pagamento; nada em log; teste `TextoDoLembreteTest`). `GET /cobrancas/{id}/lembretes` (`FINANCEIRO_LER` + `ALUNO_LER`; outra consultoria 404) devolve os lembretes e `whatsapp {telefone, mensagem}` (o mesmo texto do e-mail, para hoje; só cobrança ABERTA de aluno ativo; telefone do `Usuario`, nulo sem acesso). Exportação do aluno: `financeiro.lembretes` (tipo, situação, datas); anonimizar não apaga (não há dado pessoal) e o aluno que sai tem as cobranças canceladas, então o job cancela os pendentes. Testes: `LembretesDeCobrancaIntegrationTest` (não duplica, cancela quando paga no meio, e-mail desligado, falha do provedor, sem e-mail, contratação pausada, outra consultoria, folha e exportação), `PagamentosDesligadosIntegrationTest`. App: aba "Lembretes" do Financeiro (`treinador/financeiro/AbaLembretes`, `?aba=lembretes`), lista "Lembretes por e-mail" e botão "Abrir WhatsApp com a mensagem" na `FolhaDaCobranca` (abre `wa.me` fora do app, sem token; sem telefone fica desabilitado com `motivo`; nada é registrado como enviado), regras puras em `dominio/lembretesDeCobranca.ts` (`lerDias`, `resumoDosLembretes`, `situacaoDoLembrete`, `numeroDoWhatsApp`, `linkDoWhatsApp`, `botaoDoWhatsApp`). E2e: `e2e/financeiro.spec.ts` (quatro casos de lembretes).
