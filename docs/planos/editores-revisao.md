# Revisão geral dos editores (treino, dieta, mobilidade)

Situação: Em andamento · Onde: branch `editores-revisao` (worktree `wt-editores-revisao`, saída da `main` 4538ef20) · Atualizado: 06/11/2026

## Objetivo
O editor de treino do treinador ficou bagunçado e confuso (pedido do Gustavo, 04/11, com prints). Rever a hierarquia e
as repetições do editor de treino e, com os padrões que saírem dele, os editores de dieta e de mobilidade, que usam o
mesmo `ItemDaListaDoEditor`. Nenhuma regra de negócio, rota ou contrato da API muda.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Quando começar | Depois do #97 (Libras) na `main`; feito em 04/11 | Gustavo, 04/11 |
| 2 | Profundidade | Redesenho **dentro das 2 colunas** (lista 360 \| inspetor), preservando D1–D12 e S1–S5 de `editor-treino-inspetor.md` | Gustavo, 04/11 |
| 3 | Decisão A (do `editor-treino-inspetor.md`) | Prescrição em **2+2 caixas no PC** (no máximo 2 por linha; 1 no celular). Sai do PR `pos-lote-04-11` e entra aqui | Gustavo, 04/11 |
| 4 | Abrangência | Os três editores que usam `ItemDaListaDoEditor`: treino, dieta, mobilidade (uma tela por chamada do `executor-front`) | Gustavo, 04/11 |
| 5 | Tokens e peças de `ui/` | Podem ser mudados direto, sem "sugestão"; listar as telas afetadas e conferi-las | Gustavo, 04/11 |
| 6 | Aproveitar a largura em janelas largas | Editor em duas colunas usa todo o espaço útil (`LARGURA_EDITOR_DUAS_COLUNAS = LARGURA_MAXIMA`, era 1440; tratado uma vez, na casca, para os três editores); a "Configuração do plano" segura os campos em `LARGURA_EDITOR` (1040), sem coluna com conteúdo novo; decisão A, D1–D12, S1–S5 e o corte de 960 continuam | Gustavo, 04/11 |

## Achados do mapeamento (estado do #97)
- Nome/posição do exercício em até 4 lugares visíveis (item da lista, faixa do inspetor, "Nome de exibição", faixa
  "Exercício N · nome" dentro do grupo); situação da série com 3 sinais (selo do "Editando", selo do "Para o aluno",
  fundo tingido); resumo das séries em 3 lugares; metodologia com dois "Trocar"; "Modelos" em dois lugares.
- "Mover exercício" ×2 e "Mover grupo" ×2 com o mesmo texto (só o ícone muda); "grupo de séries" colide com "grupo"
  de exercícios.
- Moldura dentro de moldura: inspetor › "Editando" › caixas das seções › campos (contra §5.1 do design).
- 4 caixas numa linha só em janela ~1700 px (`colunasDaPrescricao.ts`); três critérios de largura misturados
  (960 medido, 768 janela, 640 medido).
- `EditorDeTreino.tsx` (648), `CamposDaPrescricao.tsx` (678), `EditorSeries.tsx` (579): na faixa que o §6.3 manda dividir.
- Estilos locais que imitam `ui/`: cartão/faixa do `CartaoExercicio`, `Secao` local, bloco do `ResumoDaSessao`,
  número invertido 28×28 duplicado (raio 8 e 6), divisor de 1 px repetido.

## Passos
- [ ] 0. Preparação: worktree, este arquivo e a linha no README — commit/run: —
- [x] 1. Editor de treino (`executor-front`): topo do inspetor, séries, molduras achatadas, 2+2, "uma vez só", parte de cima, peças em `ui/`, divisão dos três arquivos grandes, e2e atualizados — commit/run: fb930116 (04/11)
  - Feito: `ui/NumeroInvertido` e `ui/Divisor` (únicos); "Sessões (N)" como cabeçalho dos chips com as contagens e o estado da publicação; "Modelos prontos" só no bloco Adicionar e no vazio; metodologia num lugar por layout (`ConfiguracaoDoTreino`); sessão sem caixa (molduras: exercício › série aberta); "Editando: Série N · tipo" com o resumo e um selo; seções planas com divisor; "Para o aluno" sem selo; Subir/Descer <nome> e Subir/Descer/Remover série N; prescrição em grade 2+2 (`basesDasColunas`); "+ Nova série" fora da rolagem; divisão em `FolhasDoTreino`, `ConfiguracaoDoTreino`, `EditorDoGrupoDeSeries`, `CamposComuns`, `CamposDaTecnica` (todos abaixo de 500 linhas); e2e novo `prescricao-lado-a-lado.spec.ts`.
  - Topo do inspetor: "Exercício N de M" pequeno + nome como título; ↑↓ como `IconeBotao` com rótulo "Subir/Descer <nome>"; um selo de situação só.
  - Séries: tirar a faixa "Exercício N · nome" de dentro do grupo; um sinal de situação só (selo no cabeçalho; "Para o aluno" sem segundo selo, tingido só com problema); mover série com nome "série", não "grupo".
  - Molduras: dentro do "Editando", seções com rótulo e divisor, no máximo 2 molduras.
  - Prescrição 2+2: `colunasDaPrescricao` com no máximo 2 por linha no PC; atualizar `colunasDaPrescricao.test.ts`; casos em 1280, 1440 e 1920.
  - Uma vez só: metodologia num lugar por layout; "Modelos" só no bloco Adicionar; um critério de largura onde der.
  - Parte de cima: Voltar, atualização, faixa do plano, ciclo, contadores, problemas, desfazer, configuração.
  - Peças: número invertido e divisor únicos em `ui/`; `CartaoExercicio` sobre `ui/Cartao` se couber.
  - e2e a atualizar: `editor-inspetor`, `editor-inspetor-sobras`, `editor-clareza`, `series-metodologia`, `editor-series`, `metodologia`, `grupos-e-cardio-treino`, `unidade-de-carga-treinador`, `EditorSeries.abas.test.tsx`, `ajuda/conteudo.test.ts`.
