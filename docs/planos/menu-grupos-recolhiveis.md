# Menu do treinador: grupos recolhíveis

Situação: Em andamento · Onde: main (parte 3 juntada no merge da `dieta-tabela` e publicada em 19/11, run 44559836626; D9 de 19/11 feita, sem commit ainda) · Atualizado: 19/11/2026

Fonte: pedido da reunião de 15/11/2026 que não tinha sido registrado, repassado pelo Gustavo em 18/11/2026. Base: `main` em `9443481e`. Validade: vale enquanto `dominio/gruposDoMenu.ts`, `ui/Navegacao.tsx`, `ui/Passeio.tsx` e `dominio/preferencias.ts` não mudarem; se mudarem, refazer "Conferido no código".

## Objetivo
O treinador recolhe e reabre os grupos do menu lateral (Acompanhamento, Negócio…) para ver só o que usa. A escolha fica no aparelho. Só app: sem API, sem migration.

## Conferido no código (18/11/2026)
- Existem: `app/src/dominio/gruposDoMenu.ts` (123 linhas) e seu teste, `dominio/preferencias.ts`, `ui/Navegacao.tsx` (461), `ui/Passeio.tsx` (236) e `e2e/menu-do-treinador.spec.ts` (304). Parágrafo "Menu do treinador" no `AGENTS.md` (~linha 259) e a Ajuda fala dos grupos em `ajuda/conteudo.ts` ("Menu e busca"; Financeiro e Vitrine citam o grupo Negócio).
- Não conferido: a estrutura interna de `gruposDoMenu`, como as contagens (número neutro e ponto) chegam hoje ao título do grupo e como o Passeio escolhe o item do passo (o executor lê antes de decidir).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo | Só o menu lateral **aberto**; os trilhos de 88 e 72 px e a barra inferior do celular não mudam | Gustavo, 18/11 |
| D2 | Preferência | `gruposRecolhidos` (lista de ids) em `dominio/preferencias.ts`; fica no aparelho, sobrevive ao "Sair", começa vazia (tudo aberto) | Gustavo, 18/11 |
| D3 | Grupo da tela aberta | ~~Nunca fica recolhido~~ (substituída pela D9, 19/11) | Gustavo, 18/11 |
| D4 | Contagem do grupo recolhido | Soma das contagens dos itens dele; mostra a contagem neutra ou o ponto que os itens teriam | Gustavo, 18/11 |
| D5 | Grupo sem item permitido | Continua sumindo | Gustavo, 18/11 |
| D6 | Acessibilidade | Título do grupo vira botão com seta (cima = aberto, baixo = recolhido), `aria-expanded`, nome "Recolher X" / "Abrir X", alvo de 44 px, anel de foco; sem animação com movimento reduzido | Gustavo, 18/11 |
| D7 | Passeio | Passo cujo item está num grupo recolhido abre o grupo ou some, o que for mais simples; o executor escolhe e registra aqui | Gustavo, 18/11 |
| D8 | Merge da parte 3 com o menu da main | Base é o menu da main (logo no topo do minimizado, "Expandir menu" no lugar dela com mouse ou foco; títulos 14 px semibold; busca abaixo da marca). Da `dieta-tabela` ficam só o submenu flutuante dos grupos no minimizado (teclado do Menu Button da APG) e o fio vertical do grupo aberto; o botão de recolher embaixo do logo sai | Gustavo, 19/11 |
| D9 | Todo grupo recolhe | Substitui a D3: o título do grupo da tela aberta é botão com seta como os outros (`aria-expanded`, "Recolher X"/"Abrir X", 44 px). Recolhido, leva a barrinha `marcaPeca` à esquerda e `aria-current="true"` (o item atual sai com os outros itens); o resumo de contagens ou ponto continua. Entrar numa tela de um grupo recolhido não abre o grupo; a preferência `gruposRecolhidos` segue no aparelho. O Passeio continua pulando o passo do item em grupo recolhido (D7). Trilhos de 88 e 72 px, submenu e barra inferior não mudam | Gustavo, 19/11 |

## Passos
Subagentes não comitam; a sessão principal comita e anota o commit aqui.

