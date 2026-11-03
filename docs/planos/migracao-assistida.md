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
| D2 | Só regras fixas e determinísticas; o conteúdo do arquivo nunca vai para IA, serviço externo, log, auditoria nem mensagem de erro | A resposta leva só contagens, nomes de coluna/aba e códigos de problema; nunca valor de célula nem nome de aluno | Gustavo, 03/11 |
| D3 | Chave de ambiente | `TREINOS_MIGRACAO_ASSISTIDA_HABILITADA`, padrão `false`, no molde de `TREINOS_RETORNO_HABILITADO`: desligada, 503 `MIGRACAO_INDISPONIVEL`, `GET /eu` traz `migracaoAssistidaHabilitada=false`, o app esconde tudo; `application-test.yml` liga | Gustavo, 03/11 |
| D4 | Rota | `POST /importacoes/diagnostico` (multipart `arquivo`), mesmo leitor, tamanho e tipo da importação (`LeitorDePlanilha`/`LeituraDasAbas`), mesmo limite de tentativas da prévia; não grava nada, nem registro de importação | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D5 | Permissão | A da planilha completa (`ALUNO_ALTERAR`); nenhuma permissão nova, sem migration | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D6 | Auditoria | Nenhuma: a prévia existente não audita e o diagnóstico segue o mesmo | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D7 | Tipo do arquivo | Por aba, o `ReconhecimentoDeAbas` que a planilha completa já usa; no arquivo: cadastro de alunos, planilha completa (duas ou mais famílias entre alunos, pesos, treino e dieta), treino, dieta, outro reconhecido ou desconhecido | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D8 | Nome de coluna na resposta | Só quando o cabeçalho foi achado por duas ou mais colunas conhecidas e a célula parece nome de coluna (texto curto); senão "Coluna X". Evita devolver como "coluna" a primeira linha de dados de um arquivo sem cabeçalho | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D9 | Limite de alunos | Contagem: linhas com nome na aba de alunos contra as vagas do plano e as vagas do importador (o importador é o responsável do aluno novo); é teto, pois não confere quais já existem (`ACIMA_DO_LIMITE_DO_PLANO`, `ACIMA_DO_LIMITE_DO_TREINADOR`, quantidade = excesso) | decidido pelo Claude em 03/11, conferir com o Gustavo |
| D10 | Onde fica a regra | `importacao/completa/DiagnosticoDoArquivo` (regra pura sobre as abas já lidas, sem banco), para reaproveitar o que é interno ao pacote (formato do conteúdo, e-mail, data) | decidido pelo Claude em 03/11 |
| D11 | App | Botão "Conferir o arquivo antes de importar" na tela de importação existente, só com a chave ligada no `GET /eu`; texto simples, sem redesenhar a tela | decidido pelo Claude em 03/11, conferir com o Gustavo |

## Passos
- [x] 1. Plano e índice — commit: neste arquivo
- [ ] 2. API: chave, regra pura `DiagnosticoDoArquivo`, rota, `GET /eu`, testes (unidade, integração, sentinela) — commit: —
- [ ] 3. App: regras de texto em `dominio/`, botão e resultado na tela de importação, jest e e2e — commit: —
- [ ] 4. Documentação (`AGENTS.md`, `docs/importacao-alunos.md`) — commit: —

## Fora do escopo
- Fase 2: amostra revisável, gravação em rascunho e "Desfazer importação" (outro PR).
- Comparar com os alunos que já existem (nome ou e-mail repetido contra o banco) e nomes de aluno repetidos dentro do arquivo.
- Qualquer IA, serviço externo ou leitura de .xls (continua pedindo .xlsx ou .csv).

## O que ficou para trás
- Fase 2 da migração assistida (README, pendências soltas).
