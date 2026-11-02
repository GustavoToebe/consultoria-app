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
| D4 | C10 carga fixa | forma nova `CARGA_FIXA` com valor em kg; só em exercício com carga (fora cardio e exercício sem carga). A API **aceita** a forma em série de **qualquer papel, inclusive TRABALHO**, e o editor **não a esconde**: o caso típico é a WS 3x12 com 12 kg. Nas séries de trabalho ela fica em "Outras formas de carga", para o padrão continuar `CARGA_TRABALHO`. Ela **não** é `deTrabalho` (segue só `CARGA_TRABALHO`) e não serve de referência para percentual: um Back off em % depois de uma WS com carga fixa cai no aviso que já existe (percentual sem série de trabalho antes) | Gustavo (revisada em 02/11/2026) |
| D5 | Onde a carga fixa aparece | editor, "Para o aluno", meta do aluno, PDF e texto do histórico | Gustavo |
| D6 | Leitor da planilha completa | **fora**: o "12 kg" da planilha segue na observação (quebraria MESMA_CARGA e percentuais da WS importada) | Gustavo (02/11/2026) |
| D7 | Libras | fora | Gustavo |
| D8 | C03 | trocar o "% da WS" das etapas de Cluster/Rest-pause pelo mesmo texto da série | Gustavo |
| D9 | C14 | "Execução (opcional)" vira "Cadência e isometria (opcional)" | Gustavo |
| D10 | Plano antigo | sem compatibilidade com o legado (regra do AGENTS.md até o primeiro cliente): prescrição antiga não é migrada | regra do projeto |

## Passos
Andamento em 02/11/2026 (tudo na worktree `wt-editor-series`, branch `editor-de-series-reuniao`, a partir da main `210d828c`):
- Passo 1 feito: o explorador mapeou RIR/`Esforco` (0–5 em `ConteudoTreino`, `validacaoDeSerie.ts`, `opcoesDoEditor.ts`), `carga.modo`/`deTrabalho`, agrupamento (`agrupamento.ts`: a chave inclui rir e rpe, é o que precisa mudar) e os testes que fixam 0..5.
- Passo 2 feito (commit 8a00dd86; testes da API e do app verdes; `mvn verify` completo ainda por rodar): RIR 0–10, `CARGA_FIXA`/`valorKg`, agrupamento só pela forma do esforço, textos C03 e C14. Ficou de fora: D6 (leitor da planilha reconhecer "12 kg"): quebraria MESMA_CARGA e percentuais da série WS importada; o kg segue na observação. Decisões de 02/11/2026: a API aceita `CARGA_FIXA` em série de TRABALHO e o editor não a esconde (D4); app antigo com pacote que tem `CARGA_FIXA`: aceito, sem compatibilidade até o primeiro cliente, mas a revisão do Opus precisa confirmar o comportamento real (laço de descarte e download, ou tela em branco?) e eu aviso o Gustavo antes do PR; conferir também se `IndiceVersao` (progresso e recordes) trata a série com carga fixa de TRABALHO sem inventar carga.
- Passos 2 a 4 feitos nos commits 8a00dd86 e 3f3b2374 (editor, aluno, meta, PDF e glossário). Passo 5: Ajuda feita em 02/11/2026 (sem commit ainda); guias PDF, e2e e `AGENTS.md` por fazer.
- App antigo com pacote que tem `CARGA_FIXA` (conferido em 02/11/2026 no código de `origin/main`: `formatoDoPacote.ts` aceita só 6 modos e 4 chaves em `carga`): **sem laço, mas tela sem plano e sem erro**. Ao abrir, o app baixa o pacote (`AlunoProvider.tsx:478-494`), grava sem validar e relê (`lerPacote`); o pacote inteiro é recusado e apagado (`repositorioLocal.ts:364-371`), levando o treino, inclusive o que já estava salvo e funcionando (só a chave `pacote` é apagada; a dieta continua aparecendo, mas o PDF da dieta e o do histórico deixam de funcionar sem aviso). Não há mensagem; repete a cada abertura e a cada sincronização com envio. Sem internet, o aluno vê "Conecte-se uma vez para baixar o treino". Só atinge o aluno cujo plano tem série com carga fixa (`valorKg` só sai no JSON nessa forma). Aceito pelo Gustavo (sem compatibilidade até o primeiro cliente); por isso o passo 5b (APK novo).
- Riscos a olhar na revisão: pacote offline com app antigo (RIR 10, `CARGA_FIXA`), limite de RIR no leitor da planilha (não localizado), RPE escondido só na UI (a API não muda).

