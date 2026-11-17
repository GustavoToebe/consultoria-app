---
name: verificacoes-consultoria
description: O que rodar antes de entregar no consultoria-app e as regras de CI, push e deploy. Use ao escolher testes (mvn verify, typecheck, lint, jest, e2e Playwright), ao escrever teste de integração ou e2e e antes de qualquer commit, push ou mudança em .github/.
---
# Verificações, CI e deploy do consultoria-app

O `AGENTS.md` do repositório é a fonte e vence esta lista.

## O que rodar, pelo que mudou
| Mudou | Rode |
| --- | --- |
| `api/` | `mvn verify` em `api/` (JDK 25 no `JAVA_HOME`, Docker ligado para o Testcontainers) |
| `app/` | `npm run typecheck && npm run lint && npm test` em `app/` |
| Tela da web | o e2e da tela: `npm run e2e -- e2e/<tela>.spec.ts` em `app/` |
| Dependência do app | `npx expo install --check` e `npx expo-doctor` (`@plataforma/web` é a exceção documentada) |
| `scripts/` | `node --test` do script mexido |
| `.github/scripts/` | os `*.test.sh` da pasta |
| Texto da Ajuda (`ajuda/conteudo.ts`) | `node scripts/guias/gerar.mjs` e versione os PDFs |
| Regra do questionário | `node scripts/questionario/gerar-fixtures.mjs` (fixture não se edita à mão) |

Saída grande vai ao `executor-rapido` para filtrar: falha, arquivo:linha e mensagem principal.

## Teste de integração da API
- Todos dividem um Postgres só. O dado que o teste cria tem nome, e-mail ou slug único (`ApiDeTeste.emailUnico`,
  `UUID`, `Documentos.cpf()`).
- Consulta direta filtra pelo id do próprio teste (aluno, consultoria). `count(*)` sem filtro só para invariante
  global. A ordem dos testes não pode mudar o resultado.
- Teste que corrompe linha global (ex.: `credencial_pagamento`) apaga a linha no fim.
- Só dados fictícios. Serviço externo é sempre de mentira (servidor do JDK, MinIO do Testcontainers).

## E2E (Playwright, `app/e2e/`)
- Fora da CI. Rode o da tela antes e depois de mexer nela; tela nova ganha caso, em 390 e 1280 px.
- A API é simulada em `e2e/api-falsa.ts`: rota não simulada vira 404 em `naoTratadas`, exceção da página vai para
  `errosDaPagina`. Só dados fictícios.
- `app/node_modules` em link de outro worktree: monte com
  `npx expo export --platform web --output-dir dist-e2e --clear`. Sem o `--clear`, o cache do Metro pode montar o
  código do outro worktree.
- Montador: `EXPO_PUBLIC_MONTADOR=1`, saída em `dist-e2e-montador` e `--clear`.
- Use o Chromium já instalado (`PW_CHROMIUM`). Não baixe browser novo.

## CI e deploy
- Os minutos do Actions são contados. Testes locais verdes antes de subir, commits juntos e **um push por lote**.
- Nunca dispare workflow à mão nem reexecute job que falhou sem corrigir a causa.
- Push só de `*.md` ou `docs/` não roda a CI.
- A CI testa e publica só a parte que mudou (`.github/scripts/partes-mudadas.sh`) e não repete teste que já passou
  no PR com a mesma árvore (`arvore-ja-testada.sh`). Na dúvida, os scripts mandam testar tudo; mexeu neles, rode os
  `*.test.sh`.
- Com 3 ou mais PRs prontos da mesma parte, sem migration e sem mudança sensível: lote `lote-DD-MM` (regra completa
  no `AGENTS.md`).
- Push na `main` publica produção: só a pedido do Gustavo e pela sessão principal. Subagente nunca faz commit nem
  push.
- O deploy de produção vive em `../central/central-api-back/deploy/`. Script de produção nunca é rodado como teste.

## No relatório
✅ ou ❌ por verificação, com o comando. Diga o que não rodou e por quê. Nunca "passou" sem ter executado.