- [x] 0. Plano e índice (este arquivo e a entrada no README) — sessão principal — commit: 1af8c940
- [x] 1. Regra pura em `dominio/` (grupos recolhidos, grupo da tela aberta nunca recolhido, contagem somada, grupo vazio some) + `gruposRecolhidos` em `preferencias.ts` + testes — executor — commit: `46f74a22` (jest 63 testes, typecheck e eslint ✅)
- [x] 2. Tela em `ui/Navegacao.tsx` (botão com seta, aria, 44 px, foco, movimento reduzido, contagem no título recolhido), Passeio, rolagem a 1280×720, busca e cartão da conta intactos — executor-front (depende do 1) — commit: `69ee16b3`. **Passeio (D7): o passo some** (os itens de um grupo recolhido não estão na tela e o filtro `passosVisiveis` já tira o passo; zero código no Passeio, a preferência não muda, e2e prova). Decisões a confirmar com o Gustavo: o grupo da tela aberta mostra só o título, sem botão nem seta (pela D3 nunca recolhe; foge em parte da letra da D6); o menu aberto ficou ~18 px mais alto por grupo (~72 px no total: título de 44 px, saiu a folga de 12 px entre grupos); sem animação (o menu não animava nada)
- [x] 3. e2e em `menu-do-treinador.spec.ts` (recolher, recarregar e continuar recolhido; tela num grupo recolhido abre o grupo; contagem no título) e conferência 1024, 1280 e 1440 px, claro, Areia e escuro, texto Extra — executor-front (junto do 2) — commit: `69ee16b3` (e2e do menu 23/23 na porta 8147; capturas em claro 1024, Areia 1280, escuro com foco, Extra com contagem 128 e ficha vista; não vistas: Areia 1024/1440, claro 1280/1440, escuro 1024/1280 geradas e não abertas; não conferido: título só com ponto, tablet nativo, carga inicial com atraso real)
- [ ] 4. `AGENTS.md` (parágrafo "Menu do treinador") e Ajuda (`ajuda/conteudo.ts`, "Menu e busca"), `npm run typecheck && npm run lint && npm test` e o e2e do menu — sessão principal — commit: —
- [x] 5. Parte 3 nova (18/11): botão recolher no topo e submenu flutuante no PC minimizado; só na branch `dieta-tabela` (worktree `.claude/worktrees/dieta-tabela`), sem merge na `main` e sem push — commit: fdd363e8, 800383f0, b99ae2f5 (só na branch `dieta-tabela`). 19/11, merge com a main (D8): o recolher embaixo do logo saiu; ficaram o submenu e o fio; e2e `menu-do-treinador.spec.ts` junta os casos dos dois lados (fio com asserção própria) — executor-front — commit: — (merge em andamento)
- [x] 6. D9 (19/11): todo grupo recolhe, inclusive o da tela aberta — `dominio/gruposDoMenu` (`gruposRecolhidos` sem o grupo da tela, com teste), `ui/Navegacao` (`TituloDoGrupo` sempre botão, barrinha `marcaPeca` e `aria-current` no título recolhido do grupo da tela; sai o foco que só servia à regra antiga em `BlocoDoMenu`), `e2e/menu-do-treinador.spec.ts` (teste da D9 e do passeio com o grupo da tela recolhido, mais a captura `grupo-atual-recolhido`), `preferencias.ts`, `AGENTS.md` e Ajuda — sessão principal — commit: —

## Critérios de aceite
- Recolher um grupo esconde os itens, mostra a contagem neutra ou o ponto e persiste ao recarregar e depois do "Sair".
- Todo grupo recolhe, o da tela aberta também (D9, 19/11), com a barrinha e o `aria-current` no título; grupo sem item permitido não aparece.
- Botão com `aria-expanded` e nome "Recolher/Abrir <grupo>", 44 px e anel de foco; sem animação com movimento reduzido.
- Trilhos de 88 e 72 px, barra inferior, busca e cartão da conta não mudam; rolagem do menu ok a 1280×720.
- Conferido a 1024, 1280 e 1440 px, claro, Areia e escuro, texto Extra, com capturas.

## Fora do escopo
- Recolher no trilho, na barra inferior ou no celular.
- Mudar a ordem ou o conteúdo dos grupos.

## O que ficou para trás
- (Resolvido em 19/11) O submenu flutuante do PC minimizado agora está registrado como D8.
