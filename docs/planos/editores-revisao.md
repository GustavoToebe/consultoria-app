# Revisão geral dos editores (treino, dieta, mobilidade)

Situação: Em andamento · Onde: branch `editores-revisao` (worktree `wt-editores-revisao`, saída da `main` 4538ef20) · Atualizado: 04/11/2026

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
- [ ] 2. Editor de dieta (`executor-front`): padrões do passo 1; pendência S4 (3 molduras no celular) — commit/run: —
- [ ] 3. Editor de mobilidade (`executor-front`) — commit/run: —
- [ ] 4. Verificação (typecheck, lint, jest, e2e dos três editores; capturas 390/1280/1440, treino também 1920, 4 temas), advisor, push da branch e PR sem mesclar — commit/run: —

## Fora do escopo
- Regra de negócio em `dominio/`, contratos da API, offline/sincronização, novo layout de uma coluna.
- Teste em aparelho nativo (não há como fazer aqui; dizer no relatório).
- Os 2 e2e que já falham na `main` (`cadastro-aluno.spec.ts:296`, `links-do-menu.spec.ts:20`) ficam anotados à parte.

## O que ficou para trás
- `CartaoExercicio` continua com moldura própria, sem `ui/Cartao`: o alvo de rolagem do "ir ao primeiro" fica por fora, o topo `faixaForte` leva a demonstração do exercício e a borda muda com o erro; trocar pediria uma prop nova no `ui/Cartao` (passo 1, 04/11).
- Dois critérios de largura continuam: 960 medido (duas colunas) e 640 medido (campos lado a lado na coluna das séries); os 768 da janela (`useCamposLadoALado`) ficaram nos campos curtos (`LinhaDeCampos`, `CampoSozinho`), que a metodologia também usa e lá não há medida da coluna; trocar pede levar a medida por contexto (passo 1, 04/11).
- Teste em aparelho nativo do editor de treino: não há como fazer aqui (passo 1, 04/11).
