# Cartões que perderam cor no cartão pintado: auditoria

Situação: Concluída em 24/11/2026 (nada a restaurar) · Onde: branch ficha-24-11 · Atualizado: 24/11/2026

## Objetivo
Conferir se, no commit `328df011` ("Cartão de indicador pintado") e no lote, algum cartão perdeu uma cor que era de categoria ou de
situação, e restaurar só esses. Cor como sinal (`docs/design-e-front.md`, 4.4 e 4.6): marca, situação e categoria; seleção e
números neutros.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Cores que sumiram eram cores de medida (azul, ciano, violeta de `dominio/destaque`, "o que o número mede"), não de situação nem de categoria | Ficam neutras, como no item "Cartão de indicador pintado" do design | Gustavo, 23/11 (derrubar cores neutras por regra) |
| D2 | "Nos próximos 7 dias" (Início) e "Novos" (Início): dúvida decidida por evidência do próprio app | Neutros: o selo "Atualização em N dias" (`dominio/atualizacao.ts`) e o selo "Nova" (`seloDaSituacao('NOVA')`) já são `neutro` nas listas | Sessão (24/11), pelo padrão do app |
| D3 | Nenhum código mudou | Sem restauração, sem teste novo, sem capturas | Sessão (24/11) |

## Passos
- [x] 1. Comparar `git show 328df011^:<arquivo>` com o atual em cada ponto de uso (Início, Números, Financeiro, Interessados, resumo do aluno, `ResumoDaSessao`, `ResumoDoPeso`, `ResumoDaAtualizacao`, `TelaImportacao`) — commit/run: — (leitura; tabela em `capturas/24-11/item-2b-relatorio.md`)
- [x] 2. Restaurar categoria e situação perdidas — nenhuma encontrada — commit/run: —

## Fora do escopo
- "Treinos registrados" do resumo da ficha (azul → neutro, medida): é do agente C (Resumo da ficha em cartões); pelo design é neutro.

## O que ficou para trás
- Nada. Cores que mudaram de tom no mesmo commit sem sumir (Início: Para revisar, Trocas, A renovar, Retornos e Vencendo passaram de azul genérico para `atencao` ou `perigo`) estão certas pelo design.
