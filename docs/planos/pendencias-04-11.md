# Pendências de 04/11

Situação: Em andamento · Onde: branches `pendencias-04-11-a`, `pendencias-04-11-b` e `pendencias-04-11-c` · Atualizado: 04/11/2026

## Objetivo
Fechar a limpeza e os prazos de 14/11, os defeitos pequenos do app e os dois e2e que falham com a máquina carregada. Um PR por lote, saindo da `main`.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Caddy em 04/11 | A imagem `caddy:2-alpine` v2.11.7 ainda traz go-jose 4.1.5, Go 1.26.8 e x/net 0.59.0. Exceções renovadas até 28/11, sem apagar | revisão deste lote |
| 2 | Dependabot | `node-forge` 1.4.1 saiu do `npm audit`. `decode-uri-component` 0.2.2 e `uuid` 7.0.3 continuam; detalhe em [dependabot-28-10.md](dependabot-28-10.md) | revisão deste lote |
| 3 | Branches | Apagar a remota cuja ponta é o commit de um PR já mesclado, mais `frente-g-exec` e `frente-g-hist` (estavam dentro da `frente-g` mesclada). Não apagar `main`, `montador-de-telas` (PR #37) nem ponta que não é a do PR | pedido de 04/11 |

## Passos
- [ ] A. Guia do treinador, Trivy/Dependabot, `AGENTS.md`, decisões confirmadas e branches mescladas — commit: —
- [ ] B. Publicar tudo, `BotaoMarcar`, etapas, inscrição, agenda e cupom no PDF — commit: —
- [ ] C. e2e intermitentes (`links-do-menu` e `agenda-calendario`) — commit: —
- [ ] Conferência local (importação da planilha completa e Cluster/Rest-pause). Sem PR. Se houver defeito, lote D — commit: —

## Branches apagadas em 04/11
`etapas-por-bloco` já não existia no origin.

Apagadas (46): agenda-mostra-adiada, auditoria-aluno, auditoria-cores, auditoria-ficha, auditoria-pecas, auditoria-treinador, auditoria-ui-ux-lote-1-b, chaves-libras-migracao-ligadas, claude/saraiva-api-direcionamento-treinos-dv10io, cor-da-variacao-do-peso, cores-por-tipo-de-serie, datas-validas, decisoes-gustavo-03-11, docs-pendencias-03-11, docs-planos-reuniao-30-10, editor-de-series-reuniao, execucao-referencia-e-progressao, foco-da-folha-nativo, formaluno-responsavel, frente-g, frente-g-exec, frente-g-hist, historico-ajustes-g, imagem-api-libexpat, impressao-sem-innerhtml, interessados-busca-vazia, libras-fase-1, libras-passo-e-decisoes, limite-de-alunos-telas, menu-todas-as-telas, migracao-assistida-fase-1, miudezas-03-11, paletas-corte, paletas-da-marca, paletas-previa-2, pasta-publicar-copiar, pendencias-app-03-11, pendencias-app-03-11-b, peso-medidas-foto, plano-paletas, planos-c-e-e-concluidas, planos-d1-d2-confirmados, planos-f-e-miudezas-concluidas, planos-g-concluida, push-do-expo, supervisao-da-equipe.

Ficaram: `main`, `montador-de-telas` (PR #37 aberto), `cores-por-tipo-previa`, `nome-overtraining` (o nome Overtraining não está na `main`) e `paletas-previa` (a ponta não é a do PR #57 mesclado).

## Fora do escopo
- VPS, Cloudflare e banco de produção.
- PR #37 (`montador-de-telas`).

## O que ficou para trás
- Revisão do Caddy e do Dependabot em 28/11 (também em [dependabot-28-10.md](dependabot-28-10.md)).
- Conferir à mão um app velho contra um plano com forma de carga nova.
- Conferir o foco da Folha no aparelho com TalkBack e VoiceOver.
