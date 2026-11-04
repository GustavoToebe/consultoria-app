# Migração assistida (C69): diagnóstico do arquivo (fase 1) e amostra revisável (fase 2)

Situação: Fase 1 em produção, chave ligada em 04/11; fase 2 (API, contrato e tela da amostra) na `main` (PR #98), F6 fica para depois · Onde: `main` (fase 1, PR #79; fase 2, PR #98); acertos de 04/11 na branch `pos-lote-04-11` · Atualizado: 04/11/2026

## Objetivo
O treinador manda a planilha ou o CSV de outro sistema e o app diz, **antes de qualquer importação**, o que dá para importar e
o que não dá: tipo do arquivo, colunas reconhecidas e não reconhecidas, contagens de problemas e se cabe no limite de
alunos. Nada é gravado. A fase 2 (abaixo) acrescenta a amostra revisável: antes de confirmar, o treinador vê o que seria gravado
para alguns alunos. A gravação em rascunho e o "Desfazer importação" são os da planilha completa, que já existem.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo | Fase 1 só diagnostica; fase 2 (amostra, gravação em rascunho, "Desfazer") fica fora | Gustavo, 03/11 |
| D2 | Só regras fixas e determinísticas; o conteúdo do arquivo nunca vai para IA, serviço externo, log, auditoria nem mensagem de erro | A resposta leva só contagens, nomes de coluna conhecidos e códigos de problema; nunca valor de célula, nome de aba nem nome de aluno | Gustavo, 03/11 |
| D3 | Chave de ambiente | `TREINOS_MIGRACAO_ASSISTIDA_HABILITADA`, padrão `false`, no molde de `TREINOS_RETORNO_HABILITADO`: desligada, 503 `MIGRACAO_INDISPONIVEL`, `GET /eu` traz `migracaoAssistidaHabilitada=false`, o app esconde tudo; `application-test.yml` liga | Gustavo, 03/11 |
| D4 | Rota | `POST /importacoes/diagnostico` (multipart `arquivo`), mesmo leitor, tamanho e tipo da importação (`LeitorDePlanilha`/`LeituraDasAbas`), limite de tentativas próprio (`importacao-diagnostico`, 30 por usuário por hora, D14); não grava nada, nem registro de importação | confirmado pelo Gustavo em 04/11 |
| D5 | Permissão | A da planilha completa (`ALUNO_ALTERAR`); nenhuma permissão nova, sem migration | confirmado pelo Gustavo em 04/11 |
| D6 | Auditoria | Nenhuma: a prévia existente não audita e o diagnóstico segue o mesmo | confirmado pelo Gustavo em 04/11 |
| D7 | Tipo do arquivo | Por aba, o `ReconhecimentoDeAbas` que a planilha completa já usa; no arquivo: cadastro de alunos, planilha completa (duas ou mais famílias entre alunos, pesos, treino e dieta), treino, dieta, outro reconhecido ou desconhecido | confirmado pelo Gustavo em 04/11 |
| D8 | Nome de coluna na resposta | Só quando a célula do cabeçalho, normalizada, é **igual** a um sinônimo conhecido (`Campo.sinonimos()`); senão "Coluna X". A heurística anterior (duas ou mais colunas conhecidas) deixava vazar a primeira linha de dados de um arquivo sem cabeçalho | confirmado pelo Gustavo em 04/11 |
| D9 | Limite de alunos | Teto, não confere quais já existem: alunos ativos com nome da primeira aba de alunos mais os nascidos de blocos de treino, dieta, pesos e suplementos (como a montagem da importação), contra as vagas do plano e as do importador (`ACIMA_DO_LIMITE_DO_PLANO`, `ACIMA_DO_LIMITE_DO_TREINADOR`, quantidade = excesso) | confirmado pelo Gustavo em 04/11 |
| D10 | Onde fica a regra | `importacao/completa/DiagnosticoDoArquivo` (regra pura sobre as abas já lidas, sem banco), para reaproveitar o que é interno ao pacote (formato do conteúdo, e-mail, data) | confirmado pelo Gustavo em 04/11 |
| D11 | App | Botão "Conferir o arquivo antes de importar" só na **planilha completa**, só com a chave ligada no `GET /eu` e com `ALUNO_ALTERAR`; texto simples, sem redesenhar a tela. A importação de uma aba fica sem o botão (colunas e responsável próprios, que a conferência não conhece): fora do escopo desta fase. O resultado é anunciado (região viva) e recebe o foco; o erro e o resultado somem ao trocar o arquivo | confirmado pelo Gustavo em 04/11 |
| D12 | Nome de aba | Nunca devolvido: "Aba N" e o tipo reconhecido, porque nos formatos de um aluno por aba o nome da aba é o nome do aluno | confirmado pelo Gustavo em 04/11 |
| D13 | Veredito | Sucesso só quando algo é importável; arquivo "outro" (tabela de alimentos) ou só com aba sem uso = "nada para importar" (`NADA_PARA_IMPORTAR`); mais de uma aba de alunos avisa que só a primeira é lida (`VARIAS_ABAS_DE_ALUNOS`); e-mail inválido ou repetido só conta em aba de alunos | confirmado pelo Gustavo em 04/11 |
| D14 | Limite de tentativas | O diagnóstico tem balde próprio (`LimiteTentativas.diagnosticoDeImportacao`, `importacao-diagnostico`, 30 por usuário por hora): repetir a conferência não gasta a prévia nem a confirmação | confirmado pelo Gustavo em 04/11 |

### Decisões da fase 2 (Claude, 04/11, para o Gustavo conferir)
| # | Decisão | Valor |
| --- | --- | --- |
| F1 | O que é a fase 2 | Só a **amostra revisável**, de leitura. A gravação em rascunho (`.../confirmar`) e o "Desfazer importação" (`POST /importacoes/{id}/desfazer`, botão no histórico) já são da planilha completa e continuam como estão, sem a chave; nada novo grava. Nada é publicado: tudo é rascunho na pasta "Importada da planilha (rascunho)" |
| F2 | Rota | `POST /importacoes/planilha-completa/amostra` (multipart `arquivo` + `respostas` opcional + `?inicio=`, 0 por padrão), `AmostraDaPlanilhaController` com `@ExigeMigracaoAssistida` (chave desligada = 503 `MIGRACAO_INDISPONIVEL`), `ALUNO_ALTERAR`, balde de tentativas da prévia (`importacao-previa`, 30 por hora; a amostra é uma montagem inteira, igual à prévia). Sem migration, sem estado novo, sem registro de importação, sem auditoria |
| F3 | Conteúdo | Reaproveita a `MontagemDaImportacao` da prévia e da confirmação, então mostra **exatamente o que a confirmação gravaria**, e o que o perfil não pode gravar (pesos e objetivo sem dado sensível, treino, dieta, ergogênicos) já vem de fora. Por aluno: posição no arquivo, `NOVO`/`EXISTENTE`, cadastro (nome, ativo, e-mail, telefone, objetivo, observações; nulos no existente), total de pesos e os 10 últimos (data e kg, sem observação), e os `ConteudoTreino`/`ConteudoDieta` do resto da API (a tela pode usar os componentes de leitura que já existem). Até 5 alunos por chamada, na ordem do arquivo (cadastros novos, depois quem só tem plano); `total` e `inicio` deixam paginar |
| F4 | LGPD | Esta fase devolve conteúdo do arquivo ao próprio treinador que o enviou, como a amostra do assistente de uma aba (`/colunas`) e o nome do aluno na análise; a regra D2/D12 da fase 1 vale só para o diagnóstico. Só na resposta: não guarda o arquivo, não grava, não audita, não loga; os records escondem o conteúdo no `toString`. A regra de quem pode ver o quê é a de gravar (cada permissão de alterar já depende da de ler) |
| F5 | Ligação com a confirmação | A amostra devolve o mesmo `hash` da prévia (arquivo + respostas): a confirmação que já existe o aceita, então o que foi revisado é o que será gravado |
| F6 | Fora desta fase | Tirar um aluno ou uma aba da gravação depois de ver a amostra (é regra de negócio nova: precisaria de filtro na confirmação, no hash e no desfazer). **Fica para depois (Gustavo, 04/11):** hoje dá para ignorar a aba na etapa Abas |

## Passos
- [x] 1. Plano e índice — commit: neste arquivo
- [x] 2. API: chave, regra pura `DiagnosticoDoArquivo`, rota, `GET /eu`, testes (unidade, integração, sentinela) — commit: `00f3f8ec`
- [x] 3. App: regras de texto em `dominio/`, botão e resultado na tela de importação, jest e e2e — commit: `df592876`
- [x] 4. Documentação (`AGENTS.md`, `docs/importacao-alunos.md`) — commit: `96a07298`
- [x] 5. Correções da revisão independente (vazamento por nome de coluna e de aba, limite com blocos, e-mail só em alunos, veredito, limite de tentativas próprio, botão só na planilha completa, acessibilidade) — commit: `08187482`; docs: o seguinte

- [x] 6. Fase 2, API: amostra revisável (`AmostraDaPlanilha`, `AmostraDaPlanilhaController`, `GravacaoDaPlanilha.amostra`), testes (unidade, integração, chave desligada) — commit: ver relatório da frente E
- [x] 7. Fase 2, app: tipo e chamada (`AmostraDaPlanilha`, `amostraDaPlanilhaCompleta`) — mesmo commit do app
- [x] 8. Fase 2, tela da amostra: etapa "Amostra" entre a prévia e a confirmação do `AssistenteDaPlanilha` (só com `migracaoAssistidaHabilitada`; 6 etapas com ela, as 5 de antes sem), `EtapaDaAmostra.tsx` (hook `useAmostraDaPlanilha`, páginas só na memória, "Ver os próximos N" por `inicio`, "Ver os anteriores" sem pedir de novo, foco na faixa "Alunos N a M de T"), textos em `dominio/amostraDaPlanilha.ts`; cadastro, pesos, treino e dieta por aluno, ausente "—", parte pulada pelo perfil "Fica de fora pelo seu perfil.", exercício sem `exercicioId` com o selo "Sem par na biblioteca" (era "Novo na biblioteca" até o `pos-lote-04-11`), "Ver o treino/a dieta como o aluno" pela `FolhaVerComoAluno`; a confirmação leva o hash da amostra (o da prévia se ela falhou); 503 `MIGRACAO_INDISPONIVEL` volta à prévia com aviso e some a etapa; arquivo, respostas ou prévia novos limpam a amostra; e2e `e2e/migracao-assistida-amostra.spec.ts` (390 e 1440, claro, escuro, areia e contraste alto) — commit: ver relatório da frente E

## Fora do escopo
- Tirar aluno ou aba da gravação depois de ver a amostra (F6).
- Comparar com os alunos que já existem (nome ou e-mail repetido contra o banco) e nomes de aluno repetidos dentro do arquivo.
- Botão na importação de uma aba (precisaria usar as colunas e o responsável mapeados naquela tela).
- Qualquer IA, serviço externo ou leitura de .xls (continua pedindo .xlsx ou .csv).

## O que ficou para trás
- ~~"Novo na biblioteca" na amostra é aproximado~~ (a API manda `exercicioId` nulo também para o nome mantido como na planilha (MANTER) e para o provável sem resposta): o selo passou a dizer "Sem par na biblioteca", que é o que o `exercicioId` nulo sustenta (Gustavo, 04/11; `pos-lote-04-11`). Dizer se vai ser criado ou mantido exigiria a API mandar a origem do exercício; não foi pedido.
- A amostra gasta o balde de tentativas da prévia (30 por hora): cada página é uma montagem inteira. Uma planilha de muitos alunos folheada até o fim pode esbarrar no limite.
- F6 (revisão que tira aluno ou aba da gravação): fica para depois (Gustavo, 04/11); hoje dá para ignorar a aba na etapa Abas.
- Cota da amostra (revisão da nuvem, 04/11): só a primeira página (`inicio` 0) conta no limite de 30 prévias por hora; folhear a amostra não esgota mais a cota que `analisar` e a prévia também usam. Feito no PR #98.
- ~~Aluno que já existe e só recebe pesos (aba de pesos, sem treino nem dieta) não aparece na amostra nem no `total`, mas a confirmação grava os pesos dele.~~ Feito no `pos-lote-04-11`: `AmostraDaPlanilha.de` recebe os alunos que a consultoria já tem (`contexto.alunos()`) e põe esses donos por último na ordem (novos, planos, só pesos), como `EXISTENTE` sem treino nem dieta, com o nome do cadastro e contados no `total`; a montagem, o hash e o DTO não mudaram (só o mapa dos pesos iniciais virou `LinkedHashMap`, para a ordem ser a da planilha). O texto do cartão passou a dizer "só ganha os pesos abaixo, sem pasta nem plano" quando não há treino nem dieta. Testes: `AmostraDaPlanilhaTest`, `AmostraDaPlanilhaIntegrationTest` (a confirmação grava os mesmos 2 pesos), `amostraDaPlanilha.test.ts`.
- O aluno que já existe **com** plano continua mostrando o nome da planilha (`plano.nome()`), e o só-pesos o do cadastro; se o e-mail casar com um nome diferente, os dois ramos mostram origens diferentes. Unificar é uma linha, mas muda o que já está na tela. Gustavo decide.
- Aluno existente cujos pesos já estavam todos registrados na mesma data não aparece na amostra: a montagem os conta como "já registrados", igual à confirmação.
- A amostra e a prévia valem para o banco do momento: um aluno criado por outra pessoa entre a revisão e a confirmação pode virar `EXISTENTE` na gravação. Já era assim na prévia; vale citar no texto da etapa se aparecer na prática.
