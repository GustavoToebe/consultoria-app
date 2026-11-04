# Editor de treino em lista + inspetor (design do Stitch)

Situação: Em andamento · Onde: branch `editor-treino-inspetor` · Atualizado: 04/11/2026

## Objetivo
No PC largo, o editor de treino passa a ter duas colunas: a lista dos exercícios da sessão à esquerda e o inspetor do exercício
escolhido à direita, com os grupos de séries em abas. No celular e no PC estreito continua um exercício aberto por vez, empilhado.
Vale para o plano do aluno e para os modelos (treino e sessão) do Planejamento. É só tela: o contrato da API e o conteúdo do plano
não mudam. O design "Consultoria Utilitarian Flat" (zip do Stitch, fora do repositório) é referência de layout e hierarquia; tokens,
cantos, selos, cores da marca e as regras do AGENTS.md são os do app.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Ponto de troca para duas colunas | 960 px de conteúdo medido (`onLayout` da raiz da `TelaDoEditor`, não a janela): duas colunas em 1440 e 1280, lista empilhada em 1024 e no celular | Gustavo (04/11) |
| D2 | Largura máxima do editor em duas colunas | 1440 px (`LARGURA_EDITOR_DUAS_COLUNAS`); em coluna única segue `LARGURA_EDITOR` (1040) | Claude |
| D3 | Cores, cantos, fontes, ícones | Os do app (`tema/tokens.ts`, `RAIO` 12, lucide); nada do DESIGN.md. Cor de ação = marca da consultoria | Pedido do Gustavo |
| D4 | Barra flutuante "Alterações salvas no cache local" | Não entra: nada salva sozinho e o rascunho não fica no aparelho. Vale o "Salvar rascunho" da barra do topo | Pedido do Gustavo |
| D5 | Rótulo do primário no plano do aluno | "Publicar para o aluno" no PC (na `BarraDoPlano`, que também serve dieta e mobilidade); "Publicar" no celular. `BarraDoModelo` não muda (modelo não tem aluno) | Claude |
| D6 | Título | Um h1 só, no `Cabecalho`: "Treino de <nome>" com a foto pequena do aluno; modelo mantém o nome do modelo. A barra grudada não ganha título | Claude |
| D7 | Exercício aberto no estreito | Um por vez (como o Gustavo escreveu); "Abrir/Fechar todos" sai do treino (nenhum e2e o conferia); a mobilidade mantém o dela | Pedido do Gustavo |
| D8 | Aba de série aberta | Controlada pelo editor, por exercício, guardada como uid de uma série do grupo (o grupo que a contém); assim trocar o tipo e o agrupamento mudar não fecha a aba | Claude |
| D9 | "Ir ao primeiro" | Seleciona sessão, exercício e abre a aba da série com problema (fechava a pendência do plano de 30/10) | Claude |
| D10 | "Resumo da sessão" | Só contagens: exercícios, séries por tipo, séries de trabalho (papel TRABALHO da metodologia) e séries de trabalho por grupo muscular da biblioteca ("—" sem grupo). Sem meta, média, % nem cor de bom/ruim | Pedido do Gustavo |
| D11 | Fora do design por serem inventados | Bloco vigente, Meta semanal, Esforço alvo, "Dentro da meta", RIR médio, "Intensidade planejada alta" | Pedido do Gustavo |
| D12 | Seleção ao mudar a lista | Exercício novo fica selecionado; apagar o selecionado passa ao vizinho; trocar de sessão/desfazer/recarregar sem o uid passa ao primeiro; "+ Nova série" e receita abrem a aba nova; apagar a aba aberta passa à vizinha | Claude |
| D13 | Branch e worktree | `editor-treino-inspetor` a partir de `origin/main`, em worktree novo (`wt-editor-treino-inspetor`), porque o repositório principal tinha arquivos de outra conversa. PR sem mesclar | Pedido do Gustavo |

## Passos
- [x] 1. Plano e índice (este arquivo e a linha no README) — commit/run: 21395e9e
- [x] 2. Regras puras em `dominio/` com teste (`colunasDoEditor`, `inspetorDoTreino`) — commit/run: a9368ac7
- [x] 3. Casca: `TelaDoEditor` mede a largura, título e rótulo do primário — commit/run: 8df60751
- [x] 4. Estado de seleção e aba aberta no `EditorDeTreino`; "ir ao primeiro" abre a aba — commit/run: 8df60751 (seleção), 3569ca4a (aba)
- [x] 5. Lista (mestre), resumo da sessão e `SeletorDeSessoes` com contagens — commit/run: 8df60751
- [x] 6. Inspetor (detalhe) com abas de séries; celular com as mesmas abas — commit/run: 3569ca4a, 2ea7c34a (o `CartaoExercicio` não foi dividido: o inspetor é o próprio cartão aberto)
- [x] 7. E2e novo `editor-inspetor` (1440 e 390) e seletores dos e2e existentes — commit/run: 2ea7c34a, e607a94f
- [x] 8. Contraste das peças novas, Ajuda e PDFs, AGENTS.md — commit/run: este lote (contraste em 3569ca4a e 8df60751)
- [ ] 9. Prints (1440 claro e escuro, 1280, 1024, 390), revisão final, push e PR — commit/run: —

## Fora do escopo
- O mesmo tratamento em dieta e mobilidade (ideia anotada: lista + inspetor nelas depois que o do treino for validado com o Saraiva).
- Barra flutuante de cache local do design (D4).

## O que ficou para trás
- Técnica ainda em chips (não `EscolhaSuspensa`) e Repetições/Carga/Esforço/Descanso em linhas separadas: `CamposDaPrescricao` guarda regra de campo e os e2e dependem dos chips; juntar numa linha só fica para depois.
- O `CartaoGrupo` (superset) traz todos os controles dentro da coluna de ~360 px da lista e fica pesado; o certo seria levar a edição do grupo para o inspetor.
- A estimativa da largura antes da primeira medida não considera o menu minimizado (72 px): nesse caso o primeiro quadro pode piscar uma vez.
- Aninhamento de cartões (sessão, exercício, grupo, seções) deixa os campos estreitos no celular; "Mover exercício" repetido nos dois botões do topo do inspetor; chips de "Carga do exercício" empilhados em 1024.
- O `webServer` do `npm run e2e` caiu uma vez com o código 3221225477 na máquina do Gustavo (contornado com `expo export` manual); se repetir na CI, investigar.
- Dieta e mobilidade no mesmo layout de lista + inspetor.
