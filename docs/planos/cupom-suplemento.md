# Cupom no suplemento (C51)

Situação: Em revisão (PR aberto, falta o merge) · Onde: branch `cupom-suplemento` (um PR) · Atualizado: 03/11/2026 · Registro: reunião de 30/10, C51

## Objetivo
O treinador guarda o cupom de desconto do suplemento na biblioteca, e o aluno vê esse cupom na dieta, junto do link,
com um botão de copiar. O app não calcula nada, não aplica desconto e não recomenda nada.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Campo | "Cupom", opcional, texto até 40 caracteres depois do strip; em branco vira nulo; migration V053 | Gustavo |
| D2 | Onde aparece | edição da Biblioteca › Suplementos e importação por planilha (se o modelo tiver as colunas do suplemento) | Gustavo |
| D3 | Dieta | o cupom é copiado para a dieta como o link é copiado hoje; o aluno vê o cupom junto do link, com botão de copiar | Gustavo |
| D4 | Erro | 422 no campo, sem repetir o valor | Gustavo |
| D5 | Como sai o 422 | na biblioteca, por `ValidacaoException` no `SuplementoService` (campo `cupom`, código `SUPLEMENTO_INVALIDO`), e não pela Bean Validation (que daria 400, como o link); na dieta, a publicação valida `suplementacao[s].cupom` no `ValidadorDieta` (422 `PLANO_INVALIDO`, como o link) | Claude |
| D6 | Regra num lugar só | `web/CupomDeSuplemento` (limpar, valido, normalizar), usado pela biblioteca, pela dieta e pela importação | Claude |
| D7 | Rascunho da dieta | o cupom do rascunho tem `@Size(max = 500)` só como teto (o rascunho aceita conteúdo incompleto); os 40 valem na publicação | Claude |
| D8 | Tipo no app | `cupom?` opcional no suplemento da dieta (dieta antiga vem sem o campo); o botão da biblioteca para apagar chama-se "Tirar cupom" | Claude |
| D9 | Planilhas | a planilha de suplementos lê a coluna Cupom (modelos `suplementos.csv`/`.xlsx` com a coluna); a planilha completa não lê o cupom | Claude |
| D10 | Guias | os PDFs foram gerados com o Chromium do Playwright (`NAVEGADOR_PDF`), porque o Edge padrão desta máquina não gerou o PDF | Claude |

## Passos
- [x] 1. API: V053, campo no suplemento e no suplemento da dieta, validação, cópia para a dieta, teste de integração — executor — commit: 544cd474
- [x] 2. App: campo na Biblioteca › Suplementos, cupom com copiar na dieta do aluno, jest no domínio, e2e da dieta do aluno — executor — commit: 544cd474
- [ ] 3. Planilha, Ajuda e AGENTS.md (modelos e guias gerados de novo, se mudarem) — executor-rapido — commit: 8fe1a4e0

## Fora do escopo
- Cálculo de desconto, validade do cupom, recomendação de suplemento (D3).
- Cupom no PDF da dieta (fica para quando alguém pedir).

## O que ficou para trás
- O script `importar.mjs` não manda o cupom. Um PUT que substitui o suplemento apaga o cupom, como já acontece com o link.
- O cupom não sai no PDF da dieta (fora do escopo).
- A API usa `strip()` e o app usa `trim()` para limpar o cupom; só muda com espaços Unicode raros.
- No teste da importação, a conferência de que a mensagem não repete o valor olha só a lista `erros`.
- A planilha completa não lê o cupom (D9).
