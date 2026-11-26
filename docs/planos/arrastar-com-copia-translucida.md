# Arrastar: uma peça só, com cópia translúcida, em todas as listas e no Kanban

Situação: Entregue (passos 1 a 5 na `main`, já em `origin/main`; falta só a conferência no aparelho); em 26/11 a sombra foi corrigida e a escala saiu (ver "Correção de 26/11") · Onde: main; a correção de 26/11 está em `lote-26-11`, sem commit · Atualizado: 26/11/2026

## Objetivo
O treinador arrasta itens com uma cópia translúcida que segue o ponteiro, um espaço tracejado na origem e a linha guia no destino, do mesmo jeito na dieta, no treino, na mobilidade, no Kanban de Interessados e no Editar painel; hoje `QuadroKanban` e `EditarPainel` têm cada um o seu `Gesture.Pan`, além da peça `ui/ArrasteDaLista`.

## Decisões (Gustavo, 19/11; só `app/`, sem push; parar antes do commit; fazer DEPOIS das decisões de mobilidade e dieta em Pendências soltas)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Peça compartilhada (`ui/ArrasteDaLista`) | Cópia translúcida do item segue o ponteiro (mesma aparência, opacidade ~0,6, sombra do tema, ~~escala 1,02~~ sem escala desde 26/11, cursor grabbing na web), numa camada por cima (portal/overlay) para não ser cortada; o lugar de origem vira um espaço do mesmo tamanho com contorno tracejado (`cores.borda`) e sem conteúdo; linha guia de 2 px em `cores.acao` onde cai; rolagem automática perto da borda de cima ou de baixo; Esc cancela (a cópia some, o item fica); ao soltar, a mesma função de mover de hoje e o aviso "Ordem alterada" com Desfazer | Gustavo, 19/11 |
| D2 | Movimento reduzido | A cópia continua seguindo o ponteiro, sem animação de encaixe ou volta; só some | Gustavo, 19/11 |
| D3 | Início do arraste | Mouse: pela alça, depois de ~4 px (clique continua clique); toque: toque longo de ~250 ms; alça ⋮⋮ em `cores.textoSuave`, `aria-hidden`; a alternativa de teclado continua no ⋯ | Gustavo, 19/11 |
| D4 | Onde | Dieta (refeições e alimentos de cada opção), treino (exercícios, blocos de série e sessões onde já houver), mobilidade (seções e itens), Editar painel (`EditarPainel.tsx`) e qualquer outro `Gesture.Pan` de lista: uma implementação só | Gustavo, 19/11 |
| D5 | Kanban (`QuadroKanban.tsx`) | Alça ⋮⋮ à esquerda do nome; no mouse o cartão inteiro arrasta depois de ~4 px (clicar abre a inscrição), no toque, toque longo; "Mover para" sai do cartão e vai para o ⋯ (canto superior direito), "Mover para > Novas / Em contato / Em negociação…", com o nome acessível atual; coluna de destino destacada (borda `cores.acao`, fundo `acaoSuave` leve), espaço tracejado na posição de entrada, coluna vazia diz "Solte aqui" (no lugar de "Nenhuma inscrição."); ao soltar em outra coluna, aviso "Movido para Em contato" com Desfazer; o texto "Segure o cartão para arrastar, ou use 'Mover para'." vira "Arraste pelo ⋮⋮ ou use o ⋯ do cartão." | Gustavo, 19/11 |

## Correção de 26/11 (T-312 de [ajustes-de-26-11.md](ajustes-de-26-11.md); sem commit)
- A escala 1,02 em volta do centro foi removida: contrariava a 4.12 de `docs/design-e-front.md` e o D1 acima (a cópia tem a mesma aparência e o mesmo tamanho do item).
- O registro do item seguia o índice de nascimento (o `ref` do `Animated.View` só roda na montagem), então depois de reordenar a cópia saía de outra linha; agora segue o índice atual (`useLayoutEffect`) em `ui/ArrasteDaLista` e `ui/arrasteNaWeb`.
- A cópia partia do translation do gesto (a conta só começava depois dos 4 px); agora parte do ponto de pega.
- `e2e/sombraDoArraste.ts` mede a sombra; usada por `e2e/dieta-opcoes-reordenar.spec.ts`.

## Passos
- [x] 1. Regra pura em `dominio/reordenar` (reordenar e mover entre colunas, origem → destino) com teste — commit `155792be` (`reordenar.ts` e `reordenar.test.ts`)
- [x] 2. Peça em `ui/ArrasteDaLista` com a cópia translúcida e a rolagem automática; trocar `EditarPainel` e `QuadroKanban` para ela — commit `155792be` (`ArrasteDaLista.tsx`, `arrasteNaWeb.ts`, `EditarPainel.tsx`, `QuadroKanban.tsx`)
- [x] 3. Aplicar em dieta, treino, mobilidade e Kanban (alça, ⋯, destaque da coluna, "Solte aqui") — commit `155792be` (Kanban e Início); dieta, treino e mobilidade já usavam a peça desde `98cef762`, `be3a9e8a`, `89a095e8` e `74825d91`
- [x] 4. e2e com o mouse em 1280 (uma lista da dieta, o Kanban entre colunas, Esc cancelando; comentário "arrastar com cópia translúcida (19/11)"); ajustar os e2e que clicavam em "Mover para"; typecheck, lint, jest e os e2e de dieta, treino, mobilidade, interessados e painel — commit `155792be` (`e2e/arrastar.spec.ts`, `e2e/interessados-crm.spec.ts`)
- [x] 5. (20/11) Capturas no meio do arraste (dieta e Kanban, 1280, escuro e claro) e o cartão do Kanban parado em 1280 e 390; Ajuda, `AGENTS.md`, `design-e-front.md` e guias em PDF — commit `26c8745b` (capturas ficaram fora do repositório); fechamento de 23/11 (⋯ do Kanban, "Solte aqui", tracejado e aviso do Início) no commit `64d53f30`

## Fora do escopo
- Biblioteca nova de arrastar; `ui/Folha` e `ui/EscalaDeNota` (usam `Gesture` para outra coisa).

## O que ficou para trás
- Nada conferido em aparelho nativo: toque longo, recorte pelo `ScrollView`, `zIndex` entre colunas num tablet; no nativo, sem rolagem automática nem Esc (`shortcut:`).
- Temas areia e contraste alto durante o arraste, cartão do Kanban em 390 no escuro e arraste por toque na web num tablet largo.
- **Fechado em 23/11/2026:** mantidos o ⋯ do Kanban abrindo direto a folha de destinos e `"Solte aqui"` só durante o arraste; tracejado de origem passou a usar `cores.bordaCampo` para melhorar o contraste no tema claro (sem quebrar escuro, areia ou contraste alto); Início em edição (`GradeEmEdicao`) ganhou o aviso `"Ordem alterada."` com ação `Desfazer`, no padrão do Kanban e das listas.
