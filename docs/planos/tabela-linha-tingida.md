# Tabela com linha tingida (Ficha › Histórico de lesões)

Situação: Em andamento · Onde: branch `ficha-24-11` (sem commit ainda) · Atualizado: 24/11/2026

## Objetivo
A lesão ativa do Histórico de lesões é uma linha tingida de `atencao`. A tabela era uma peça própria dentro do
`CartaoLesoes` e a borda quadrada da linha tingida dobrava a da caixa nas laterais e embaixo. A tabela passa a ser a
`ui/Tabela` compartilhada, com a linha tingida como recurso dela, e o ⋯ fica na altura da primeira linha de texto.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Onde mora a linha tingida | Prop `tingida?: (linha) => boolean` da `ui/Tabela` (fundo liso `forte` e fio de `atencao`, por `ui/superficiePintada`); o `TabelaDeLesoes` próprio some e o `CartaoLesoes` usa a `Tabela` | sessão (noite de 24/11) |
| 2 | Como evitar a borda dobrada | A linha tingida **não leva borda própria**. O fio entre duas linhas é o de baixo da de cima, na cor da tinta se qualquer das duas é tingida (senão `divisor`); a última linha não tem fio (quem fecha é a caixa). Mais seguro que "a última linha herda o raio": nada soma, em qualquer posição da linha tingida | sessão |
| 3 | Recorte pelo raio | A `Tabela` já recorta (`overflow: 'hidden'` + `borderRadius: RAIO` na caixa larga): o canto estava certo, o defeito era só a borda. Nada sai da tabela (⋯ e foco abrem folha/painel por cima, fora da caixa) | conferido no código e nas capturas |
| 4 | ⋯ na altura do texto | Margem negativa só na coluna do ⋯ do `CartaoLesoes` (como a Visão geral do Financeiro já faz); não mudei o `alinharLinhas="topo"` da peça, que as outras tabelas já compensam à mão | sessão |
| 6 | Onde a tabela aparece | Em colunas só a partir de 800 px na própria lista; na ficha de hoje isso é a faixa de 1920 px (em 1280 e 390 vira cartões). Os e2e da geometria rodam em 1920 | conferido nas capturas |
| 5 | Cartão empilhado (< 800 px) | A `Tabela` empilhada já tem borda inteira no próprio cartão; o cartão tingido usa `forte` e a borda `borda` da tinta. A observação passa a ficar dentro do par "Descrição" | sessão |

## Passos
- [x] 1. Capturas "antes" (1920, 1280 e 390; escuro e claro; ativa como última linha e no meio) — `capturas/24-11/item-3-tabela/antes-*`
- [x] 2. `ui/Tabela`: `tingida` e fio único; teste `ui/Tabela.test.tsx` — commit: —
- [x] 3. `CartaoLesoes` usa a `Tabela`; ⋯ alinhado; e2e `ficha-lesoes-tabela.spec.ts` — commit: —
- [x] 4. Conferir as outras tabelas e rodar os e2e da área (build limpa) — relatório `capturas/24-11/item-3-relatorio.md`
- [x] 5. Item 6b (parte da folha de lesão): colunas Região, O que é, Período, Situação e "Cuidados no treino" no mesmo `CartaoLesoes` — relatório `capturas/24-11/item-6b-relatorio.md`

## Fora do escopo
- Outras tabelas com linha tingida: não há (nenhuma outra tela usa a `Tabela` com linha tingida ou selecionada; a seleção do lote do Financeiro é só a caixa de marcar).

## O que ficou para trás
- Nada.
