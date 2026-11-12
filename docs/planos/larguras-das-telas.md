# Larguras das telas do treinador (Números, Aulões e Mural)

Situação: Concluída em 12/11/2026 (verificações verdes) · Onde: `main`, commit 765e06d5 · Atualizado: 12/11/2026

## Objetivo
Tirar a faixa estreita e centralizada que deixava uma margem grande entre o menu e o conteúdo no PC: cabeçalho, tabelas e grades
usam a largura útil (respiro de 24 a 32 px no PC); só o texto de leitura (publicações do mural) tem largura confortável.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | A `Tela` não muda de padrão (16 px, `LARGURA_MAXIMA`); ganha a prop opcional `folga`, e só as três telas a usam no PC | `folga` por tela, sem mexer nas outras | Claude (peça compartilhada) |
| 2 | Números: "Mês a mês" e "Equipe hoje" lado a lado quando couberem (medido no contêiner); a `Tabela` já vira cartões abaixo da `larguraMinima` | lado a lado só com largura suficiente; senão empilha | Gustavo (proposta de 12/11) |
| 3 | Aulões: grade responsiva de 2 a 3 colunas; um aulão só fica à esquerda, sem esticar | colunas por largura medida | Gustavo |
| 4 | Mural: cabeçalho, ações e filtros na largura útil; publicações numa coluna de leitura alinhada à esquerda do conteúdo, não centralizada | coluna de leitura só nos cartões | Gustavo |
| 5 | Área do aluno e peças compartilhadas (`CartaoDoPost`, `comunidade/**`) não mudam | sem alteração | Gustavo |

## Passos
- [x] 1. `Tela`: prop `folga` opcional (padrão intocado) — arquivo `app/src/ui/Tela.tsx`; commit: —
- [x] 2. Números (`treinador/numeros.tsx`, `e2e/numeros.spec.ts` novo): lado a lado medido no contêiner (cerca de 1375 px de janela com o menu aberto), tabela de 480 px; empilha abaixo, cartões no celular; commit: —
- [x] 3. Comunidade (`treinador/comunidade.tsx`, `e2e/comunidade.spec.ts`): `ui/Grade` (1 coluna, 2 a partir de 760 px e 3 a partir de 1240 px de contêiner), aulão único à esquerda; mural com coluna de 800 px só nas publicações, à esquerda; commit: —
- [x] 4. Verificações em 12/11: tsc, lint (0 erros), Jest 298 suítes/6473, e2e 452/452 (inclui `comunidade`, `perfil-comunidade`, `numeros`, `menu-do-treinador`); capturas em 390, 1280, 1440 e 1920 (scratchpad) — commit: —

## Fora do escopo
- Mudar o padrão da `Tela` ou as demais telas do treinador (listadas só se o Gustavo pedir).

## O que ficou para trás
- Menu recolhido (trilho de 88 px), temas areia e contraste alto, barra de rolagem real do Windows (17 px) e app nativo não conferidos. Web local (8088) conferida em 12/11/2026 (1280/1440/390 px, menu aberto e recolhido): ver composicao-de-telas-12-11.md.
- Outras telas do treinador ainda usam `LARGURA_EDITOR`/`LARGURA_LISTA` com margem lateral grande no PC; só entram a pedido do Gustavo.
- `ui/Grade` de outras telas ainda reserva uma terceira coluna quando há só dois itens (não mexida).
