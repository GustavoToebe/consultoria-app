# Redesenho de série, carga, esforço (RIR), cartão de exercício e metodologia

Situação: Pronta, sem push nem PR · Onde: branch `series-redesenho` (a partir da `origin/main`) · Atualizado: 04/11/2026

## Objetivo
O treinador prescreve cada exercício como uma lista enxuta de blocos `Séries × Repetições - Tipo/Técnica`, com % da WS e RIR lado a lado em cada série, sem submenus de modalidade, de outras formas de carga nem de esforço não prescrito. Sem compatibilidade com o formato anterior (AGENTS.md, "Sem compatibilidade com o que é antigo"): o banco é recriado do zero.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Esta especificação revoga e substitui as regras de Metodologia, Série e Editor de Séries das linhas 292–298 do `AGENTS.md` | Sim | Gustavo (04/11) |
| 2 | Fim de `porModalidade` na metodologia e de `MarcaDeOrigem` (C08) | Remover de API, app, scripts e telas | Gustavo (04/11) |
| 3 | Modos de carga: só `CARGA_TRABALHO`, `PERCENTUAL_WS`, `CARGA_FIXA`, `NENHUMA`; sem `referenciaUid` (C06) | Apagar `ACIMA_DA_ANTERIOR`, `ABAIXO_DA_REFERENCIA`, `MESMA_CARGA` | Gustavo (04/11) |
| 4 | Modos oferecidos por papel: Aquecimento e FS `% da WS` ou `Carga fixa` (Aquecimento também sem sugestão); WS `Carga de trabalho` ou `Carga fixa`; Back off `% da WS` (85%) ou `Carga fixa` | Conforme o texto | Gustavo (04/11) |
| 5 | Cartão do exercício sem Modalidade, sem "Carga do exercício" e sem "Progressão de carga"; cardio entra por `+ Adicionar cardio` | Conforme o texto | Gustavo (04/11) |
| 6 | Editor de séries em 3 faixas (tipo e técnica; estrutura; carga e RIR por série), com atalhos de 1 clique `+ FS`, `+ WS`, `+ Back off`, `+ Aquecimento`, `+ Rest pause`, `+ Cluster`, `+ Drop-set` | Conforme o texto | Gustavo (04/11) |
| 7 | Metodologia do plano só em "Configuração do plano" (sai da coluna da esquerda) | Conforme o texto | Gustavo (04/11) |
| 8 | `secaoDaReceita`: mais de um papel vai para "Receitas completas" antes de olhar a técnica (C16) | Conforme o texto | Gustavo (04/11) |
| 9 | Mantido intacto: 2 colunas, lista de exercícios, grupos e `CartaoGrupo`, `ResumoDaSessao`, abas por grupo de séries, cabeçalho do plano e chips de sessões | Sim | Gustavo (04/11) |

## Passos
- [x] 0. Documentação: `AGENTS.md` (linhas 292–298 e 407) e este plano — commit: `a5493fad` (o `AGENTS.md` foi completado com o que as telas construíram, no commit final)
- [x] 1. API: `ConfiguracaoConsultoria`, `ConteudoTreino`, `ValidadorTreino`, `SeedDemo`, `ReceitasPadrao`, `MontagemDeSeries` e testes — commit: `1b7d63db`
- [x] 2. Domínio, receitas, offline e aluno do app; scripts `demo/` e `importacao/` — commit: `6b7dcad9`
- [x] 3. Telas do treinador: `CartaoDoTipo`, `EditorModelo`, `EditorDeTreino`, `CartaoExercicio`, `EditorSeries`, `CamposDaPrescricao` — commit: `aa85f865`
- [x] 4. Testes: typecheck, lint, Jest, mvn (sem `*IntegrationTest`), scripts e a suíte Playwright inteira (869 passaram, 10 pulados, 1 falha anterior à mudança: `links-do-menu.spec.ts:20`); ajustes finais (Aquecimento binário, seed com `kg`, guias, `AGENTS.md`) — commit: o último desta branch

- [x] 5. Limpeza de `TOP_SET` — commit: `8d4abeb5`. Ajustes de usabilidade de Dieta (observação/preparo recolhidos, unidade compacta, "Adicionar refeição" no pé, sub-cartões em Suplementação e Outros, modelo de refeição avulsa enxuto) e Mobilidade (botão "Modelos", PDF, Orientações recolhidas, Nome e Prescrição lado a lado) — commit: `e3ab6443`

## Fora do escopo
- Migration de conversão de JSON antigo (o banco é recriado).
- Os trabalhos da branch `editores-revisao` (revisão visual dos três editores), que partiu de outro ponto da main.

## O que ficou para trás
- Aquecimento com % preenchido só em parte das séries: as vazias continuam erro (a API recusa `PERCENTUAL_WS` sem mínimo).
- Removidos o aviso `TOP_SET_SEM_PERCENTUAL` (`MontagemDeSeries`, `planilhaCompleta`) e `TOP_SET` de `corDaSerie`; o TS da planilha vira mais uma WS sem aviso. Sobra `TOP_SET` só como código de exemplo em fixtures de teste e o rótulo da coluna em `diagnosticoDoArquivo`.
- `referenciaCarga`/`referenciaOrigem` do registro de execução: conferir uso.
- Dia de treino (`unica`) sem metodologia visível (consequência literal do texto 3.1).
- `*IntegrationTest` e o banco recriado (`docker compose down -v`) não foram verificados: Docker desligado.
- `EscolhaSuspensa` (peça compartilhada) mudou o lado de abertura; montador não conferido.
- Branch `editores-revisao`: o Gustavo decidiu descartá-la (04/11) e seguir daqui; a remoção do worktree e da branch fica com ele.
- Dieta e Mobilidade (04/11, passo 5): o `UNIDADES` desta branch tem 3 unidades (g, ml, un), não as 7 do texto; a escolha compacta serve às 3. Dieta e mobilidade só conferidas por e2e com API simulada, não na web local nem no nativo; o claro areia e o contraste alto ficaram sem conferir. `OpcaoDeModelo` existe em 3 cópias (treino, dieta, mobilidade): levar para `plano/` num passo à parte. As Orientações da mobilidade só leem `recolhido` ao montar (não reabrem ao aplicar um modelo).
- Nativo, leitor de tela real e temas areia e contraste alto do campo de carga fixa e do Aquecimento não conferidos.
- Todas as sobras também estão em "Pendências soltas" no README.
