# Agenda estilo Google (ajustes do PDF de 02/11)

Situação: Concluída em 02/11/2026 · Onde: `main` (PR #33, CI verde) · Atualizado: 02/11/2026

## Objetivo
Deixar a Agenda do treinador mais parecida com o Google Agenda, como o Gustavo pediu no PDF "Ajuste agenda": a barra do
calendário numa linha reta, um botão só para a visão ("Mês ▾"), filtros e repetição em listas suspensas e o "Novo
compromisso" (e o "Novo evento") como painel rápido com "Mais opções".

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Barra do calendário | Hoje, ‹ ›, título e "Mês ▾" numa linha; o "Hoje" fica sempre habilitado (sem o texto do motivo embaixo) | Gustavo (PDF) + Claude |
| 2 | Seletor de visão | Botão "Mês ▾" com menu Dia/Semana/Mês/Ano e as letras dos atalhos (D/W/M/Y); sem "Programação", "4 dias" nem "Mostrar fins de semana" (o app não tem) | Gustavo (PDF) + Claude |
| 3 | Filtro "Compromissos" | `SelecaoMultiplaSuspensa`, várias situações ao mesmo tempo (`?situacao=A,B`); a API já aceitava `situacao` repetível, o back não muda | Gustavo (02/11) |
| 4 | Modal | Painel rápido com linhas de ícone + "Mais opções" na mesma Folha (sem rota nova); edição abre direto no completo | Gustavo (02/11) |
| 5 | Horário | "Início até fim" no lugar de hora + chips + minutos; a duração é calculada e o contrato com a API não muda | Gustavo (02/11) |
| 6 | Repetição | Lista suspensa com rótulos do Google ("Semanal: cada quarta-feira", "Mensal no dia 18", "Anual em 18 de novembro"…) e "Personalizar…" | Gustavo (PDF) + Claude |
| 7 | Alcance | Compromisso e Evento ganham o mesmo visual | Gustavo (02/11) |

## Passos
- [x] 1. Regras puras em `dominio/` com teste (situações em lista, início–fim, rótulos da repetição) — executor — commit: 3b848e67
- [x] 2. Telas: barra, menu da visão, filtro, painel rápido + Mais opções (compromisso e evento) e e2e — executor-front — commit: 3b848e67
- [x] 3. Verificação: typecheck, lint, 3408 testes, e2e inteiro (474 ok; 2 falhas do ciclo menstrual por data, fora desta frente) e capturas em 1280 e 390 px — executor-front — commit: 3b848e67
- [x] 4. Revisão (advisor) e commit na branch — commit: 3b848e67 + 0fa42d9d (ajuste da revisão)
- [x] 5. Junção com a `origin/main` (b4ff455, já estava em dia), guia do treinador em PDF regerado e push da branch com PR para a `main` (liberado pelo Gustavo em 02/11) — commit: 0a6f27cc, PR #33

## Fora do escopo
- "Mensal na terceira quarta-feira" (o back repete no mesmo dia do mês).
- Visões "Programação" e "4 dias" e as opções "Mostrar fins de semana" etc. do menu do Google.

## O que ficou para trás
- Voltar do "Mais opções" para o painel rápido.
- e2e do ciclo menstrual dependente da data (achado aqui, não é desta frente): corrigido no PR de documentação e testes de 02/11.
- Evento de 24 h (fim igual ao início): corrigido no mesmo PR.
- (cada sobra também vai para "Pendências soltas" no README)
