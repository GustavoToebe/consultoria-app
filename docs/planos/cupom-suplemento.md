# Cupom no suplemento (C51)

Situação: Em andamento · Onde: branch `cupom-suplemento` (um PR) · Atualizado: 03/11/2026 · Registro: reunião de 30/10, C51

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
| D5 | Como sai o 422 | na biblioteca, por `ValidacaoException` no `SuplementoService` (campo `cupom`), e não pela Bean Validation (que daria 400, como o link); na dieta, a publicação valida `suplementacao[i].cupom` no `ValidadorDieta` (422 `PLANO_INVALIDO`, como o link) | Claude |

## Passos
- [ ] 1. API: V053, campo no suplemento e no suplemento da dieta, validação, cópia para a dieta, teste de integração — executor — commit: —
- [ ] 2. App: campo na Biblioteca › Suplementos, cupom com copiar na dieta do aluno, jest no domínio, e2e da dieta do aluno — executor — commit: —
- [ ] 3. Planilha, Ajuda e AGENTS.md (modelos e guias gerados de novo, se mudarem) — executor-rapido — commit: —

## Fora do escopo
- Cálculo de desconto, validade do cupom, recomendação de suplemento (D3).
- Cupom no PDF da dieta (fica para quando alguém pedir).

## O que ficou para trás
- —
