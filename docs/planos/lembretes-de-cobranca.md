# Lembretes de cobrança (e-mail automático e WhatsApp manual)

Situação: Em andamento · Onde: branch `evo-lembretes` · Atualizado: 28/10/2026

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
| 10 | Mensagem do WhatsApp | Montada pela API (`GET /cobrancas/{id}/lembretes`, campo `whatsapp`) com o mesmo `TextoDoLembrete` do e-mail, para ser igual; o app só monta o `wa.me` (`dominio/whatsappDaCobranca`) | Claude |
| 11 | Auditoria do envio | Nenhuma: a linha do lembrete é o registro. Só a configuração é auditada (`LEMBRETES_DE_COBRANCA_CONFIGURADOS`, resumo fixo, só quando muda) | Claude |
| 12 | LGPD | A linha não guarda e-mail, nome, valor nem texto: só tipo, situação, datas e classe do erro. Exportação leva (seção `financeiro.lembretes`); a anonimização não precisa apagar nada. Aluno que sai: as cobranças abertas são canceladas e o job cancela os pendentes | Claude |

## Passos
- [ ] 1. API: migration V037, regra pura, texto, job, rotas, exportação, testes — commit: —
- [ ] 2. App: cartão "Lembretes de cobrança", lista na folha da cobrança, botão do WhatsApp, regra pura com teste — commit: —

## Fora do escopo
- WhatsApp automático (precisa de provedor pago e autorização do aluno).
- Lembrete por notificação no celular.

## O que ficou para trás
- (preenchido ao final)
