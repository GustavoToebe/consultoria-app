# Impressão na web sem innerHTML

Situação: Concluída em 03/11/2026 (falta merge na `main`) · Onde: branch `impressao-sem-innerhtml` · Atualizado: 03/11/2026

## Objetivo
`pdf/imprimir.web.ts` deixa de usar `innerHTML` para pôr o documento na página: o HTML dos geradores é lido por `DOMParser` (documento inerte, nada executa nem carrega), higienizado e só então importado nó a nó. O resultado visual é o mesmo; o risco de um campo novo sem `esc()` virar XSS cai de "trava de teste" para "trava de teste e barreira no navegador". Fecha o item D3 da [revisão de segurança de 28/10](revisao-seguranca-28-10.md).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Forma de montar | `DOMParser.parseFromString` + higienização no documento inerte + `document.importNode` dos filhos do `body` para um `DocumentFragment` | decidido pelo Claude em 03/11, conferir com o Gustavo |
| 2 | Higienização (defesa em profundidade, o `esc()` continua sendo a regra) | remove `script`, `style` (o atributo `style` fica: a faixa da marca usa), `iframe`, `object`, `embed`, `base`, `link`, `meta`, `form`, `svg`, `math` (com `animate`/`set`) e todo atributo `on*`; nos atributos de endereço (`href`, `src`, `xlink:href`, `action`, `formaction`, `data`, `poster`, `background`, `srcset`, `ping`) só passa **lista permitida**: relativo, âncora, `http:`, `https:`, `mailto:`, `blob:` e `data:image/` raster (png, jpeg, gif, webp; a logo), testado sem tab, quebra de linha, espaço nem controle (`java&#9;script:` não passa). Motivo: `script` vindo do `DOMParser` e importado para a página **pode executar** (diferente do `innerHTML`), então não basta trocar a API | confirmado pelo Gustavo em 04/11 |
| 3 | Escopo | só a web (`imprimir.web.ts`); os geradores de string (`pdf/*.ts`) e o celular não mudam; os cinco geradores seguem com `esc()` | decidido pelo Claude em 03/11, conferir com o Gustavo |

## Passos
- [x] 1. Plano e índice — commit: neste
- [x] 2. `montarCorpo` em `imprimir.web.ts` sem `innerHTML`, com teste de HTML hostil (jsdom, `imprimir.web.dom.test.ts`) e igualdade com o `innerHTML` de referência (também com a saída real de treino, dieta, mobilidade, cargas e lista de compras, em `injecao.test.ts`) — commit: ver `git log` da branch
- [x] 3. `typecheck`, `lint`, `jest` e e2e `impressao-cancelada`, `impressao-emulada` (`IMPRESSAO_CANAIS=1`, Chrome e Edge), `dieta-opcoes-e-preparo` e `lista-de-compras` verdes em 03/11

## Fora do escopo
- Reescrever os geradores para criar nós de DOM (D3 original): o `DOMParser` dá a mesma garantia sem tocar nos cinco geradores.
- O jsdom não executa scripts por padrão: o teste de "nada executa" é reforço; a prova é estrutural (nenhum nó ativo sobra).
- O diálogo real de impressão do navegador não é automatizável.

## O que ficou para trás
- (nada)
