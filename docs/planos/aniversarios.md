# Aniversários no Início do treinador (C08)

Situação: Em andamento (Onda 2F da sessão de 17/11/2026) · Onde: main · Atualizado: 17/11/2026 · Base: `e6537dc3`

Fonte: decisões do Gustavo de 17/11/2026. Validade: vale enquanto `aluno.data_nascimento` (V070) existir e o Início do treinador for a tela de entrada.

## Objetivo
O treinador vê no Início quem faz aniversário nos próximos dias, para lembrar de cumprimentar. Não há envio ao aluno.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | O que aparece | nome e dia/mês; nunca a idade nem o ano | Gustavo, 17/11 |
| D2 | Quem vê | só com a permissão `ALUNO_LER`; fonte `aluno.data_nascimento` (V070) | Gustavo, 17/11 |
| D3 | Janela | N = 0, 3, 7 ou 15 dias; preferência do aparelho, como `diasSemRegistro` em `dominio/configuracoes.ts` | Gustavo, 17/11 |
| D4 | Configuração | item no hub de Configurações leva a essa escolha | Gustavo, 17/11 |
| D5 | Sem envio ao aluno | nada de mensagem, e-mail ou WhatsApp | Gustavo, 17/11 |
| D6 | LGPD | a data de nascimento nunca vai a log nem a auditoria | Gustavo, 17/11 |
| D7 | Sem compatibilidade | sem flag; é tela nova | regra do projeto |

## Contrato da API
`GET /alunos/aniversariantes?dias=<0|3|7|15>&meus=<true|false>` (`AniversariantesController`, `@PreAuthorize("hasAuthority('PERM_ALUNO_LER')")`).
- `dias` obrigatório; fora de 0, 3, 7 ou 15 (ou ausente, ou não numérico) = 400. `meus=true` = só os alunos do responsável autenticado, como "Meus alunos".
- Resposta: lista, do mais próximo ao mais distante (empate por nome), de `{alunoId, nome, dia, mes, diasAte}` (`diasAte` 0 = hoje, em Brasília). Nunca ano nem idade: a consulta JPQL (`AlunoRepository.nascimentosSemAnoDoEscopo`) já extrai só dia e mês, o ano não sai do banco.
- Escopo: alunos ativos, não anonimizados e com data de nascimento, da consultoria da sessão (`@TenantId`). Outra consultoria não aparece (lista vazia, sem 404: a rota não recebe id).
- Não é auditado; `NascimentoSemAno` esconde nome e data no `toString`; nada vai a log (D6).
- 29/02: em ano não bissexto comemora em 28/02 (`MonthDay.atYear` na API, a mesma regra em `dominio/aniversariosDosAlunos.ts`).

## Passos
- [x] 1. API e regra pura em `dominio/` com teste: aniversariantes dos próximos N dias, virada de ano, 29/02 — feito em `b9a6c3bf`. `AniversariantesService`/`Controller`, `AniversariantesIntegrationTest`, `AniversariantesRegraTest`, `dominio/aniversariosDosAlunos.ts` (+ teste) · commit: `b9a6c3bf`
- [x] 2. Cartão "Aniversários" no Início do treinador, preferência `diasAniversario` (0, 3, 7 ou 15; padrão 7) escolhida em Ajustes e item "Aniversários dos alunos" no hub de Configurações — feito em `b9a6c3bf`. Cartão fora da grade e do "Editar" (`shortcut` em `BlocoAniversarios.tsx`); e2e escrito em `app/e2e/aniversarios.spec.ts`, ainda não rodado (Onda 5) · commit: —
- [x] 3. Revisão independente (data de nascimento, LGPD) — feita em 17/11: sem vazamento de ano ou idade nem quebra de autorização; ajustes pequenos aplicados (toString do record, espera da preferência no Início); lacunas de teste (sem responsável com `meus`, anonimizado isolado, espera do pedido no e2e) ficam para a Onda 5 · commit: ver abaixo

## Critérios de aceite
- Sem `ALUNO_LER` o bloco não aparece e a API não devolve data.
- Nenhum log, auditoria ou resposta de erro contém a data; a tela mostra só dia/mês.
- Teste cobre N = 0, 3, 7, 15, virada de ano e 29/02.

## Fora do escopo
- Aviso ou mensagem ao aluno; mostrar a idade; exportar a lista.

## O que ficou para trás
- (nada ainda)
