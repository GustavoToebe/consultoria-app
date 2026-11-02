# Visual da reunião de 30/10: cor por tipo de série, dieta, histórico e receitas (prévia primeiro)

Situação: Prévia aprovada em 02/11/2026; o código (passos 3 a 6) começa depois do merge da Frente C · Onde: prévia HTML em `docs/prototipos/`, **código do app só depois do merge da Frente C** · Atualizado: 02/11/2026 · Registro: reunião de 30/10, C35, C50, C74, C45, C16 · Frente G da leva 2

## Objetivo
O treinador pediu cor em vários momentos (tipo de série na execução do aluno, "uma bagunça", 58:00; Cluster como bloco
único; histórico por divisão; dieta e unidades em destaque). O Histórico do aluno confunde o período de cada visão
(1:15 a 1:18) e as receitas precisam de agrupamento por bloco e técnica.

## O que o código faz hoje (main 19b1fd6)
- A execução tem selo de texto por tipo (`aluno/serieDoAluno.ts:20`), sem cor por tipo.
- A cor do aluno vem da marca; o aluno escolhe claro ou escuro (e o tema areia).
- O Histórico do aluno tem três visões (por divisão, por dia, geral) sem rótulo do período; a aba "Por dia" é uma lista corrida.

## Decisões (Gustavo, 02/11/2026; não perguntar de novo)
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Ordem | **primeiro uma prévia HTML**, em 390 e 1280 px, nos temas claro, areia e escuro, com contraste conferido; código **só depois do ok do Gustavo** | Gustavo |
| D2 | C35 | cor por tipo de série na execução do aluno e o Cluster como um bloco só | Gustavo |
| D3 | C50/C74 | mais cor na dieta, nas unidades e nos cabeçalhos do histórico por divisão | Gustavo |
| D4 | C45 | reorganizar o Histórico do aluno: as três visões confundem o período; a aba "Por dia" está bagunçada | Gustavo |
| D5 | C16 | receitas agrupadas por bloco e técnica no "Usar receita" (ver [receitas-em-blocos.md](receitas-em-blocos.md)) | Gustavo |
| D6 | Cor de identificação × status | a cor de tipo de série **não pode se confundir** com verde, âmbar e vermelho (status); seguir o design-system | Gustavo |
| D7 | A cor nunca é a única informação | o selo de texto fica | regra de acessibilidade |
| D8 | Dados da prévia | a prévia em `docs/prototipos/` usa **só dados fictícios**; nenhum print nem texto da produção (a conta real do Saraiva não entra no repositório) | Gustavo |
| D9 | Cor por papel | WS e Top set têm a mesma cor (as cores são por papel: aquecimento, preparação, trabalho, pós-trabalho); o tipo "Outro" fica sem cor, com marcador vazado | Gustavo (prévia, 02/11/2026) |
| D10 | Histórico: "Geral" | **não juntar**: o Progresso por exercício continua cartão separado, igual ao da ficha; as abas do Histórico (Por divisão, Por dia, Geral) só passam a dizer o período que mostram | Gustavo |
| D11 | Receita completa | do aquecimento ou da preparação até a série de trabalho, com o Back off quando houver | Gustavo |
| D12 | Receita com duas técnicas | aparece nos dois grupos (sem o grupo "Várias técnicas") | Gustavo |
| D13 | Legenda | curta e recolhida ("O que significa cada cor") no topo da execução do aluno e em "Usar receita" | Gustavo |
| D14 | Divisões × tipos | se alguma tela mostra divisões coloridas e séries coloridas juntas, as divisões começam pelas cores que os tipos não usam (terra, oliva, índigo…); se não mostram juntas, fica como está | Gustavo |
| D15 | Resumo semanal do "Por dia" | só contagens, sem volume | Gustavo |
| D16 | Ardósia × cinza neutro (ΔE abaixo de 25) | aceito como informativo | Gustavo |
| D17 | Ordem | o código da Frente G (passos 3 a 6) vem depois do merge da Frente C; a prévia entra no mesmo PR da G | Gustavo |

## Passos
- [x] 1. Prévia HTML (390 e 1280 px; claro, areia, escuro; razões de contraste anotadas) de C35, C50/C74, C45 e C16 — executor-front — feito em 02/11/2026 em `docs/prototipos/cores-e-historico.html` (arquivo único, dados fictícios, 186 pares de contraste conferidos; menor texto 4,69:1, menor não textual 3,52:1) — commit: ver o commit da prévia na branch `cores-por-tipo-previa`
- [x] 2. Gustavo aprova ou pede ajuste na prévia — Gustavo — aprovada em 02/11/2026, com as respostas D9 a D16 abaixo — commit: —
- [ ] 3. (só depois do merge da Frente C: as duas mexem na execução do aluno) Tokens por tipo e por divisão em `tema/tokens.ts` com teste de contraste (`tokens.test.ts`) — executor-front — commit: —
- [ ] 4. Execução do aluno: cor por tipo; Cluster/Rest-pause como bloco único — executor-front — commit: —
- [ ] 5. Dieta do aluno e histórico por divisão com cor; reorganização do Histórico (C45); e2e em 390 e 1280 px — executor-front — commit: —
- [ ] 6. Janela "Usar receita" agrupada (C16) — executor-front — commit: —

## Critérios de aceite
- Nenhuma cor de tipo de série tem a mesma aparência de um status; contraste AA nos três temas.
- Cada visão do Histórico diz o período que mostra.

## Fora do escopo
- Trocar a cor da marca. Código antes do ok da prévia. Print ou dado da produção na prévia.

## O que ficou para trás
- —
- Dúvidas da prévia (respondidas em 02/11/2026, ver D9 a D16): (1) WS e Top set com a mesma cor (as quatro cores são por papel: aquecimento, preparação, trabalho, pós-trabalho); (2) "Outro" sem cor, com marcador vazado; (3) "Geral" do Histórico = Progresso por exercício, como 3ª aba do mesmo cartão; (4) o que é "receita completa" (usado: da preparação ou do aquecimento até a série de trabalho); (5) receita com duas técnicas num grupo "Várias técnicas" ou repetida nos dois; (6) legenda de cores no topo da lista de séries e em "Usar receita"; (7) azul das divisões/refeições parecido com o da Preparação, em telas e formas diferentes; (8) resumo semanal do "Por dia" só com contagens (somar volume seria cálculo novo).
- Uma distância de cor abaixo do piso 25 (ΔE): a ardósia das divisões e refeições contra o cinza neutro (11,6 claro, 9,7 escuro); ficou como informativo (8ª da ordem, nunca ao lado de selo).
