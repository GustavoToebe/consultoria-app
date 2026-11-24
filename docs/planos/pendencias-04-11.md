# Pendências de 04/11

Situação: Concluída, menos a conferência local · Onde: `main` (lotes A e C mesclados; B descartado em 23/11) · Atualizado: 23/11/2026

## Objetivo
Fechar a limpeza e os prazos de 14/11, os defeitos pequenos do app e os dois e2e que falham com a máquina carregada. Um PR por lote, saindo da `main`.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Caddy em 04/11 | A imagem `caddy:2-alpine` v2.11.7 ainda traz go-jose 4.1.5, Go 1.26.8 e x/net 0.59.0. Exceções renovadas até 28/11, sem apagar | revisão deste lote |
| 1b | Caddy e Dependabot em 23/11 | Revisão adiantada de 28/11: a base nova (Caddy v2.11.9, Go 1.27.3, go-jose v4.1.6, x/net 0.60.0) dispensou as exceções 78667, 78669, 97031, 111943, 97054 e 116587; ficaram a 78661 (x/net 0.62.0), a do `decode-uri-component` e a do `zod`, renovadas para `exp:2026-12-14`; a do `zod` foi mantida e renovada (o Trivy deixou de listá-lo, mas o aviso do GitHub continua aberto). Lock do app: `node-forge` 1.4.4 e `@typescript-eslint` 8.74.0; sobram 14 avisos de ferramenta, aceitos até o SDK 58. Detalhe nas decisões 18 e 19 de [dependabot-28-10.md](dependabot-28-10.md) (estado local sem commit, base `daff8929`) | revisão de 23/11 |
| 2 | Dependabot | `node-forge` 1.4.1 saiu do `npm audit`. `decode-uri-component` 0.2.2 e `uuid` 7.0.3 continuam; detalhe em [dependabot-28-10.md](dependabot-28-10.md) | revisão deste lote |
| 3 | Branches | Apagar a remota cuja ponta é o commit de um PR já mesclado, mais `frente-g-exec` e `frente-g-hist` (estavam dentro da `frente-g` mesclada). Não apagar `main`, `montador-de-telas` (PR #37) nem ponta que não é a do PR | pedido de 04/11 |

## Passos
- [x] A. Guia do treinador, Trivy/Dependabot, `AGENTS.md`, decisões confirmadas e branches mescladas — commit: 42a9f92e
- [x] B. Publicar tudo, `BotaoMarcar`, etapas, inscrição, agenda e cupom no PDF — branch `pendencias-04-11-b` (PR #86, fechado) descartada em 23/11, sem merge. Publicar tudo/etapas (`baseDaProximaAcao`), cupom no PDF, foco do erro na inscrição e `erro`/`ref` no `Escolha` já estão na `main` por outros commits. Superados, não aplicar: ✓ feito em verde no `BotaoMarcar` (a `main` usa o feito neutro, `superficie3` + `textoSuave`, pela cor como sinal) e fundo tingido na lista da Agenda no celular (a grade da `main` não pinta mais o fundo). Se quiser algum dos dois, vira pedido novo depois do piloto
- [x] C. e2e intermitentes (`links-do-menu` e `agenda-calendario`) — PR #87 mesclado
- [ ] Conferência local (importação da planilha completa e Cluster/Rest-pause). Sem PR. Se houver defeito, lote D — commit: —

## Branches apagadas em 04/11
`etapas-por-bloco` já não existia no origin.

Apagadas (46): agenda-mostra-adiada, auditoria-aluno, auditoria-cores, auditoria-ficha, auditoria-pecas, auditoria-treinador, auditoria-ui-ux-lote-1-b, chaves-libras-migracao-ligadas, claude/saraiva-api-direcionamento-treinos-dv10io, cor-da-variacao-do-peso, cores-por-tipo-de-serie, datas-validas, decisoes-gustavo-03-11, docs-pendencias-03-11, docs-planos-reuniao-30-10, editor-de-series-reuniao, execucao-referencia-e-progressao, foco-da-folha-nativo, formaluno-responsavel, frente-g, frente-g-exec, frente-g-hist, historico-ajustes-g, imagem-api-libexpat, impressao-sem-innerhtml, interessados-busca-vazia, libras-fase-1, libras-passo-e-decisoes, limite-de-alunos-telas, menu-todas-as-telas, migracao-assistida-fase-1, miudezas-03-11, paletas-corte, paletas-da-marca, paletas-previa-2, pasta-publicar-copiar, pendencias-app-03-11, pendencias-app-03-11-b, peso-medidas-foto, plano-paletas, planos-c-e-e-concluidas, planos-d1-d2-confirmados, planos-f-e-miudezas-concluidas, planos-g-concluida, push-do-expo, supervisao-da-equipe.

Ficaram: `main`, `montador-de-telas` (PR #37 aberto), `cores-por-tipo-previa` e `paletas-previa` (a ponta não é a do PR #57 mesclado); `nome-overtraining` incorporado na `main` em 09/11 com aval do Gustavo.

## Fora do escopo
- VPS, Cloudflare e banco de produção.
- PR #37 (`montador-de-telas`).

## O que ficou para trás
- Revisão do Caddy e do Dependabot: feita em 23/11 (decisões 18 e 19 de [dependabot-28-10.md](dependabot-28-10.md)); a próxima é em 14/12 (passo 10 do mesmo plano).
- Conferir à mão um app velho contra um plano com forma de carga nova.
- Conferir o foco da Folha no aparelho com TalkBack e VoiceOver.
