# Dieta em tabela, arrastar para reordenar e menu com submenu

Situação: Em andamento · Onde: branch `dieta-tabela` (worktree, base `main` em `46f74a22`) · Atualizado: 18/11/2026

Fonte: pedido do Gustavo em 18/11/2026 (conversa). Validade: vale enquanto `treinador/dieta/CartaoRefeicao.tsx`, `treinador/painel/EditarPainel.tsx` e `ui/Navegacao.tsx` não mudarem de forma incompatível; ao trazer a `main`, refazer a conferência dos arquivos em conflito. Só app: sem API, sem migration.

## Objetivo
Três melhorias de tela, em ordem: (1) alimentos do editor de dieta numa tabela com cabeçalho de colunas; (2) arrastar para reordenar (alça ≡) no lugar das setas na linha, com ↑↓ no menu ⋯ como alternativa; (3) menu lateral do treinador com o botão de recolher fixo no topo e submenu flutuante no trilho.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Parte 3 (menu) | Só depois de o trabalho dos grupos recolhíveis (`gruposRecolhidos`, `Navegacao.tsx`) estar commitado na `main`; antes, `git merge main` na branch e construir por cima | Gustavo, 18/11 |
| D2 | Entrega | Commits pequenos por assunto na branch `dieta-tabela`; sem push e sem merge na `main` | Gustavo, 18/11 |
| D3 | Arrastar | Peça compartilhada em `ui/` (sem biblioteca nova); alça aria-hidden; ↑↓ no menu ⋯ ("Mover para cima/baixo", nomes "Subir X"/"Descer X"); aviso "Ordem alterada" com Desfazer | Gustavo, 18/11 |
| D4 | Tabela | Abaixo de ~760 px de largura da opção volta ao cartão empilhado de hoje; colunas numa estrutura única, para a fibra acrescentar uma depois | Gustavo, 18/11 (a estrutura única é da sessão principal) |

## Passos
- [ ] 1. Dieta em tabela (`CartaoRefeicao.tsx`: `OpcaoDaRefeicao` e `LinhaItem`) — executor-front — commit: —
- [x] 2. Arrastar para reordenar: peça em `ui/` (`ArrasteDaLista`), regra em `dominio/reordenar`, refeições (lista mestre no PC), exercícios e blocos; sessões ficaram fora (ver abaixo) — executor-front — commits: 98cef762, be3a9e8a — evidência: `e2e/arrastar.spec.ts`, `editor-clareza.spec.ts`, `reordenar.test.ts`
- [x] 2b. Alça de arrastar nos alimentos de cada opção (`LinhaItem`) e ⋯ da refeição, depois do passo 1 — executor-front — commit: 89a095e8 — evidência: `e2e/arrastar.spec.ts`, e2e `dieta-*` verdes
- [ ] 3. Menu: botão de recolher no topo e submenu flutuante no trilho — executor-front — depende do commit do menu recolhível na `main` — commit: —

## Conflitos previstos ao trazer a `main`
- `treinador/dieta/CartaoRefeicao.tsx` e `ComplementosDaDieta.tsx` (frente "seções nascem fechadas", lote C), `treinador/treino/*` (lote D) e `treinador/plano/*`; a frente da fibra acrescenta uma coluna "Fibras" na tabela.

## Fora do escopo
- Qualquer mudança de API ou de dados.

## O que ficou para trás
- Sessões do plano (chips do `SeletorDeSessoes`): sem arraste; continuam com ← → no `CartaoSessao`. Chips que quebram linha pedem destino em 2D (a regra `destinoDoArraste` já tem o eixo `linhas`) e alça dentro de cada chip; fica para quando o Gustavo pedir.
- Refeições no celular (cartões empilhados): sem alça (precisaria de um encaixe no `CabecalhoDoItem`, compartilhado com mobilidade e questionário); a ordem muda pelo ⋯ da refeição.
- Sem rolagem automática perto da borda durante o arraste (`shortcut:` em `ui/ArrasteDaLista.tsx`).
- Arraste por toque (Android/iOS, toque longo de 250 ms) não foi conferido em aparelho; só e2e com mouse na web.
