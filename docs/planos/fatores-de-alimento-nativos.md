# Fatores de alimento nativos (FC e FCc estimados)

Situação: Em andamento (V060 no PR #103) · Onde: branch `top-set-restaurado` (PR #103) · Atualizado: 05/11/2026

## Objetivo
O rendimento do alimento (fator de correção, FC, e fator de cocção, FCc) deixa de depender de planilha externa: o sistema estima os dois pelo nome e pelo grupo do alimento, e a lista de compras e os PDFs usam essa conta. Substitui o arquivo de fatores que o treinador ia enviar (C52).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | FC (bruto/líquido) fica entre 1 e 20; FCc (pronto/cru) entre 0,1 e 10; vazio = estimativa; um 1,00 digitado é valor real; fora da faixa = 422 `ALIMENTO_INVALIDO` | Conforme o texto | Gustavo (reunião de 30/10) |
| 2 | A mesma regra em Java (`FatoresDeRendimento`), no app (`fatoresDoAlimento.ts`) e no script de importação (`fatores-do-alimento.mjs`) | Conforme o texto | Claude |
| 3 | Migration própria V060, fora da "migration única" das receitas de série | Manter separada | Gustavo (05/11) |
| 4 | Sem compatibilidade com o legado: a V060 apaga os itens artificiais do catálogo (fontes Oliveira, Cumbaru e Scienza; ficam TACO e Batel Grill), regrava FC e FCc de todo alimento (inclusive o que o treinador digitou) e remove `fonte_fatores` e `fatores_do_catalogo` | Conforme o texto | Regra do repositório (antes do primeiro cliente) |

## Passos
- [x] 1. `FatoresDeRendimento` (API), regra no app e no script de importação, com testes — commit: no PR #103
- [x] 2. V060: estima catálogo e biblioteca, reescreve o JSON de dietas publicadas, rascunhos e modelos de dieta e de refeição, remove as duas colunas — commit: no PR #103
- [x] 3. Lista de compras (app e PDF) e telas da biblioteca usam a conta nova — commit: no PR #103
- [x] 4. Saem `dados/fontes/fatores/*`, o relatório de importação e `scripts/catalogo/gerar_fatores.py` — commit: no PR #103
- [ ] 5. Conferir na tela (lista de compras, Biblioteca › Alimentos) depois do deploy

## Fora do escopo
- Fatores individuais por alimento vindos de outra fonte: se um dia houver, entram como migration nova.

## O que ficou para trás
- Conferir a tela depois do deploy (passo 5).
