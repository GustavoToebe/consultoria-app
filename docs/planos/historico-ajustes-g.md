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

## Passos
- [ ] 1. (a) e (d): período e "hoje" de Brasília em `dominio/historicoDoAluno.ts`, com jest — executor — commit: —
- [ ] 2. (b) e (c): letra das divisões e as duas sessões do dia, na grade e no rótulo acessível, com jest — executor — commit: —
- [ ] 3. e2e `cores-historico-dieta` em 390 e 1280 px; README risca a pendência da etapa (D17, PR #49) — executor-rapido — commit: —

## Fora do escopo
- Mudar as cores por tipo de divisão ou o desenho do Histórico.

## O que ficou para trás
- —