- [x] 2. Editor de dieta (`executor-front`): padrões do passo 1; pendência S4 (3 molduras no celular) — commit/run: — (aguardando o commit do Sonnet)
  - Feito: `CartaoRefeicao` reescrito (cabeçalho `CabecalhoDoItem` com um selo, Subir/Descer e lixeira com o nome; opções como seção com `ui/Divisor`, sem caixa: refeição › item, **S4 resolvida**); "Refeições (N)" como cabeçalho com "Lista de compras" e "Abrir/Fechar todas" (só empilhado); "Modelos prontos" só no bloco "Adicionar próxima refeição" (`plano/BlocoAdicionar`, agora também no treino) e numa folha (`FolhasDaDieta`, `plano/OpcaoDeModelo`, a mesma do treino); "Total do dia" à parte (`TotalDoDia`, água logo depois dos números); suplementação, ergogênicos e orientações em `ComplementosDaDieta`; rótulos únicos ("Adicionar refeição pronta", "Suplemento/Ergogênico da biblioteca", "… manual"); `EditorDeDieta` com cerca de 300 linhas.
  - Largura (decisão 6): `LARGURA_EDITOR_DUAS_COLUNAS = LARGURA_MAXIMA`; `ConfiguracaoDoPlano` e os dados da refeição (nome, horário, observação, modo de preparo) com `maxWidth: LARGURA_EDITOR`; remover opção com "Desfazer"; complementos dois por linha em janela larga; `editor-inspetor-sobras.spec.ts` ganhou 1920 nos três editores.
- [x] 3. Editor de mobilidade (`executor-front`): padrões dos passos 1 e 2 — commit/run: — (aguardando commit do Sonnet)
  - Feito: `ItemDeMobilidade` novo (item = segunda e última moldura, número invertido, Subir/Descer/Remover com o nome do item, `erro` no nome vazio e no vídeo, teclado de URL); seção com `CabecalhoDoItem faixa` ("Seção N de M" só no inspetor, um selo "Corrigir", lixeira com o nome; a única seção não sai) e "Título da seção" como campo; molduras seção › item também no celular (S4 não se aplica mais); "Adicionar seção" só no `plano/BlocoAdicionar` "Adicionar próxima seção" (fim da lista ou dos cartões); "Abrir/Fechar todos" só empilhado; remover seção ou item com `BarraDesfazer` (o `PainelConfirmacao` saiu), e empilhado o aviso aparece no lugar do que saiu (item: na seção dele; seção: onde ela estava), porque as seções são cartões abertos e o topo ficava fora da janela; a ordem do topo igual à do treino e da dieta (pasta, problemas, faixa do plano, plano). E2e novo `e2e/editor-mobilidade.spec.ts` (1280, 1920, 390) e `editor-inspetor-sobras.spec.ts` com os rótulos novos.
  - Largura (decisão 6): ver "Largura na mobilidade" em "O que ficou para trás" (resolvida).
- [ ] 4. Verificação (typecheck, lint, jest, e2e dos três editores; capturas 390/1280/1440, treino também 1920, 4 temas), advisor, push da branch e PR sem mesclar — commit/run: —

## Fora do escopo
- Regra de negócio em `dominio/`, contratos da API, offline/sincronização, novo layout de uma coluna.
- Teste em aparelho nativo (não há como fazer aqui; dizer no relatório).
- Os 2 e2e que já falham na `main` (`cadastro-aluno.spec.ts:296`, `links-do-menu.spec.ts:20`) ficam anotados à parte.

