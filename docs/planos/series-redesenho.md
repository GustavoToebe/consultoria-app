# Redesenho de série, carga, esforço (RIR), cartão de exercício e metodologia

Situação: Pronta, PR aberto sem mesclar (deploy e dados da PRD dependem do Gustavo, ver "Dados da PRD no formato antigo") · Onde: branch `series-redesenho` (a partir da `origin/main`) · Atualizado: 05/11/2026

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
- [x] 6. Ajustes pedidos pelo Gustavo em 05/11: caixas "mín"/"máx"/"reps" proporcionais ao sufixo (o número saía cortado) — commit: `55550f65`; editor de treino, dieta e mobilidade em duas colunas usam `LARGURA_MAXIMA` (1800, como as listas) e o descanso passa de 112 para 90 px para a linha Séries × Repetições × Descanso seguir numa linha só em 1280 e 1440 — commit: `ca79df6a`. Verificado: typecheck, lint, Jest e e2e dos editores (101 sem falha).
- [x] 7. Produção (SARAIVA TEAM, 05/11, pelo banco, sem deploy): apagadas as receitas de treino, de séries e de metodologia (29), a anamnese antiga, as 2 inscrições e o questionário de Inscrição antigo; gravados "Inscrição Saraiva Team" (padrão, 15 perguntas, texto do link e campos Sexo/Objetivo/Interesse/Modalidade escondidos) e "Anamnese Saraiva Team" (57 perguntas, 22 imagens reaproveitadas). Conteúdo dos scripts `scripts/questionario/*-saraiva.mjs` validado pela API local e copiado por SQL.
- [ ] 8. Depois do merge e do deploy: carregar as Receitas de séries na PRD (JSON das 16 receitas, no formato novo) e repor metodologias, semanas e dias de treino do SARAIVA TEAM (apagados em 05/11, sem script que os reponha).

## Dados da PRD no formato antigo de carga (contagem de 05/11, só leitura)
Os textos `MESMA_CARGA`, `ACIMA_DA_ANTERIOR` e `ABAIXO_DA_REFERENCIA` (e `referenciaUid`) saíram do contrato e **não há migration**. No banco de produção, antes do merge, aparecem em: SARAIVA TEAM, 15 rascunhos e 3 versões publicadas de planos de treino (0 receitas); Toebe, 3 rascunhos de plano e 6 de 22 receitas (2 com `referenciaUid` preenchido). Nos planos o texto vem do snapshot da metodologia que cada plano carrega. Efeito esperado: o plano segue legível, mas a validação do código novo recusa o modo removido ao salvar/publicar de novo. **Decisão do Gustavo (05/11): reset total do banco da produção**, feito junto do deploy (nunca antes, com a API antiga no ar) e depois do merge. Apaga as duas consultorias (SARAIVA TEAM: 87 alunos, 4 usuários, 15 planos de treino, 4 de dieta, 27 execuções; Toebe: 2 alunos, 3 usuários), o que foi gravado em 05/11 (Inscrição e Anamnese do Saraiva, link e código da inscrição) e as imagens. Ordem no deploy: backup do banco, `docker compose down -v` do banco, subir a API nova (Flyway e seed padrão), recriar as consultorias e convites pela Central, rodar de novo os scripts `scripts/questionario/*-saraiva.mjs`, carregar as Receitas de séries (passo 8).

## Fora do escopo
- Migration de conversão de JSON antigo (o banco é recriado).
- Os trabalhos da branch `editores-revisao` (revisão visual dos três editores), que partiu de outro ponto da main.

## O que ficou para trás
- Aquecimento com % só em parte das séries: resolvido em 05/11 (cada série decide por si, `NENHUMA` sem erro, o grupo continua uma aba; `chave` do agrupamento não separa `NENHUMA` de `PERCENTUAL_WS` e separa RPE de RIR).
- Removidos o aviso `TOP_SET_SEM_PERCENTUAL` (`MontagemDeSeries`, `planilhaCompleta`) e `TOP_SET` de `corDaSerie`; o TS da planilha vira mais uma WS com o aviso `TS_COMO_WS` (API e script, "Top set virou uma série WS"). Sobra `TOP_SET` só como código de exemplo em fixtures de teste e o rótulo da coluna em `diagnosticoDoArquivo`.
- `referenciaCarga`/`referenciaOrigem` do registro de execução: conferir uso.
- Dia de treino (`unica`) sem metodologia visível (consequência literal do texto 3.1).
- `*IntegrationTest`: `mvn -o verify` completo passou em 04/11 (2128 testes, 0 falhas, Testcontainers); o banco recriado (`docker compose down -v`) foi conferido no stack local da 8089 (seed sem erro, planos validam).
- `EscolhaSuspensa` (peça compartilhada) mudou o lado de abertura; montador não conferido.
- Branch `editores-revisao`: o Gustavo decidiu descartá-la (04/11) e seguir daqui; a remoção do worktree e da branch fica com ele.
- Dieta e Mobilidade (04/11, passo 5): o `UNIDADES` desta branch tem 3 unidades (g, ml, un), não as 7 do texto; a escolha compacta serve às 3. Dieta e mobilidade só conferidas por e2e com API simulada, não na web local nem no nativo; o claro areia e o contraste alto ficaram sem conferir. `OpcaoDeModelo` existe em 3 cópias (treino, dieta, mobilidade): levar para `plano/` num passo à parte. As Orientações da mobilidade só leem `recolhido` ao montar (não reabrem ao aplicar um modelo).
- Nativo, leitor de tela real e temas areia e contraste alto do campo de carga fixa e do Aquecimento não conferidos.
- Todas as sobras também estão em "Pendências soltas" no README.
