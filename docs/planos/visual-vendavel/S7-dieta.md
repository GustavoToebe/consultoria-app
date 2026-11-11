# S7. Dieta: aluno e editor do treinador

Prévia: `aluno-dieta.html`, `treinador-dieta.html` · Plano: [visual-vendavel.md](../visual-vendavel.md)

## O problema
- **Aluno:** "Total do dia" mostra 1803 kcal e três "—" do mesmo tamanho; orientações e observações recolhidas no topo
  empurram as refeições para baixo; a pessoa não sabe qual é a refeição de agora.
- **Editor:** nenhuma cor; a lista de refeições à esquerda não mostra o tamanho de cada uma; os complementos
  (Orientações, Observações, Suplementação, Outros) são quatro cartões iguais abaixo do inspetor.

O que já está bom e fica: a cor por refeição com a etiqueta grande de quantidade (D14 de 03/11) e as abas Opção A/B.
Ajuste de 10/11 ("Dose de cor" no plano): na prévia Calma a cor da refeição fica só na barra lateral de 6 px; o
horário e a etiqueta de quantidade ficam neutros. Isso muda o D14 de 03/11 e depende do ok do Gustavo na prévia.

## A proposta

### Aluno
1. **Total do dia como faixa de números:** kcal em 36 px; proteína, carboidrato e gordura em gramas ao lado, cada um com
   uma barra fina proporcional às calorias do macro (4/4/9 kcal por grama, conta que o `TotalDoDia` já faz para somar).
   Macro sem dado continua "—" e **sem barra**: nada inventado. As barras são neutras (`texto` em três opacidades), não
   ganham cor de identificação, para não brigar com a cor das refeições.
2. **Linha do tempo das refeições:** horário à esquerda em tabular, cartão à direita com a barra da cor da refeição.
   A próxima refeição pelo horário do aparelho ganha o sobretítulo "AGORA" e contorno `marcaBorda`; é só destaque
   visual pelo relógio, sem registrar nada. Refeição sem horário não entra na regra.
3. **Cabeçalho da refeição com as calorias dela** à direita (quando há dado).
4. **Orientações e observações** viram um bloco "Do seu treinador" depois das refeições no celular, e coluna lateral
   em ≥ 1024.
5. **Suplementação** com o cupom em selo tingido e "Copiar cupom" (já existe), separada das refeições por rótulo de seção.

### Editor
1. **Barra do topo com o total** fixo enquanto rola: kcal e macros, com a variação em relação à última versão publicada
   ("+120 kcal") em `textoSuave`. Sem meta: o app não calcula nem opina sobre dieta.
2. **Lista de refeições à esquerda** com a cor da refeição (a mesma do aluno, `corDaRefeicao(indice)`), horário,
   quantidade de alimentos e kcal da opção A. A escolhida usa a seleção do S1.
3. **Inspetor:** tabela de alimentos com quantidade e unidade na etiqueta colorida (igual ao aluno vê), macros em
   colunas tabulares alinhadas à direita, linha de total da refeição em semibold.
4. **Complementos em abas** dentro de um bloco só ("Orientações · Observações · Suplementação · Outros"), com ponto
   quando a aba tem conteúdo.

## Onde mexer
| Arquivo | O que muda |
| --- | --- |
| `app/src/aluno/DietaDoAluno.tsx:98` (Total do dia), `:198-199` (cor da refeição) | itens 1 a 5 do aluno |
| `app/src/dominio/` (novo `refeicaoDeAgora`, regra pura com teste) | próxima refeição pelo horário; empate e virada do dia |
| `app/src/treinador/dieta/TotalDoDia.tsx:15-34` | faixa fixa e variação contra a publicada |
| `app/src/treinador/dieta/EditorDeDieta.tsx`, `CartaoRefeicao.tsx` | lista com cor e resumo; tabela do inspetor |
| `app/src/treinador/dieta/ComplementosDaDieta.tsx` | abas (`ui/Abas`, variante sublinhado) |
| `app/src/dominio/corDaSerie.ts:57` (`corDaRefeicao`) | reutilizar no editor; hoje só o aluno chama |

## Regras que não mudam
- Valor nutricional ausente é "—". Nunca zero, nunca estimado na tela.
- Sem opinião sobre saúde: nada de "acima do ideal", nada de meta calculada.
- Ergogênicos ("Outros") seguem atrás de `ERGOGENICO_LER`.
- A prévia "Ver como o aluno" usa `DietaDoAluno` por props: o que mudar lá aparece na prévia sem trabalho extra.

## Testes
- `dominio/refeicaoDeAgora.test.ts`.
- `CartaoRefeicao.test.tsx` e o e2e da dieta (aluno e editor) em 390 e 1280.
- PDF da dieta não muda nesta sugestão.
