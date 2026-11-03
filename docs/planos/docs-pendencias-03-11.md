# Documentação de 03/11: pendências e roteiro

Situação: Em andamento (commit local, sem push) · Onde: branch `docs-pendencias-03-11` (de `origin/main`) · Atualizado: 03/11/2026

## Objetivo
Registrar o que falta conferir em produção (roteiro do aluno fictício do Engajamento) e confirmar que as três liberações obrigatórias da Cloudflare seguem listadas com o momento certo. Só documentação.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Roteiro do aluno fictício fica no fim de `engajamento.md`; o README aponta para ele | — | Gustavo (pedido) |
| 2 | Quem executa o roteiro em produção | Gustavo; o Claude não acessa produção | Gustavo |
| 3 | Cloudflare: nada muda; as exceções (a), (b) e (c) já estavam em "Pendências soltas" com o momento | — | conferido em 03/11 |

## Passos
- [x] 1. Roteiro do aluno fictício no fim de `engajamento.md` — commit: —
- [x] 2. Linha em "Pendências soltas" do README para o roteiro (quem faz = Gustavo) — commit: —
- [x] 3. Conferência das liberações da Cloudflare (a: revisão das lojas; b: webhook da InfinitePay; c: `/.well-known/`) — sem mudança, já listadas — commit: —
- [ ] 4. Commit local em português, `git merge origin/main`; sem push e sem PR — commit: —

## Fora do escopo
- Push e PR: o Gustavo decide.
- Execução do roteiro em produção: o Gustavo faz.

## O que ficou para trás
- Nada além do que já está em "Pendências soltas" do README.
