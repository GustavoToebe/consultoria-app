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

## Decisões (todas em aberto)
| # | Decisão | Opções | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Forma da supervisão | (a) fila "para revisar" do dono, depois de publicado; (b) aprovação antes de publicar | Gustavo |
| D2 | Alcance | só membros marcados como "precisa de revisão", ou todos | Gustavo |
| D3 | Alunos por treinador | aviso configurável, sem limite rígido | Gustavo |

## Passos
- [ ] 1. Decidir D1 a D3 com o treinador do piloto (mexe em permissões e na publicação: revisão do Opus obrigatória) — commit: —

## Fora do escopo
- Qualquer código antes das decisões (C65 e C79 ficam em "Pendências soltas").

## O que ficou para trás
- —
