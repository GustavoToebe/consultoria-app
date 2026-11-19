# Dieta em tabela, arrastar para reordenar e menu com submenu

Situação: Em andamento (partes 2, 2b e 3 publicadas em 19/11; parte 1 em curso) · Onde: `main` (fast-forward `224cb659`, push `c3d3359e`, run 44559836626 verde, web `c3d3359ed612`); a branch `dieta-tabela` segue como worktree · Atualizado: 19/11/2026

Fonte: pedido do Gustavo em 18/11/2026 (conversa). Validade: vale enquanto `treinador/dieta/CartaoRefeicao.tsx`, `treinador/painel/EditarPainel.tsx` e `ui/Navegacao.tsx` não mudarem de forma incompatível; ao trazer a `main`, refazer a conferência dos arquivos em conflito. Só app: sem API, sem migration.

## Objetivo
Três melhorias de tela, em ordem: (1) alimentos do editor de dieta numa tabela com cabeçalho de colunas; (2) arrastar para reordenar (alça ≡) no lugar das setas na linha, com ↑↓ no menu ⋯ como alternativa; (3) menu lateral do treinador com submenu flutuante no trilho.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Parte 3 (menu) | Só depois de o trabalho dos grupos recolhíveis (`gruposRecolhidos`, `Navegacao.tsx`) estar commitado na `main`; antes, `git merge main` na branch e construir por cima | Gustavo, 18/11 |
| D2 | Entrega | Commits pequenos por assunto na branch `dieta-tabela`; sem push e sem merge na `main` | Gustavo, 18/11 |
| D3 | Arrastar | Peça compartilhada em `ui/` (sem biblioteca nova); alça aria-hidden; ↑↓ no menu ⋯ ("Mover para cima/baixo", nomes "Subir X"/"Descer X"); aviso "Ordem alterada" com Desfazer | Gustavo, 18/11 |
| D4 | Tabela | Abaixo de ~760 px de largura da opção volta ao cartão empilhado de hoje; colunas numa estrutura única, para a fibra acrescentar uma depois | Gustavo, 18/11 (a estrutura única é da sessão principal) |
| D5 | Parte 3: onde entra o submenu | Só no PC minimizado (72 px, o que o botão de recolher produz). O trilho do tablet (768 a 1023) continua com um ícone por item e o rótulo curto embaixo: os nomes dos grupos ("Acompanhamento", "Configurações") não cabem nos 80 px sem um rótulo curto novo, que é decisão de glossário. A confirmar com o Gustavo | executor-front, 18/11 |
| D6 | Opções em abas e "Trocar alimento" (passo 1c) | Opções da refeição em abas (APG) com a comparação dos totais acima e a aberta na largura toda; "Trocar alimento" com texto, secundário compacto e neutro, embaixo do nome na tabela. O limite da tabela passa a 910 px de opção (D4 era ~760; a coluna das ações reserva só o ⋯ e a lixeira) | Gustavo, 19/11 (o número é da medida) |

