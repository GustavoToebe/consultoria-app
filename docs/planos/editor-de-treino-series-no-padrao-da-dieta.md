# Editor de treino: séries no padrão do editor da dieta

Situação: Concluída em 19/11/2026 (sem push nem merge) · Onde: branch `dieta-tabela` (worktree), sem push nem merge · Atualizado: 19/11/2026

## Objetivo
A série aberta deixa de ter destaque em dobro (borda de ação e faixa na linha mais o quadro "Editando: Série 1"): uma faixa só no painel do exercício, como a refeição na dieta, e a série aberta é um bloco único (acordeão) só com fundo tingido.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Um nível de destaque por vez | A faixa fica no painel em edição; o item aberto dentro dele usa só o fundo tingido (8% da cor de ação, não `acaoSuave`, que a 13% deixava o contorno dos campos em 2,79:1 no Escuro, 2,87 na Meia-noite e 2,85 na Ameixa; teste `blocoAberto.contraste.test.ts`); nada de moldura de ação dentro de moldura de ação (regra em `docs/design-e-front.md`) | Gustavo, 19/11/2026 |
| D2 | Série aberta | Bloco único sem borda de ação, sem halo e sem selo "Editando"; o nome acessível "Editando série N, tipo" substitui o título visível | Gustavo, 19/11/2026 |
| D3 | Reordenar a série | Arrastar e pelo ⋯ da linha (à direita do chevron, fora do botão da linha; só com 2 ou mais blocos); as setas ↑↓ saem do bloco | Gustavo, 19/11/2026 |

## Passos
- [x] 1. Painel do exercício com a faixa, linhas limpas, série aberta em bloco único, lista mestre, regra no guia de design e a conferência da dieta (a dieta já seguia a regra: nada a ajustar) — commit: ver `git log` da branch `dieta-tabela` ("Editor de treino: séries no padrão da dieta")

## Fora do escopo
- Arrastar para reordenar, se ainda não existir no código (as setas ficam no ⋯ da linha).

## O que ficou para trás
- `editor-clareza.spec.ts:276` ("usar receita") está vermelho desde o `da01327a` (as seções da `FolhaReceitas` nascem fechadas e o spec não abre): não é desta frente.
- A faixa de 6 px do painel do exercício repete o valor de `BARRA_DA_REFEICAO` (marcado com `shortcut:`): virar token usado pelos dois cartões.
