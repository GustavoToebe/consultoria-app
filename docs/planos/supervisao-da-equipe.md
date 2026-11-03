# Supervisão da equipe pelo dono da consultoria

Situação: Planejando (só decisões, sem código; não entra na leva de 02/11) · Atualizado: 02/11/2026 · Registro: reunião de 30/10, C65, C79

## Objetivo
O treinador do piloto revisa tudo o que a equipe faz (atualizações, dieta, uso de substâncias): "eu tenho que
supervisionar tudo". Hoje isso acontece fora do app. Ele também não quer escalar: no máximo cerca de 50 alunos por
treinador da equipe (1:56 a 1:58).

## O que o código faz hoje (main 19b1fd6)
- Perfis padrão: Administrador, Assistente, Nutricionista e Treinador, editáveis e duplicáveis. O Treinador não altera
  a Marca, e o Financeiro fica só com o Administrador.
- Não há fluxo de revisão ou aprovação antes de publicar.
- O limite de alunos é da consultoria (direitos do plano), não do treinador.

## Decisões (Gustavo, 03/11/2026; não perguntar de novo)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Supervisão (C65) | versão pequena: em Números, uma tabela por membro da equipe só com contagens (alunos ativos, atualizações atrasadas e para revisar), **sem nome de aluno**; nada de fila de revisão nem aprovação antes de publicar | Gustavo |
| D2 | Limite de alunos (C79) | campo "Limite de alunos" no cadastro de cada membro da equipe, que só o Administrador edita; em branco = sem limite | Gustavo |
| D3 | Acima do limite | pôr alguém como responsável de um aluno acima do limite: a API recusa com 409 e mensagem clara, em todos os caminhos (criar aluno, trocar o responsável, ação em lote, aceite de inscrição e planilha) | Gustavo |
| D4 | Quem já passou | quem já está acima do limite não perde nenhum aluno | Gustavo |
| D5 | Quando | sem código agora: as duas entram depois da leva 2 | Gustavo |

## Passos
- [ ] 1. Limite de alunos (D2 a D4): migration, API nos cinco caminhos com 409 e teste de cada um, campo no cadastro da equipe (permissões e tenant: revisão do Opus obrigatória) — executor + executor-front — commit: —
- [ ] 2. Tabela da supervisão em Números (D1), só contagens, com teste de que nenhum nome de aluno sai na rota — executor + executor-front — commit: —

## Fora do escopo
- Fila "para revisar" do dono e aprovação antes de publicar (D1).
- Tirar aluno de quem já passou do limite (D4).

## O que ficou para trás
- —