## Passos
Publicação (19/11/2026): `git merge dieta-tabela` na `main` (fast-forward) e um push só, `c3d3359e`; deploy no run 44559836626 (todos os jobs verdes). Os passos 2, 2b e 3 foram nesse push.
- [ ] 1. Dieta em tabela (`CartaoRefeicao.tsx`: `OpcaoDaRefeicao` e `LinhaItem`) — executor-front — commit: —
- [ ] 1c. Opções em abas (`AbasDeOpcao`, `ComparacaoDasOpcoes`, `dominio/opcoesDaRefeicao`) e "Trocar alimento" com texto no `CartaoRefeicao` — executor-front, 19/11 — commit: — (sem commit; a sessão principal integra) — evidência: jest `CartaoRefeicao.test.tsx` e `opcoesDaRefeicao.test.ts`; e2e `dieta-opcoes-em-abas.spec.ts` e os `dieta-*`; capturas em 390, 1280 e 1920 (escuro) no rascunho da sessão
- [x] 2. Arrastar para reordenar: peça em `ui/` (`ArrasteDaLista`), regra em `dominio/reordenar`, refeições (lista mestre no PC), exercícios e blocos; sessões ficaram fora (ver abaixo) — executor-front — commits: 98cef762, be3a9e8a — evidência: `e2e/arrastar.spec.ts`, `editor-clareza.spec.ts`, `reordenar.test.ts`
- [x] 2b. Alça de arrastar nos alimentos de cada opção (`LinhaItem`) e ⋯ da refeição, depois do passo 1 — executor-front — commit: 89a095e8 — evidência: `e2e/arrastar.spec.ts`, e2e `dieta-*` verdes
- [x] 3. Menu: submenu flutuante dos grupos no PC minimizado (72 px, "Menu Button" da APG, `ui/SubmenuDoTrilho.tsx`) e fio vertical do grupo aberto; regra pura em `dominio/gruposDoMenu` (`itemAtivo`, `sinaisDoIconeDoGrupo`, `topoDoSubmenu`) — executor-front — commit: fdd363e8 (base `d4095696`) — evidência: `e2e/menu-do-treinador.spec.ts` 26/26, `ajuda` 8/8, `configuracoes` 18/18, `painel` 44/44, jest 115/115

## Conflitos previstos ao trazer a `main`
- `treinador/dieta/CartaoRefeicao.tsx` e `ComplementosDaDieta.tsx` (frente "seções nascem fechadas", lote C), `treinador/treino/*` (lote D) e `treinador/plano/*`; a frente da fibra acrescenta uma coluna "Fibras" na tabela.

## Fora do escopo
- Qualquer mudança de API ou de dados.

## O que ficou para trás
- Sessões do plano (chips do `SeletorDeSessoes`): sem arraste; continuam com ← → no `CartaoSessao`. Chips que quebram linha pedem destino em 2D (a regra `destinoDoArraste` já tem o eixo `linhas`) e alça dentro de cada chip; fica para quando o Gustavo pedir.
- Refeições no celular (cartões empilhados): sem alça (precisaria de um encaixe no `CabecalhoDoItem`, compartilhado com mobilidade e questionário); a ordem muda pelo ⋯ da refeição.
- Sem rolagem automática perto da borda durante o arraste (`shortcut:` em `ui/ArrasteDaLista.tsx`).
- Arraste por toque (Android/iOS, toque longo de 250 ms) não foi conferido em aparelho; só e2e com mouse na web.
- Opções em abas (1c): em 1280 o inspetor dá ~650 px à opção, abaixo dos 910 da tabela, então a tabela só aparece a partir de ~1541 px de janela (o empilhado segue em 1280); com três opções, a terceira aba fica atrás do esmaecido em 1280 e em 390 (as abas rolam, como no `ui/Abas`, e a comparação lista todas). O `e2e/editor-inspetor-sobras.spec.ts` (dieta, linhas 158-174) ainda procura "Opção A"/"Opção B" como títulos lado a lado: é da sessão principal (o arquivo também tem o treino).
- Menu (parte 3): no PC minimizado os passos do passeio dos itens agrupados saem (os itens só existem no submenu), como no grupo recolhido (D7 do `menu-grupos-recolhiveis`); o submenu no tablet nativo largo (Modal, Voltar do Android) não foi conferido em aparelho; submenu sem rolagem própria (cabe com até ~13 itens em 720 px); o "Expandir" fica com o realce de mouse preso depois de minimizar até o mouse passar nele (realce de hover do react-native-web; provavelmente já existia, porque o mesmo botão já mudava de lugar entre os modos, mas não foi conferido na base); `docs/design-e-front.md` 4.4 (`Navegacao`) e o parágrafo "Menu do treinador" do `AGENTS.md` ainda descrevem "Buscar com o recolher ao lado" (sessão principal); os guias em PDF (`scripts/guias/gerar.mjs`, saem de `ajuda/conteudo.ts`) não foram gerados de novo com a frase nova do menu.
