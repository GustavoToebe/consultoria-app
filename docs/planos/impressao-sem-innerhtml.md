# Impressão na web sem innerHTML

Situação: Em andamento · Onde: branch `impressao-sem-innerhtml` · Atualizado: 03/11/2026

## Objetivo
`pdf/imprimir.web.ts` deixa de usar `innerHTML` para pôr o documento na página: o HTML dos geradores é lido por `DOMParser` (documento inerte, nada executa nem carrega), higienizado e só então importado nó a nó. O resultado visual é o mesmo; o risco de um campo novo sem `esc()` virar XSS cai de "trava de teste" para "trava de teste e barreira no navegador". Reabre o item D3 da [revisão de segurança de 28/10](revisao-seguranca-28-10.md).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Forma de montar | `DOMParser.parseFromString` + higienização no documento inerte + `document.importNode` dos filhos do `body` para um `DocumentFragment` | decidido pelo Claude em 03/11, conferir com o Gustavo |
| 2 | Higienização (defesa em profundidade, o `esc()` continua sendo a regra) | remove `script`, `iframe`, `object`, `embed`, `base`, `link`, `meta`, `form`; remove todo atributo `on*`; remove `href`/`src` com `javascript:`. Motivo: `script` vindo do `DOMParser` e importado para a página **pode executar** (diferente do `innerHTML`), então não basta trocar a API | decidido pelo Claude em 03/11, conferir com o Gustavo |
| 3 | Escopo | só a web (`imprimir.web.ts`); os geradores de string (`pdf/*.ts`) e o celular não mudam; os cinco geradores seguem com `esc()` | decidido pelo Claude em 03/11, conferir com o Gustavo |

## Passos
- [x] 1. Plano e índice — commit: neste
- [ ] 2. `montarCorpo` em `imprimir.web.ts` sem `innerHTML`, com teste de HTML hostil (jsdom) e igualdade com o `innerHTML` de referência — commit: —
- [ ] 3. `npm run typecheck`, `lint`, `jest` e e2e `impressao-emulada`/`impressao-cancelada` — commit: —

## Fora do escopo
- Reescrever os geradores para criar nós de DOM (D3 original): o `DOMParser` dá a mesma garantia sem tocar nos cinco geradores.
- O diálogo real de impressão do navegador não é automatizável.

## O que ficou para trás
- (nada)
