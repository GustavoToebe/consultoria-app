# Editor de séries: RIR de 0 a 10, RIR por série, RPE nos aquecimentos, carga fixa

Situação: Em andamento · Onde: branch `editor-de-series-reuniao` (worktree `wt-editor-series`) · Atualizado: 02/11/2026 · Registro: reunião de 30/10, C05, C11, C10, C03, C14 · Frente B da leva 1

## Objetivo
O treinador do piloto precisa prescrever RIR até 10 (0 = até a falha), RIR diferente em cada série na mesma linha do %,
carga fixa em kg para exercícios com carga, e não ver o RPE em série de aquecimento ou preparação. Dois textos do
editor ficam coerentes (C03, C14).

## O que o código faz hoje (main 19b1fd6)
- O RIR vai de 0 a 5 na API (`Esforco`, `ValidadorTreino`, padrões da metodologia), em `api/tipos.ts`, no editor, no
  aluno, no PDF, no glossário e nas fixtures.
- Cada série já tem `esforco` próprio; esforço diferente separa os grupos de séries iguais (`dominio/agrupamento`).
- Não há modo de carga fixa em `carga.modo`; `deTrabalho` é só `CARGA_TRABALHO`.
- A carga das etapas de Cluster/Rest-pause diz "% da WS" (`treino/opcoesDoEditor.ts:329`).
- O campo "Execução (opcional)" existe no editor.

## Decisões (Gustavo, 02/11/2026; não perguntar de novo)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | C05 RIR | de 0 a 10, 0 = até a falha; muda em **todo lugar**: API (`Esforco`, `ValidadorTreino`, padrões da metodologia), `api/tipos.ts`, editor, aluno, PDF, glossário, fixtures e leitor do pacote offline | Gustavo |
| D2 | RIR por série | em cada série, na mesma linha do %, como o "% por série" dentro do grupo; RIR diferente **não** pode quebrar o grupo de séries iguais (conferir as regras de `dominio/agrupamento`) | Gustavo |
| D3 | C11 RPE | escondido nas séries de papel AQUECIMENTO e PREPARACAO; se já estiver gravado, continua visível e editável | Gustavo |
| D4 | C10 carga fixa | forma nova `CARGA_FIXA` com valor em kg; só em exercício com carga; **não** é série de trabalho (`deTrabalho` segue só `CARGA_TRABALHO`) e não serve de referência para percentual | Gustavo |
| D5 | Onde a carga fixa aparece | editor, "Para o aluno", meta do aluno, PDF e texto do histórico | Gustavo |
| D6 | Leitor da planilha completa | opcional: reconhecer "12 kg" como carga fixa | Gustavo |
| D7 | Libras | fora | Gustavo |
| D8 | C03 | trocar o "% da WS" das etapas de Cluster/Rest-pause pelo mesmo texto da série | Gustavo |
| D9 | C14 | "Execução (opcional)" vira "Cadência e isometria (opcional)" | Gustavo |
| D10 | Plano antigo | sem compatibilidade com o legado (regra do AGENTS.md até o primeiro cliente): prescrição antiga não é migrada | regra do projeto |

## Passos
Andamento em 02/11/2026 (tudo na worktree `wt-editor-series`, branch `editor-de-series-reuniao`, a partir da main `210d828c`; **nada commitado ainda**):
- Passo 1 feito: o explorador mapeou RIR/`Esforco` (0–5 em `ConteudoTreino`, `validacaoDeSerie.ts`, `opcoesDoEditor.ts`), `carga.modo`/`deTrabalho`, agrupamento (`agrupamento.ts`: a chave inclui rir e rpe, é o que precisa mudar) e os testes que fixam 0..5.
- Passo 2: o `executor` está trabalhando (API e funções puras `.ts`; não toca `.tsx` visuais, só o texto do C14 em `CartaoExercicio.tsx`). O Sonnet revisa o diff quando ele voltar.
- Passo 3 (editor) vai para o `executor-front` depois do passo 2 e do merge do que ele entregar; passo 4 depois do 3.
- Riscos a olhar na revisão: pacote offline com app antigo (RIR 10, `CARGA_FIXA`), limite de RIR no leitor da planilha (não localizado), RPE escondido só na UI (a API não muda).

- [x] 1. Mapear todos os usos de RIR/`Esforco`, de `carga.modo` e de `deTrabalho` (explorador) — explorador — feito em 02/11/2026 (sem commit; só leitura)
- [ ] 2. API e domínio: RIR 0–10, `CARGA_FIXA` (`ConteudoTreino`/`Carga.problemas`, `ValidadorTreino`, `dominio/validacaoDoTreino`, `formatoDoPacote`, `dominio/cargas`, referência de percentual), fixtures regeradas; testes — executor — em andamento em `wt-editor-series` — commit: —
- [ ] 3. Editor: RIR por série na linha do %, agrupamento mantido, RPE escondido nos papéis AQUECIMENTO/PREPARACAO, forma de carga fixa, C03 e C14 — executor-front — commit: —
- [ ] 4. Aluno, meta, PDF, texto do histórico, glossário e (opcional) leitor da planilha — executor — commit: —
- [ ] 5. Ajuda (`ajuda/conteudo.ts`), guias regerados, e2e `editor-series` e `series-metodologia` com o caso novo, `AGENTS.md` só no item das séries — commit: —
- [ ] 6. Revisão do **Opus** (contrato da API e offline) antes do PR — `advisor` (Opus); se indisponível, agente `revisor` (Opus, leitura) e avisar o Gustavo. A revisão do diff pelo Sonnet não a substitui. O corpo do PR traz a linha "Revisão (Opus): feita por <advisor|revisor> — apontou: … — resolvido: …" — commit: —

## Critérios de aceite
- RIR 10 grava e volta igual no editor, no aluno e no PDF; RIR 11 é recusado na API (422) e no editor.
- Quatro séries iguais com RIR diferentes continuam um grupo.
- Série de aquecimento nova não mostra RPE; uma já gravada com RPE mostra.
- Carga fixa de 12 kg: aparece em "Para o aluno", na meta e no PDF; não conta como série de trabalho nem vira base de percentual.

## Arquivos em comum com outras frentes
- `ajuda/conteudo.ts`, `app/public/guias/*.pdf`, `AGENTS.md`. A Frente C (leva 2) usa a carga fixa: só começa depois do merge desta.

## Fora do escopo
- Libras, conversão de unidade, progressão automática, calculadora RPE/RIR.

## O que ficou para trás
- —
