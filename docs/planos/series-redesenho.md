# Redesenho de série, carga, esforço (RIR), cartão de exercício e metodologia

Situação: Em andamento · Onde: branch `series-redesenho` (a partir da `origin/main`) · Atualizado: 04/11/2026

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
- [ ] 0. Documentação: `AGENTS.md` (linhas 292–298 e 407) e este plano — commit: —
- [ ] 1. API: `ConfiguracaoConsultoria`, `ConteudoTreino`, `ValidadorTreino`, `SeedDemo`, `ReceitasPadrao`, `MontagemDeSeries` e testes — commit: —
- [ ] 2. Domínio, receitas, offline e aluno do app; scripts `demo/` e `importacao/` — commit: —
- [ ] 3. Telas do treinador: `CartaoDoTipo`, `EditorModelo`, `EditorDeTreino`, `CartaoExercicio`, `EditorSeries`, `CamposDaPrescricao` — commit: —
- [ ] 4. Testes: typecheck, lint, Jest, mvn e as specs Playwright afetadas — commit: —

## Fora do escopo
- Migration de conversão de JSON antigo (o banco é recriado).
- Os trabalhos da branch `editores-revisao` (revisão visual dos três editores), que partiu de outro ponto da main.

## O que ficou para trás
- (preencher ao final; cada sobra também vai para "Pendências soltas" no README)