## O que ficou para trás
- `CartaoExercicio` continua com moldura própria, sem `ui/Cartao`: o alvo de rolagem do "ir ao primeiro" fica por fora, o topo `faixaForte` leva a demonstração do exercício e a borda muda com o erro; trocar pediria uma prop nova no `ui/Cartao` (passo 1, 04/11).
- Dois critérios de largura continuam: 960 medido (duas colunas) e 640 medido (campos lado a lado na coluna das séries); os 768 da janela (`useCamposLadoALado`) ficaram nos campos curtos (`LinhaDeCampos`, `CampoSozinho`), que a metodologia também usa e lá não há medida da coluna; trocar pede levar a medida por contexto (passo 1, 04/11).
- Teste em aparelho nativo do editor de treino: não há como fazer aqui (passo 1, 04/11).
- ~~Largura no treino (decisão 6): acima de 1440 o inspetor fica largo e "Nome de exibição", "Nome da sessão" e "Texto curto para o aluno" chegam a ~1400 px~~ **Resolvida** (`executor-front`, 04/11, aguardando o commit do Sonnet): o espaço é ocupado por layout, sem conteúdo novo. `CartaoExercicio` mede o corpo e, a partir de ~1090 px (o inspetor de 1920), divide em dados | séries: coluna de 400 com Dados do exercício, "Execução e cadência" e "Vídeo e instruções", um fio, e as séries no resto (~820 px: Tipo e Técnica lado a lado e a prescrição 2+2, decisão A mantida) com "Salvar como receita de séries"; 1440, 1280, 1024 e o celular seguem numa coluna, na ordem de antes. `CartaoSessao`: Nome · Dia · Tipo em até `LARGURA_EDITOR` e a "Observação" ao lado a partir de ~1140 px de conteúdo (1440 e 1920); em 1280 e no celular ela desce, como antes. `CartaoGrupo` (grupo de exercícios no inspetor) com o corpo em `LARGURA_EDITOR`. Caso novo em `e2e/prescricao-lado-a-lado.spec.ts` (1280, 1440, 1920). A "Configuração do plano" (peça de `plano/`, recolhida por padrão) continua com os campos em 1040 e o resto do cartão vazio em 1920: mexer nela muda os três editores (passo 2, 04/11).
- ~~Largura na mobilidade (decisão 6): "Orientações" e os campos da seção ocupam a largura toda acima de 1440; limitar no passo 3 (passo 2, 04/11).~~ **Resolvida** (`executor-front`, passo 3, aguardando o commit do Sonnet): o espaço é ocupado por layout, sem conteúdo novo. Em duas colunas (1280, 1440, 1920) a "Configuração do plano" (no modelo do Planejamento, o cartão Nome e Descrição do modelo, prop `aoLado` de `SecoesDeMobilidade`) divide a linha de cima com as "Orientações", metade cada, e começa aberta; empilhado fica uma embaixo da outra, como antes (a mesma árvore nas duas larguras, para o foco não se perder ao cruzar 960 px). "Orientações" e "Título da seção" com `maxWidth: LARGURA_EDITOR`. Os campos do item (Nome, Prescrição, Vídeo) se dividem pela largura do inspetor: os três numa linha em 1920, Nome e Prescrição numa linha e o Vídeo embaixo em 1280 e 1440, um por linha no celular. Conferido em capturas 390/1280/1440/1920, claro e escuro.
- Mobilidade: seção sem item é recusada pela API ("Seção sem item.", `ValidadorMobilidade`), mas `dominio/mobilidade.secaoValida`/`mobilidadeValida` não a acusam (o selo "Corrigir" não aparece e o "Salvar modelo" não trava; o motivo do modelo já promete "Toda seção precisa de item"). A tela só mostra "Seção sem item. Adicione ao menos um."; a regra é de `dominio/` e vai ao `executor` (passo 3, 06/11).
- Dieta: "Desfazer" continua no topo, abaixo de "Refeições (N)"; empilhado as refeições começam fechadas, então fica perto, mas com várias abertas o aviso pode sair da janela. A mobilidade passou a mostrar o aviso no lugar do que saiu; levar o mesmo à dieta se o Gustavo quiser (passo 3, 06/11).
- Teste em aparelho nativo do editor de mobilidade: não há como fazer aqui (passo 3, 06/11).
- Dieta e treino: "Publicar para o aluno" continua só no treino em duas colunas; a dieta segue com "Publicar" (decisão já existente, não mexida) (passo 2, 04/11).
- Teste em aparelho nativo do editor de dieta: não há como fazer aqui (passo 2, 04/11).
- Dieta: remover um alimento ainda é imediato, sem "Desfazer" (refeição e opção já têm; era assim antes) (passo 2, 04/11).
