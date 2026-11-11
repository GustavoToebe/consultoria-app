# S3. Hierarquia: tamanho, peso de borda e cabeçalho de página

Prévia: todas as telas; o mostruário fica no `index.html` · Plano: [visual-vendavel.md](../visual-vendavel.md)

## O problema
- `ui/tipografia.ts`: título de cartão (`bloco`) 16 px e corpo 15 px. Um pixel não separa título de texto.
- Número de KPI (`destaque`) 28 px e cinza quando é zero: o maior elemento da tela é um "0".
- `BORDA_BLOCO = 2` vale para o cartão e para o que está dentro dele: três níveis com o mesmo contorno.
- Cada tela monta o topo de um jeito: às vezes cinco botões com o mesmo peso (editor de treino).

## A proposta

### 1. Escala (só três variantes mudam)
| Variante | Hoje | Proposta | Uso |
| --- | --- | --- | --- |
| `destaque` | 28 | **36** em ≥ 768, 28 abaixo | número de KPI, total do dia |
| `titulo` | 24 | **28** em ≥ 768, 24 abaixo | h1 da página |
| `bloco` | 16 semibold | **18** semibold | título de cartão |
| `corpo`, `suave`, `rotulo`, `secao`, `pequeno` | 15, 14, 13, 12, 12 | iguais | |

### 2. Cor do número
Zero ou "—" em `textoSuave`. Número que pede ação na cor do status (âmbar, vermelho). Número informativo em `texto`.
Nunca verde "porque está bom" sem selo de texto.

### 3. Peso das bordas
- Bloco de primeiro nível: contorno de 2 px (como hoje).
- Dentro do bloco: divisor de 1 px (`divisor`) ou preenchimento `superficie2`. **Sem cartão contornado dentro de cartão.**
- Item escolhido dentro do bloco: `marcaBorda` (S1), único caso de contorno interno.

### 4. Cabeçalho de página padrão (uma peça)
```
Alunos › Ana Beatriz Lima                       ← migalha (onde estou)
Treino A · Peito e ombros            [Publicar] ← h1 + UMA ação principal
Rascunho · alterado há 5 min   [Salvar] [⋯]     ← situação em selo + secundárias; o resto no ⋯
```
No aluno: título, "Exercício 2 de 5" e barra de progresso na `marcaTexto`.

### 5. Rótulo de seção
`secao` (12, caixa alta) como sobretítulo de cada grupo de campos, no lugar de mais um cartão.

## Onde mexer
| Arquivo | O que muda |
| --- | --- |
| `app/src/ui/tipografia.ts:7-11` | três tamanhos; `destaque` e `titulo` por largura (o `Texto` já recebe `fatorTexto`; a quebra entra pelo hook de largura que as telas usam) |
| `app/src/ui/Cartao.tsx:44` | prop `nivel` já existe: nível 2 passa a não ter contorno (preenchimento `superficie2`) |
| `app/src/ui/` (novo `CabecalhoDePagina.tsx`) | migalha, h1, situação, `acaoPrincipal`, `acoes` (secundárias) e `maisAcoes` (vai para a `FolhaDeAcoes` que já existe) |
| `app/src/treinador/plano/` (`BarraDoPlano`) | passa a usar o cabeçalho: Publicar é a principal; Salvar rascunho secundária; Ver como o aluno, PDF e Validar no ⋯ ou secundárias conforme a largura |
| `app/src/treinador/painel/CartaoMini.tsx`, `FaixaDoPainel.tsx` | regra da cor do número |

## Telas afetadas (é design system: conferir todas antes de subir)
Qualquer tela com `Cartao` com título, com `Texto variante="titulo"` ou `"destaque"`. Na prática: Início, Alunos, ficha
(5 abas), editores de treino, dieta e mobilidade, Planejamento, Agenda, Financeiro, Interessados, Atualizações, Marca,
Equipe; no aluno: Início, Treino, Dieta, Histórico, Conta. Risco real: título de cartão que quebra em duas linhas em
390 px. Conferir com Playwright em 390 e com o texto grande das preferências ligado.

## Testes
- `npm run typecheck && npm run lint && npm test` (os testes de tela leem texto, não tamanho).
- E2e completo em 390 e 1280, porque altura de cartão muda e pode empurrar alvo para fora da tela.

## Documento de design
`docs/design-e-front.md`: seção de tipografia, regra das bordas e a lista de conferência 6.4 (acrescentar "a tela usa o
`CabecalhoDePagina`?" e "há cartão contornado dentro de cartão?").
