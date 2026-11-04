# Editor de treino em lista + inspetor (design do Stitch)

Situação: primeira parte publicada (PR #94); sobras feitas, sem commit (S3 parcial) · Onde: branch `editor-inspetor-sobras` (worktree `wt-04-11-A`) · Atualizado: 04/11/2026

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
| D2 | Largura máxima do editor em duas colunas | ~~1440 px~~ substituída em 04/11 (decisão 6 de `editores-revisao.md`): `LARGURA_EDITOR_DUAS_COLUNAS = LARGURA_MAXIMA`, todo o espaço útil, e a "Configuração do plano" em `LARGURA_EDITOR`; em coluna única segue `LARGURA_EDITOR` (1040) | Claude; troca: Gustavo (04/11) |
| D3 | Cores, cantos, fontes, ícones | Os do app (`tema/tokens.ts`, `RAIO` 12, lucide); nada do DESIGN.md. Cor de ação = marca da consultoria | Pedido do Gustavo |
| D4 | Barra flutuante "Alterações salvas no cache local" | Não entra: nada salva sozinho e o rascunho não fica no aparelho. Vale o "Salvar rascunho" da barra do topo | Pedido do Gustavo |
| D5 | Rótulo do primário no plano do aluno | "Publicar para o aluno" só no treino do aluno e só em duas colunas (na `BarraDoPlano`, que também serve dieta e mobilidade); "Publicar" em tela estreita, na dieta e na mobilidade. `BarraDoModelo` não muda (modelo não tem aluno) | Claude |
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
- [x] 8. Contraste das peças novas, Ajuda e PDFs, AGENTS.md — commit/run: 7a96f360 e o anterior (contraste em 3569ca4a e 8df60751)
- [x] 9. Prints (1440 claro e escuro, 1280, 1024, 390), revisão final, push e PR — commit/run: push da branch `editor-treino-inspetor` e PR (link no relatório); prints fora do git

## Sobras (04/11, branch `editor-inspetor-sobras`)
- [x] S1. Grupo de exercícios (superset e os outros): na lista vira uma linha compacta (`GrupoNaLista`: tipo, voltas, quantos exercícios, descanso) com os membros embaixo; escolher a linha abre a edição (tipo, descanso, incluir, setas, desfazer) no inspetor (`EditorDoGrupo`). Empilhado, tocar na linha abre a edição ali mesmo. Criar um grupo já o escolhe — commit sugerido: "Editor de treino: grupo de exercícios compacto na lista e edição no inspetor"
- [x] S2. Técnica da série em `EscolhaSuspensa` (era chips); os e2e passaram a abrir a lista (`escolherTecnica`) sem perder asserção — commit sugerido: "Editor de treino: técnica da série em lista suspensa"
- [~] S3. Repetições, Carga, Esforço e Descanso lado a lado conforme a largura do corpo do grupo de séries (regra pura `colunasDaPrescricao`, com teste, em `treinador/treino/colunasDaPrescricao.ts` ao lado do `CamposDaPrescricao`: os testes do `EditorSeries` trocam o `CamposDaPrescricao` inteiro por um mock): as quatro numa linha a partir de 926 px de corpo, de duas em duas a partir de 512, uma por linha abaixo disso; com mais de uma por linha, "Carga de cada série" desce para uma linha inteira. Medido: 674 px (1440), 522 (1280), 634 (1024), 294 (390), então 2 + 2 no PC e 1 no celular. Uma linha só pede uns 1700 px de janela — commit sugerido: "Editor de treino: prescrição da série lado a lado"
- [x] S4. Celular com no máximo dois níveis de moldura: sessão sem cartão (só a faixa do cabeçalho) abaixo de 768 px e as seções do grupo de séries planas (divisor em vez de caixa) — commit sugerido: "Editor de treino: menos cartões aninhados no celular"
- [x] S5. Dieta e mobilidade em lista + inspetor com 960 px de conteúdo (`TelaDoEditor colunas`): refeições (ou seções) numa lista de 280 px à esquerda (`plano/ItemDaListaDoEditor`, a mesma peça do item de exercício, com "Corrigir" na que tem problema) e a escolhida inteira à direita, sempre aberta (`CabecalhoDoItem` sem `aoAlternar`); adicionar escolhe a nova, remover passa à vizinha (`proximaSelecao`); "Abrir todas" some na dieta e vale só para os itens da seção escolhida na mobilidade; o modelo de uma refeição só fica empilhado. Abaixo de 960 px, os cartões empilhados de antes. `secaoValida` em `dominio/mobilidade` (o selo da seção), com teste. E2e `editor-inspetor-sobras` (1440, 1280, 1024, 390; claro e escuro) — commit sugerido: "Dieta e mobilidade em lista + inspetor no PC"

## Fora do escopo
- Barra flutuante de cache local do design (D4).

## O que ficou para trás
- As quatro caixas da prescrição numa linha só aparecem a partir de uns 1700 px de janela (926 px de corpo); em todas as larguras de PC testadas ficam de duas em duas. Para caber em 1440 seria preciso estreitar a lista ou a caixa de Carga (310 px mínimos).
- A estimativa da largura antes da primeira medida não considera o menu minimizado (72 px): nesse caso o primeiro quadro pode piscar uma vez.
- "Mover exercício" repetido nos dois botões do topo do inspetor; chips de "Carga do exercício" empilhados em 1024.
- O `webServer` do `npm run e2e` caiu uma vez com o código 3221225477 na máquina do Gustavo (contornado com `expo export` manual); se repetir na CI, investigar.
- ~~Dieta no celular ainda tem três molduras (refeição › opção › item); a S4 cuidou só do treino.~~ Resolvido em 04/11 (`editores-revisao.md`, passo 2): a opção virou seção com fio, refeição › item.
- Os guias em PDF precisam ser gerados de novo (a Ajuda mudou: lista e inspetor, séries, grupos, opções da dieta).
