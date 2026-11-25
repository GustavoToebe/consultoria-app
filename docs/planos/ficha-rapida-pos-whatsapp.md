# Ficha rápida pós-WhatsApp: aceite só com pagamento confirmado (Fase 3 pós-piloto)

Situação: Feito em 25/11/2026 · Onde: `financeiro-fases-2-e-3` · Atualizado: 25/11/2026 · Ordem: depois da Fase 1 ([contrato-fechado.md](contrato-fechado.md)) e **antes** da Fase 2 ([pausar-acesso-por-atraso.md](pausar-acesso-por-atraso.md))

Fonte: roteiro do Saraiva de 24/11/2026 (`R1030-C62` e `R1121-C04`) e as correções do Gustavo na mesma data. Validade: a leitura do código é de 24/11/2026 sobre `9918601b`; reler `InscricaoService`, `PagamentoInscricao` e o cartão "Link" antes de começar.

## Objetivo
Depois de conversar no WhatsApp, o Saraiva manda um formulário curto (nome, WhatsApp, e-mail e plano). Quem preenche cai em Interessados e só vira aluno depois que o treinador confirma o pagamento ("tudo só faço depois de pingar o Pix"). O número de quem pagou aparece separado do de aceites.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Sem situação nova | Reusa `PagamentoInscricao` (`AGUARDANDO` e `CONFIRMADO_MANUAL`, que já existem); `SituacaoInscricao` não ganha `AGUARDANDO_PAGAMENTO` | Gustavo, 24/11 |
| D2 | Sem promoção automática por webhook | O link de pagamento nasce de cobrança de aluno e a inscrição ainda não é aluno (`cobranca_aluno.aluno_id` é `NOT NULL`); o treinador confirma o pagamento à mão | Gustavo, 24/11 |
| D3 | Mínimo da fase | (1) segundo link público; (2) o aceite exige pagamento confirmado, com "Aceitar sem cobrança" à parte; (3) indicador "Pagaram" separado de aceites (`R1121-C04`) | Gustavo, 24/11 |
| D4 | Vaga | O limite de alunos do plano continua valendo no aceite (`AlunoService.criar`, `PlanoDaConsultoria.exigirVagaDeAluno`, 409 `LIMITE_DO_PLANO`) | regra do projeto |

## O que o código faz hoje (leitura de 24/11)
- O link público mora no questionário de finalidade `INSCRICAO` (`codigo_publico`, `publico_aberto`, `link_versao`; V067, `ck_questionario_link_so_inscricao`). O cartão "Link" do Interessados ainda é a `inscricao_configuracao` (uma linha por consultoria), que a V067 tratou como o controle de verdade. [formularios-unificados.md](formularios-unificados.md) (D3) já decidiu o caminho: vários links públicos (`1:N`), um `codigo_publico` por questionário. Falta conferir, ao começar, por que a tela e o `LinkDoFormularioController` ainda tratam um só e o que muda na `inscricao_configuracao`.
- Submissão: `InscricaoService.registrarPublica` (`:171-216`) cria a inscrição em NOVA; `PagamentoInscricao` tem `NAO_CONTROLADO`, `AGUARDANDO`, `CONFIRMADO_MANUAL` (registro manual).
- Aceite: `InscricaoService.aceitar` (`:394-435`) exige permissões do usuário, trava a consultoria, recusa e-mail já de aluno (`ALUNO_JA_EXISTE`), cria o aluno e marca ACEITA; **não cria contratação nem cobrança**.
- Indicadores: `IndicadoresDeInscricoes` (entradas, aceites, conversão, perdas, origens) e `treinador/interessados/Indicadores.tsx`; hoje "aceite" é o que mais se parece com "pagou".
- Kanban: `QuadroKanban.tsx` com `ETAPAS_ABERTAS`.

## Passos
- [x] 1. Segundo link público (a ficha rápida) com perguntas mínimas, pela regra de múltiplos links de `formularios-unificados.md` — executor
- [x] 2. Aceite exige `CONFIRMADO_MANUAL` e tem "Aceitar sem cobrança" (cortesia) separado, com auditoria de resumo fixo; o limite de alunos continua no aceite — executor; tela com `executor-front`
- [x] 3. Indicadores "Inscritos", "Aguardando pagamento", "Pagaram" e "Cortesias" separados de aceites, na API e em `Indicadores.tsx` — executor e `executor-front`
- [x] 4. Revisão independente (aceite, pagamento, dado de terceiro) e `AGENTS.md`, Ajuda e guias

## Fora do escopo
- Cobrança ligada ao interessado e promoção automática a aluno por webhook (D2); situação nova no kanban (D1); cálculo de comissão ou de métrica por competência.

## O que ficou para trás
- Decisão pendente do roteiro: critério exato de "Pagaram" no painel (competência × data de pagamento), item 7 do bloco 3 de [inventario-pendencias-23-11.md](inventario-pendencias-23-11.md).
