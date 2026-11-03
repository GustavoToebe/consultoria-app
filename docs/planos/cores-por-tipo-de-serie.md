# Visual da reunião de 30/10: cor por tipo de série, dieta, histórico e receitas (prévia primeiro)

Situação: Prévia aprovada (03/11); tokens prontos (passo 3); falta a execução, a dieta, o histórico e as receitas · Onde: prévia HTML em `docs/prototipos/cores-por-tipo-de-serie.html`; código no app · Atualizado: 03/11/2026 · Registro: reunião de 30/10, C35, C50, C74, C45, C16 · Frente G da leva 2

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
| D9 | Cor por tipo × por papel (prévia, escolha 1) | **por tipo**: Aquecimento ciano, FS azul, WS índigo, Top set violeta, Back off magenta; tipo criado pelo treinador usa a cor do papel; papel "Outro" sem cor | Gustavo, 03/11 |
| D10 | Como a cor aparece na série (escolha 2) | **barra lateral de 6 px + selo colorido**; o cartão continua branco | Gustavo, 03/11 |
| D11 | Paleta (escolha 3) | ciano, azul, índigo, violeta e magenta da prévia, ≥ 4,5:1 nos três temas; sem verde, âmbar, vermelho nem cinza | Gustavo, 03/11 |
| D12 | Cluster e Rest-pause (escolha 4) | **um cartão por série** com os blocos/retomadas dentro, a pausa entre eles, "Feito até agora: X de Y reps" e "Concluir série" no rodapé; o bloco da vez marcado com "agora" | Gustavo, 03/11 |
| D13 | Divisões A, B, C (escolha 5) | **com cor** (A azul, B magenta, C ciano) na letra, na barra e no cabeçalho, só no Histórico; lá as séries ficam em texto | Gustavo, 03/11 |
| D14 | Dieta (escolha 6) | quantidade e unidade numa **etiqueta grande à direita com a cor da refeição** e barra na refeição | Gustavo, 03/11 |
| D15 | Histórico (escolha 7, C45) | cada cartão diz o período na faixa; "Registros e cargas" com a escolha do período (pasta atual, anterior, últimos 30 dias) e uma frase do que mostra; "Por dia" vira semana → dia (cabeçalho da semana com os 7 dias marcados, um cartão por dia treinado com a data à esquerda e a divisão no cabeçalho) | Gustavo, 03/11 |
| D16 | "Usar receita" (escolha 8, C16) | busca no topo; seções recolhíveis: receitas completas, depois Aquecimento, Preparação, Trabalho, Pós-trabalho e uma por técnica (Cluster, Rest pause, Drop-set); cada receita uma vez, com a sequência colorida por tipo | Gustavo, 03/11 |
| D17 | Peso nas séries com etapas (pendência da Frente C) | o peso da etapa nasce vazio com "Sugestão: X kg"; o painel "Fez com X kg?" aparece **uma vez por série**, no primeiro ✓ de etapa com o peso vazio; o peso confirmado preenche as etapas vazias daquela série; nunca grava peso sem confirmação. Entra no passo 4 | Gustavo, 03/11 |
| D8 | Dados da prévia | a prévia em `docs/prototipos/` usa **só dados fictícios**; nenhum print nem texto da produção (a conta real do Saraiva não entra no repositório) | Gustavo |

## Passos
- [x] 1. Prévia HTML (390 e 1280 px; claro, areia, escuro; razões de contraste anotadas) de C35, C50/C74, C45 e C16 — executor-front — commit: 168e8467
- [x] 2. Gustavo aprova ou pede ajuste na prévia — Gustavo — aprovada como proposta em 03/11 (D9 a D17)
- [x] 3. Tokens por tipo e por divisão em `tema/tokens.ts` com teste de contraste (`tokens.test.ts`) — executor-front — commit: 5f529724 (`PALETA_DE_IDENTIFICACAO`, `coresDeIdentificacao`, `useTema().identificacao`; chave por `dominio/corDaSerie`: `corDoTipoDeSerie`, `corDaDivisao`, `corDaRefeicao`)
- [x] 4. Execução do aluno: cor por tipo; Cluster/Rest-pause como bloco único; peso das etapas pela D17 — executor-front — commit: `8beab13e`
- [x] 5. Dieta do aluno e histórico por divisão com cor; reorganização do Histórico (C45); e2e em 390 e 1280 px — executor-front — commit: `06e9d308`
- [x] 6. Janela "Usar receita" agrupada (C16) — executor-front — commit: `b802112a`

## Critérios de aceite
- Nenhuma cor de tipo de série tem a mesma aparência de um status; contraste AA nos três temas.
- Cada visão do Histórico diz o período que mostra.

## Fora do escopo
- Trocar a cor da marca. Código antes do ok da prévia. Print ou dado da produção na prévia.

## Prévia (passo 1, 03/11)
`docs/prototipos/cores-por-tipo-de-serie.html` (autocontido, dados fictícios). No topo, o bloco "O que decidir" com as 8
escolhas para o passo 2; embaixo, a tabela de contraste calculada na própria página (fórmulas de `tokens.ts` e do teste da
paleta das agendas). Paleta proposta (claro e areia / escuro): Ciano `#00698A`/`#3CC3D6` (Aquecimento), Azul
`#1A5CBA`/`#62A0F8` (FS), Índigo `#4B3FBF`/`#A196F5` (WS), Violeta `#8A2DB0`/`#CF8DEE` (Top set, só na opção "por tipo"),
Magenta `#A3237F`/`#F07AC8` (Back off). Mínimos: texto 5,02 (claro), 4,84 (areia), 5,23 (escuro); barra 4,54 / 4,29 /
4,65; ΔE do status ≥ 45; ΔE do cinza ≥ 26. Ardósia, terra e oliva ficaram de fora (cinza, âmbar, verde).

## O que ficou para trás
- —