- [x] 1. Mapear todos os usos de RIR/`Esforco`, de `carga.modo` e de `deTrabalho` (explorador) — explorador — feito em 02/11/2026 (sem commit; só leitura)
- [x] 2. API e domínio: RIR 0–10, `CARGA_FIXA` (`ConteudoTreino`/`Carga.problemas`, `ValidadorTreino`, `dominio/validacaoDoTreino`, `formatoDoPacote`, `dominio/cargas`, referência de percentual), fixtures regeradas; testes — executor — feito em `wt-editor-series` — commit: 8a00dd86
- [x] 3. Editor: RIR por série na linha do %, agrupamento mantido, RPE escondido nos papéis AQUECIMENTO/PREPARACAO, forma de carga fixa (C03 e C14 já no commit 8a00dd86) — executor-front — feito em `wt-editor-series` — commit: 3f3b2374
- [x] 4. Aluno, meta, PDF, texto do histórico, glossário e (opcional) leitor da planilha — executor — commit: 3f3b2374 (conferido no código em 02/11/2026: `serieDoAluno.dicaDaCarga`, `cargas` (sugestão), `resumoDaSerie` (meta), `agrupamento` e `pdfTreino` (kg), aviso "Carga: atualize o app para ver" e `AlunoProvider`; o histórico mostra só o nome do tipo da série, sem texto de carga prescrita, então nada a mudar; o glossário do PDF explica "RIR 0 = até a falha" e não cita faixa; leitor da planilha ficou fora, ver D6)
- [x] 5. Ajuda (`ajuda/conteudo.ts`), guias regerados, e2e `editor-series` e `series-metodologia` com o caso novo (inclui WS 3x12 com 12 kg e Back off em % depois dela mostrando o aviso, e o RPE escondido também no padrão da metodologia), `AGENTS.md` só no item das séries — feito em 02/11/2026: typecheck, lint e jest (221 suítes, 3466 testes) verdes, e2e dos dois specs 46/46, `mvn verify` com 1898 testes e, depois da correção, só `PlanejamentoIntegrationTest` reexecutado, 13/13 (a única falha era `PlanejamentoIntegrationTest`, que usava RIR 9 como inválido; passou a usar 11) — commit: ec1f9f04 (Ajuda, AGENTS.md, e2e) 5c65895f (correção do teste e guias PDF)
- [ ] 5b. **Passos do Gustavo:** (1) gerar APK novo antes de usar carga fixa com aluno no celular (o app instalado antigo não conhece a forma); (2) conferir num app antigo de verdade, com um plano que tenha carga fixa, o que o aluno vê (esperado: pacote recusado e tela sem plano, como descrito no andamento) e, no app novo, a tela "Carga: atualize o app para ver" com um modo inventado — Gustavo — pendente
- [x] 6. Revisão do **Opus** (contrato da API e offline) antes do PR — agente `revisor` (Opus, leitura; o `advisor` só enxerga a conversa e não lê os diffs) — feito em 02/11/2026. Apontou: (1) cardio aceitava `carga.valorKg` (a API recusa agora, `ValidadorTreino.cardio()` e `validacaoDeSerie.ts`, com teste); (2) linha 37 do plano descrevia o app antigo de forma imprecisa (corrigida). Nada bloqueia. Confirmou: só `CARGA_FIXA` derruba o pacote antigo (RIR 6–10 não), sem laço — commit: 6f6fb25b

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
- D6 (leitor da planilha reconhecer "12 kg") fica fora por decisão do Gustavo: o kg segue na observação.
- Trocar o tipo do grupo reaplica o esforço do tipo e perde os RIR por série (comportamento de antes).
- O botão "Diminuir" do RIR no 0 fica desabilitado sem motivo escrito (`IconeBotao` não aceita `motivo`).
- Em 390 px o RIR fica logo abaixo do % da série, não ao lado.
- "Repetir" (`mesmaPrescricao`) deixa de aparecer entre séries do mesmo grupo com RIR diferentes.
