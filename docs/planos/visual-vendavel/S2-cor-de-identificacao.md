# S2. Cor de identificação nos lugares que importam

Prévia: `treinador-treino.html`, `treinador-alunos.html` (ficha), `aluno-treino.html`, `aluno-inicio.html` · Plano: [visual-vendavel.md](../visual-vendavel.md)

## O problema
As cinco cores por tipo de série (Aquecimento ciano, FS azul, WS índigo, Top set violeta, Back off magenta) já existem
e passam contraste (`PALETA_DE_IDENTIFICACAO`, `dominio/corDaSerie.ts`). Mas hoje aparecem só como ponto de 8 px na aba
da série do editor e como barra de 6 px no cartão da série do aluno. Nos lugares em que a pessoa decide ("este treino
tem trabalho suficiente?", "qual série é a que vale?"), a informação está em texto corrido: "7 séries: 1 Aquecimento, 3
FS, 1 WS, 2 Back off".

## A proposta: quatro peças, uma regra
> Ajuste de 10/11: o Gustavo achou a primeira prévia colorida demais. A tabela abaixo já está na dose nova: a cor
> aparece uma vez por tela (no resumo) e no item aberto; linha de lista leva só texto. Ver "Dose de cor" no plano.

A cor continua significando **só** tipo de série (e refeição e divisão, como já decidido em 03/11). Nunca status, nunca
enfeite. O texto do tipo continua sempre junto (D7 de 02/11).

| Peça nova | O que é | Onde entra |
| --- | --- | --- |
| `BarraDeComposicao` | barra fina com um segmento por série, na cor do tipo, na ordem de execução; legenda curta ao lado ("1 Aq · 3 FS · 1 WS · 2 BO") | **uma por tela, no resumo:** barra da sessão no editor, topo do treino do dia do aluno, "Treino de hoje" na ficha. Nas linhas de lista (exercícios do editor, cartões do dia do aluno, Início do treinador) fica só o texto neutro "1 Aq · 3 FS · 1 WS · 2 BO"; no cartão do dia do aluno os segmentos de progresso são neutros (feita cheia, por fazer em contorno) |
| `SeloDoTipo` | selo com fundo da cor a ~16% e letra da cor (o `fundo` que `coresDeIdentificacao` já devolve) | cabeçalho do cartão da série (aluno), linha da tabela de séries (editor), receitas, PDF |
| Chip de tipo com cor | no seletor "Tipo da série", cada opção leva o ponto da sua cor; a escolhida usa a seleção padrão (S1), não a cor do tipo | editor de treino, Marca › tipos de série |
| Resumo da sessão por tipo | "Trabalho: 5 WS · Preparação: 9 FS · 4 Aq" com os números em `texto` e o ponto da cor ao lado do nome, junto da barra de composição | barra da sessão no editor; topo da sessão do aluno |

Onde a cor **não** entra: texto corrido, botões, ícones de ação, fundo de cartão inteiro.

Destaque do que vale: a série de trabalho (WS, Top set) é a que o treinador mais olha. No aluno, o cartão da WS tem a
barra lateral de 6 px e os números maiores; as outras ficam mais compactas. O destaque vem do tamanho, não de mais cor.

## Onde mexer
| Arquivo | O que muda |
| --- | --- |
| `app/src/ui/` (novo `BarraDeComposicao.tsx`, `SeloDoTipo.tsx`) | peças puras de exibição; recebem `[{ chave, rotulo, feita? }]`; `accessibilityLabel` com o texto completo |
| `app/src/dominio/inspetorDoTreino.ts:15-24` | já conta as séries por tipo para `linhaDoExercicio`; expor a lista ordenada para a barra (regra pura, com teste) |
| `app/src/treinador/treino/ListaDeExercicios.tsx:51` | a frase longa vira a linha curta "1 Aq · 3 FS · 1 WS · 2 BO" em texto neutro (sem barra na lista) |
| `app/src/treinador/treino/EditorSeries.tsx:57,114` | aba da série: ponto vira `SeloDoTipo` compacto |
| `app/src/treinador/treino/EditorDoGrupoDeSeries.tsx:56-59,160` (`Tipos`) | opções com `corIndicador` (o ponto); a escolhida segue a seleção padrão |
| `app/src/treinador/treino/ResumoDaSessao.tsx`, `ContadoresDoTreino.tsx` | `BarraDeComposicao` com legenda; números em `texto` |
| `app/src/aluno/CartaoExercicioDoDia.tsx:62-63` | segmentos neutros com as feitas preenchidas, no lugar do selo "0/3 SÉRIES" sozinho (o texto "0 de 3" fica) |
| `app/src/aluno/ExercicioAluno.tsx:410`, `CartaoSerieComEtapas.tsx:100`, `TipoDaSerieComExplicacao.tsx:18-20` | números maiores na série de trabalho; `SeloDoTipo` |
| `app/src/aluno/CartaoHoje.tsx:80` | composição do treino do dia em branco/`sobreMarca` (sobre a marca não cabe cor de identificação: fica só a contagem em texto) |
| `app/src/treinador/ResumoDoAluno.tsx`, `CartaoTreinosConcluidos.tsx` | "Treino de hoje" com a barra (uma por tela); listas de treinos concluídos só com o texto |
| `app/src/pdf/` (treino) | selo do tipo colorido no PDF, se o Gustavo quiser (fica fora do primeiro PR) |

## Testes
- `tokens.test.ts` já cobre texto e barra; acrescentar o par letra × fundo tingido do `SeloDoTipo` (≥ 4,5:1) nas 10 paletas.
- Teste da regra que monta a lista da barra (ordem, tipo criado pelo treinador usa a cor do papel, papel "Outro" sem cor = segmento neutro).
- E2e: `e2e/` do editor de treino e da execução do aluno, em 390 e 1280.

## Decisão que isto reabre
D10 de 03/11 ("barra lateral de 6 px + selo colorido; o cartão continua branco"). A proposta mantém o cartão branco e
acrescenta as quatro peças. Precisa do ok do Gustavo (D5 do plano).

## Dependência
A frente `editor-de-treino-reorganizado` está em andamento e mexe nos mesmos arquivos do editor. Aplicar depois dela.
