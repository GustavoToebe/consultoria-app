# Histórico: detalhes que sobraram da Frente G

Situação: Em andamento · Onde: branch `historico-ajustes-g` (um PR) · Atualizado: 03/11/2026 · Registro: [cores-por-tipo-de-serie.md](cores-por-tipo-de-serie.md), "O que ficou para trás"

## Objetivo
Fechar os quatro opcionais da revisão da Frente G no Histórico do aluno (visão do treinador): semana cortada no
período, letra da divisão que não contradiz o nome, dia com duas sessões e o "hoje" de Brasília.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Dias fora do período na visão "Por dia" | neutros, com o texto "fora do período"; só os treinos de dentro do período contam | Gustavo |
| D2 | Duas divisões com a mesma letra no nome | vale sempre a letra que o nome diz; a repetida ganha número na ordem em que aparece ("A", "A2", "A3"), com a cor da letra; as divisões sem letra no nome pegam, depois, a próxima letra que nenhum nome diz; mesmo nome (sem espaços nas pontas, sem diferença de maiúsculas) = mesma divisão. O texto, o `testID` e o rótulo acessível dizem a mesma coisa ("A2"). Vale também em Cargas por divisão (`CargasPorDivisao`), que usa a mesma regra | Claude |
| D3 | Dia com duas sessões | a grade e o rótulo acessível mostram as duas | Gustavo |
| D4 | "Hoje" do Histórico | o dia de Brasília, como o `hojeDoCiclo` (`hojeEmBrasilia`) | Gustavo |
| D5 | O que a semana conta | treinos (sessões) dentro do período: dia com duas sessões conta 2; a contagem, a grade e o rótulo acessível concordam | Claude |
| D6 | Rótulo da divisão repetida | o rótulo acessível diz o nome e a letra que aparece na grade: "Treino A - Pernas (A2)", nunca só "(A)" | Claude, registrado a pedido do Gustavo (03/11) |
| D7 | Linha "Fora do período" | embaixo do título da semana cortada, "Fora do período: SEG, TER, QUA" (siglas); o rótulo acessível da grade repete com os nomes dos dias; semana sem dia fora não tem a linha | Claude, registrado a pedido do Gustavo (03/11) |
| D8 | "Hoje" do Progresso | o `CartaoProgresso` (ficha e Histórico) também usa o dia de Brasília (`hojeEmBrasilia`), como o Histórico (D4); passa do escopo do Histórico e vai na descrição do PR | Claude, registrado a pedido do Gustavo (03/11) |
| D9 | Dias depois de hoje | não são "fora do período": "fora" é só antes do início ou depois do fim da pasta (ou do período buscado). Dia depois de hoje que ainda é do período fica neutro (sem tracejado), não entra na linha "Fora do período", não conta como sem treino e o rótulo acessível diz "Ainda não chegou: …". Período cortado em hoje (últimos 30 dias, `ate` = hoje): o dia seguinte também "ainda não chegou". Limite aceito: pasta que termina exatamente hoje é lida como cortada, e o dia seguinte sai "ainda não chegou" em vez de "fora" (os dois são neutros e não contam) | Gustavo (03/11) |

## Passos
- [x] 1. (a) e (d): período e "hoje" de Brasília em `dominio/historicoDoAluno.ts`, com jest — executor — commit: badcb274
- [x] 2. (b) e (c): letra das divisões e as duas sessões do dia, na grade e no rótulo acessível, com jest — executor — commit: badcb274
- [x] 3. e2e `cores-historico-dieta` em 390 e 1280 px; README risca a pendência da etapa (D17, PR #49); dias depois de hoje (D9) — executor-rapido — commit: 733e817f

## Fora do escopo
- Mudar as cores por tipo de divisão ou o desenho do Histórico.

## Revisão independente (03/11)
Nada bloqueante. Opcionais aplicados no mesmo PR, por serem pequenos:
- dia com treino depois do "hoje" de Brasília (registro com a data do aparelho, em outro fuso) não sai "ainda não chegou" (jest);
- o e2e roda com o navegador em UTC e o relógio às 22:30 de Brasília, para falhar se o "hoje" voltar a ser o do aparelho;
- o rótulo "(A2)" é exato no e2e;
- o e2e conta as letras desenhadas na grade.

## O que ficou para trás
- O dia que ainda não chegou tem o mesmo desenho do dia sem treino na grade. A diferença está só na contagem e no rótulo acessível.
- Uma pasta que termina exatamente hoje é lida como período cortado (D9). O dia seguinte sai "ainda não chegou" em vez de "fora do período". Nos dois casos o dia fica neutro e não conta.
- A mesma divisão pode virar "A" num período e "A2" em outro, porque a ordem das divisões muda com o período (D2).
