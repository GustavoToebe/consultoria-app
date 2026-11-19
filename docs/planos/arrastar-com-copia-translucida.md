# Arrastar: uma peça só, com cópia translúcida, em todas as listas e no Kanban

Situação: Planejando (pedido de 19/11; um agente foi parado antes de editar qualquer arquivo) · Onde: main · Atualizado: 19/11/2026

## Objetivo
O treinador arrasta itens com uma cópia translúcida que segue o ponteiro, um espaço tracejado na origem e a linha guia no destino, do mesmo jeito na dieta, no treino, na mobilidade, no Kanban de Interessados e no Editar painel; hoje `QuadroKanban` e `EditarPainel` têm cada um o seu `Gesture.Pan`, além da peça `ui/ArrasteDaLista`.

## Decisões (Gustavo, 19/11; só `app/`, sem push; parar antes do commit; fazer DEPOIS das decisões de mobilidade e dieta em Pendências soltas)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Peça compartilhada (`ui/ArrasteDaLista`) | Cópia translúcida do item segue o ponteiro (mesma aparência, opacidade ~0,6, sombra do tema, escala 1,02, cursor grabbing na web), numa camada por cima (portal/overlay) para não ser cortada; o lugar de origem vira um espaço do mesmo tamanho com contorno tracejado (`cores.borda`) e sem conteúdo; linha guia de 2 px em `cores.acao` onde cai; rolagem automática perto da borda de cima ou de baixo; Esc cancela (a cópia some, o item fica); ao soltar, a mesma função de mover de hoje e o aviso "Ordem alterada" com Desfazer | Gustavo, 19/11 |
| D2 | Movimento reduzido | A cópia continua seguindo o ponteiro, sem animação de encaixe ou volta; só some | Gustavo, 19/11 |
| D3 | Início do arraste | Mouse: pela alça, depois de ~4 px (clique continua clique); toque: toque longo de ~250 ms; alça ⋮⋮ em `cores.textoSuave`, `aria-hidden`; a alternativa de teclado continua no ⋯ | Gustavo, 19/11 |
| D4 | Onde | Dieta (refeições e alimentos de cada opção), treino (exercícios, blocos de série e sessões onde já houver), mobilidade (seções e itens), Editar painel (`EditarPainel.tsx`) e qualquer outro `Gesture.Pan` de lista: uma implementação só | Gustavo, 19/11 |
| D5 | Kanban (`QuadroKanban.tsx`) | Alça ⋮⋮ à esquerda do nome; no mouse o cartão inteiro arrasta depois de ~4 px (clicar abre a inscrição), no toque, toque longo; "Mover para" sai do cartão e vai para o ⋯ (canto superior direito), "Mover para > Novas / Em contato / Em negociação…", com o nome acessível atual; coluna de destino destacada (borda `cores.acao`, fundo `acaoSuave` leve), espaço tracejado na posição de entrada, coluna vazia diz "Solte aqui" (no lugar de "Nenhuma inscrição."); ao soltar em outra coluna, aviso "Movido para Em contato" com Desfazer; o texto "Segure o cartão para arrastar, ou use 'Mover para'." vira "Arraste pelo ⋮⋮ ou use o ⋯ do cartão." | Gustavo, 19/11 |

## Passos
- [ ] 1. Regra pura em `dominio/reordenar` (reordenar e mover entre colunas, origem → destino) com teste
- [ ] 2. Peça em `ui/ArrasteDaLista` com a cópia translúcida e a rolagem automática; trocar `EditarPainel` e `QuadroKanban` para ela
- [ ] 3. Aplicar em dieta, treino, mobilidade e Kanban (alça, ⋯, destaque da coluna, "Solte aqui")
- [ ] 4. e2e com o mouse em 1280 (uma lista da dieta, o Kanban entre colunas, Esc cancelando; comentário "arrastar com cópia translúcida (19/11)"); ajustar os e2e que clicavam em "Mover para"; typecheck, lint, jest e os e2e de dieta, treino, mobilidade, interessados e painel
- [ ] 5. Capturas no meio do arraste (dieta e Kanban, 1280, escuro e claro) e o cartão do Kanban parado em 1280 e 390; Ajuda, `AGENTS.md`, `design-e-front.md` e guias em PDF

## Fora do escopo
- Biblioteca nova de arrastar; `ui/Folha` e `ui/EscalaDeNota` (usam `Gesture` para outra coisa).

## O que ficou para trás
- Nada ainda. Não conferível aqui: toque longo no aparelho (nativo).
