# Montador de telas

Situação: Em andamento · Onde: branch `montador-de-telas` · Atualizado: 02/11/2026

## Objetivo
Criar uma tela exclusiva de desenvolvimento (`/montador`) em que o Gustavo monta o rascunho de uma tela nova empilhando os componentes reais de `app/src/ui/`, alterna largura (celular 390 px ou PC 1280 px) e tema (claro, areia, escuro) e exporta ou importa um JSON validado para enviar ao Claude junto com um print.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Fechada em produção | Renderiza só quando `__DEV__ \|\| process.env.EXPO_PUBLIC_MONTADOR === '1'`; fora disso renderiza `NaoEncontrada` (`+not-found.tsx`). Não entra em `dominio/telas.ts`, menu, passeio, `Dockerfile`, `eas.json` nem `.env.example` | Gustavo (especificação de 02/11) |
| 2 | Layout da tela | 3 colunas a partir de `LARGURA_MENU_EXPANDIDO` (1024 px: Paleta, Barra + Prancheta, Propriedades) e `Abas` ("Blocos", "Tela", "Propriedades") abaixo de 1024 px | Gustavo (especificação de 02/11) |
| 3 | Movimentação e confirmação | Versão 1 sem arrastar: botões ↑ ↓, Duplicar, Inserir abaixo e Remover; "Remover" e "Limpar tudo" confirmam com `PainelConfirmacao` e avisos usam `useAviso()` | Gustavo (especificação de 02/11) |
| 4 | Catálogo e componentes reais | 21 blocos com componentes reais de `app/src/ui/` (sem alterar nenhum componente de `app/src/ui/`) + 2 blocos visuais de rascunho (`anotacao` tracejado em `cores.atencao` e `pecaNova` tracejado em `cores.neutro`). Em `GraficoLinha`, a prop obrigatória `descricao` é preenchida a partir da unidade/rótulo | Gustavo (especificação de 02/11) |
| 5 | Tema no Montador | `TemaProvider` aplica `Uniwind.setTheme` e `Uniwind.updateCSSVariables` globalmente; a troca entre Claro, Areia e Escuro usa `escolherPreferencia` e vale para a tela inteira do Montador (com armazém em memória no `TemaProvider` quando não há sessão aberta) | Gustavo (especificação de 02/11) |
| 6 | Largura da moldura × `useWindowDimensions` | A moldura muda entre 390 e 1280 px. `Grade`, `Tabela` e `GraficoLinha` medem a própria largura via `onLayout` e reagem à moldura; já `Cabecalho`, `Cartao` (`recuo`), `CabecalhoDeGrupo`, `LinhaDaLista`, `ListaDeLinhas` e `FaixaDeChips` (`quebrar`) leem `useWindowDimensions()` da janela e seguem a largura real do navegador | Gustavo (especificação de 02/11) |
| 7 | Exportar, importar e limites | Rascunho salvo em `localStorage` (`montador:rascunho`, só web, falha silenciosa). `lerJson` valida versão, tipos conhecidos, props declaradas e tipos, restrições de filhos (`listaDeLinhas` só `linha`, `linhaDeBotoes` só `botao`), até 500 blocos, profundidade até 6, texto até 2.000 caracteres por campo e JSON até 200 KB; nenhum texto vira HTML | Gustavo (especificação de 02/11) |

## Passos
- [x] 1. Plano da frente (`docs/planos/montador-de-telas.md`) e linha no `docs/planos/README.md` — commit/run: —
- [ ] 2. Regras puras e validação em `app/src/dominio/montador.ts` + testes unitários em `app/src/dominio/montador.test.ts` — commit/run: —
- [ ] 3. Catálogo (`catalogo.tsx`), modelos iniciais (`modelosIniciais.ts`), peças (`Paleta.tsx`, `Prancheta.tsx`, `Propriedades.tsx`) e rota `app/src/app/montador/index.tsx` — commit/run: —
- [ ] 4. Atualização de `AGENTS.md`, verificações (`npm run typecheck && npm run lint && npm test`), conferência do export de produção e prints em 390 e 1280 px — commit/run: —

## Fora do escopo
- Versão 2 (fora deste PR):
  - Arrastar para mover (com `react-native-gesture-handler` e `react-native-reanimated`, que o app já tem).
  - Exportar PNG da prancheta.
  - Bloco "Cópia de tela existente" (abrir uma tela real do app com dados fictícios e editar em cima).
  - Comparar duas versões lado a lado.

## O que ficou para trás
- Nada além dos itens planejados para a versão 2 em "Fora do escopo".
