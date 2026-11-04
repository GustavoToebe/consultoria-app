# Migração assistida (C69), fase 1: diagnóstico do arquivo

Situação: Em andamento (fase 1) · Onde: branch `migracao-assistida-fase-1` (um PR) · Atualizado: 03/11/2026

## Objetivo
O treinador manda a planilha ou o CSV de outro sistema e o app diz, **antes de qualquer importação**, o que dá para importar e
o que não dá: tipo do arquivo, colunas reconhecidas e não reconhecidas, contagens de problemas e se cabe no limite de
alunos. Nada é gravado. A amostra revisável e a gravação em rascunho com "Desfazer importação" são a fase 2 (outro PR).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo | Fase 1 só diagnostica; fase 2 (amostra, gravação em rascunho, "Desfazer") fica fora | Gustavo, 03/11 |
| D2 | Só regras fixas e determinísticas; o conteúdo do arquivo nunca vai para IA, serviço externo, log, auditoria nem mensagem de erro | A resposta leva só contagens, nomes de coluna conhecidos e códigos de problema; nunca valor de célula, nome de aba nem nome de aluno | Gustavo, 03/11 |
| D3 | Chave de ambiente | `TREINOS_MIGRACAO_ASSISTIDA_HABILITADA`, padrão `false`, no molde de `TREINOS_RETORNO_HABILITADO`: desligada, 503 `MIGRACAO_INDISPONIVEL`, `GET /eu` traz `migracaoAssistidaHabilitada=false`, o app esconde tudo; `application-test.yml` liga | Gustavo, 03/11 |
| D4 | Rota | `POST /importacoes/diagnostico` (multipart `arquivo`), mesmo leitor, tamanho e tipo da importação (`LeitorDePlanilha`/`LeituraDasAbas`), limite de tentativas próprio (`importacao-diagnostico`, 30 por usuário por hora, D14); não grava nada, nem registro de importação | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D5 | Permissão | A da planilha completa (`ALUNO_ALTERAR`); nenhuma permissão nova, sem migration | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D6 | Auditoria | Nenhuma: a prévia existente não audita e o diagnóstico segue o mesmo | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D7 | Tipo do arquivo | Por aba, o `ReconhecimentoDeAbas` que a planilha completa já usa; no arquivo: cadastro de alunos, planilha completa (duas ou mais famílias entre alunos, pesos, treino e dieta), treino, dieta, outro reconhecido ou desconhecido | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D8 | Nome de coluna na resposta | Só quando a célula do cabeçalho, normalizada, é **igual** a um sinônimo conhecido (`Campo.sinonimos()`); senão "Coluna X". A heurística anterior (duas ou mais colunas conhecidas) deixava vazar a primeira linha de dados de um arquivo sem cabeçalho | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D9 | Limite de alunos | Teto, não confere quais já existem: alunos ativos com nome da primeira aba de alunos mais os nascidos de blocos de treino, dieta, pesos e suplementos (como a montagem da importação), contra as vagas do plano e as do importador (`ACIMA_DO_LIMITE_DO_PLANO`, `ACIMA_DO_LIMITE_DO_TREINADOR`, quantidade = excesso) | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D10 | Onde fica a regra | `importacao/completa/DiagnosticoDoArquivo` (regra pura sobre as abas já lidas, sem banco), para reaproveitar o que é interno ao pacote (formato do conteúdo, e-mail, data) | decidido pelo Claude em 03/11 |
| D11 | App | Botão "Conferir o arquivo antes de importar" só na **planilha completa**, só com a chave ligada no `GET /eu` e com `ALUNO_ALTERAR`; texto simples, sem redesenhar a tela. A importação de uma aba fica sem o botão (colunas e responsável próprios, que a conferência não conhece): fora do escopo desta fase. O resultado é anunciado (região viva) e recebe o foco; o erro e o resultado somem ao trocar o arquivo | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D12 | Nome de aba | Nunca devolvido: "Aba N" e o tipo reconhecido, porque nos formatos de um aluno por aba o nome da aba é o nome do aluno | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D13 | Veredito | Sucesso só quando algo é importável; arquivo "outro" (tabela de alimentos) ou só com aba sem uso = "nada para importar" (`NADA_PARA_IMPORTAR`); mais de uma aba de alunos avisa que só a primeira é lida (`VARIAS_ABAS_DE_ALUNOS`); e-mail inválido ou repetido só conta em aba de alunos | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D14 | Limite de tentativas | O diagnóstico tem balde próprio (`LimiteTentativas.diagnosticoDeImportacao`, `importacao-diagnostico`, 30 por usuário por hora): repetir a conferência não gasta a prévia nem a confirmação | decidido pelo Claude em 03/11, conferir com o Gustavo |

## Passos
- [x] 1. Plano e índice — commit: neste arquivo
- [x] 2. API: chave, regra pura `DiagnosticoDoArquivo`, rota, `GET /eu`, testes (unidade, integração, sentinela) — commit: `00f3f8ec`
- [x] 3. App: regras de texto em `dominio/`, botão e resultado na tela de importação, jest e e2e — commit: `df592876`
- [x] 4. Documentação (`AGENTS.md`, `docs/importacao-alunos.md`) — commit: `96a07298`
- [x] 5. Correções da revisão independente (vazamento por nome de coluna e de aba, limite com blocos, e-mail só em alunos, veredito, limite de tentativas próprio, botão só na planilha completa, acessibilidade) — commit: `08187482`; docs: o seguinte

## Fora do escopo
- Fase 2: amostra revisável, gravação em rascunho e "Desfazer importação" (outro PR).
- Comparar com os alunos que já existem (nome ou e-mail repetido contra o banco) e nomes de aluno repetidos dentro do arquivo.
- Botão na importação de uma aba (precisaria usar as colunas e o responsável mapeados naquela tela).
- Qualquer IA, serviço externo ou leitura de .xls (continua pedindo .xlsx ou .csv).

## O que ficou para trás
- Fase 2 da migração assistida (README, pendências soltas).
