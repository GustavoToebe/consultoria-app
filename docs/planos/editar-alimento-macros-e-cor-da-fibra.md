# Modal "Editar alimento": macros reorganizados, cor da fibra e modal mais largo

Situação: Entregue e publicado em 19/11/2026 (push `c3d3359e`, run 44559836626 verde, web `c3d3359ed612`) · Onde: `main` · Atualizado: 19/11/2026

## Objetivo
No formulário do alimento da biblioteca, os quatro macros (proteína, carboidrato, gordura e fibras) numa grade de colunas iguais, com a kcal calculada à vista; a fibra ganha cor própria de macro, usada onde ela aparece; o modal fica mais largo (~800 px) e aproveita a largura.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Cor da fibra | Verde-lima própria, diferente do verde de `sucesso`; marca ≥ 3:1, texto ≥ 4,5:1 nas superfícies e nos modais dos 9 temas, e luminosidade diferente das outras três marcas (teste em `tokens.test.ts`) | Gustavo, 19/11/2026 |
| D2 | Layout | Estreito (< ~640 px do modal): kcal na linha do título e macros 2 + 2 (abaixo de ~480 px); largo: cinco colunas iguais com a kcal só de leitura em `superficie2` | Gustavo, 19/11/2026 |
| D3 | Largura do modal | ~800 px (largura de modal largo se já existir; senão constante em `tokens.ts`) | Gustavo, 19/11/2026 |

## Passos
- [x] 1. Cor da fibra nos tokens e no teste; `MarcaDoMacro` da fibra em todos os lugares onde ela aparece — executor-front, 19/11, commit `f06f8d83` (publicado no run 44559836626) — `PALETA_DA_FIBRA` (claro e areia `#6A8A00`, escuro `#B8E34A`), `tokens.test.ts` "cor da fibra" (27 temas × 3), marca em `ValoresDaDieta`, cabeçalho e campo do item manual (`CartaoRefeicao`), `TotalDoDia` e `aluno/DietaDoAluno`; o PDF não tem cor de macro e ficou sem — commit: —
- [x] 2. Formulário do alimento: título sem corte, grade de macros, linha única da fibra, modal largo e o resto na mesma grade — executor-front, 19/11, commit `f06f8d83` (publicado no run 44559836626) — `LARGURA_FOLHA_LARGA` (800), `treinador/biblioteca/gradeDoAlimento.ts` (5/4/2 colunas, com teste), e2e `fibra-do-alimento.spec.ts` (1280 e 390 em claro e escuro, e 560) — commit: —

## Fora do escopo
- Cálculo da kcal e regras da fibra (a fibra segue fora da kcal; nula = "—").

## O que ficou para trás
- A fibra é só marca: no claro e na areia passa 3:1 (3,10 a 4,00), não 4,5:1, e nunca vira texto. Conflita com "macro nunca é verde" do `docs/design-e-front.md`; o texto novo vai pela sessão principal.
- Não visto em aparelho real nem com leitor de tela; 768 px e os temas Meia-noite, Oceano, Ameixa, Céu, Lavanda e Rosa só pelo teste de contraste.
