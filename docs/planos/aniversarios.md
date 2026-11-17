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

## Passos
- [ ] 1. API (se faltar o dado no contrato do Início) e regra pura em `dominio/` com teste: aniversariantes dos próximos N dias, virada de ano, 29/02 — executor · commit: —
- [ ] 2. Bloco no Início do treinador e item no hub de Configurações — executor (mesma tarefa da Onda 2F; tela simples, bloco já no padrão do Início) · commit: —
- [ ] 3. Revisão independente (data de nascimento, LGPD) — revisor, só leitura · commit: —

## Critérios de aceite
- Sem `ALUNO_LER` o bloco não aparece e a API não devolve data.
- Nenhum log, auditoria ou resposta de erro contém a data; a tela mostra só dia/mês.
- Teste cobre N = 0, 3, 7, 15, virada de ano e 29/02.

## Fora do escopo
- Aviso ou mensagem ao aluno; mostrar a idade; exportar a lista.

## O que ficou para trás
- (nada ainda)
