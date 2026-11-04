# Auditoria de UI/UX: peças compartilhadas (Folha, Botão, Kanban)

Situação: Código feito, aguardando PR (passos 1 a 5 feitos; falta o revisor) · Onde: branch `auditoria-pecas` (saída da `main` `3d65e04b`) · Atualizado: 03/11/2026

## Objetivo
Corrigir as peças que aparecem em quase toda tela: a `Folha` passa a ser um diálogo só para o leitor de tela, com o
foco entrando nela ao abrir e voltando a quem a abriu ao fechar; a `Folha` e o `Botao` deixam de ter cor fixa e passam
a usar o tema; o Kanban dos Interessados respeita o movimento reduzido. Fontes: C3 e seção C de
[auditoria-ui-ux-2026-11-03.md](auditoria-ui-ux-2026-11-03.md) e a 2ª passada (sem item novo para estas peças).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Escopo da frente "Peças" | Só `app/src/ui` (e `app/src/tema/` para as cores), fora `ui/Estados.tsx`, `ui/Abas.tsx` e os arquivos do PR B. Regra pura nova vai para `dominio/` com jest | Gustavo, 03/11 |
| D2 | Itens | C3 (Folha: um diálogo, foco inicial e retorno do foco), cores fixas de `ui/Folha.tsx` e `ui/Botao.tsx` pelo tema com contraste no teste que já existe, Kanban dos Interessados com movimento reduzido | Gustavo, 03/11 |
| D3 | Verificação | e2e **inteiro** no fim (Folha e Botão estão em quase toda tela), pela trava, porta 8103 | Gustavo, 03/11 |
| D4 | Foco no celular (proposta aplicada; aceita) | O retorno do foco é só na web (como o `PainelConfirmacao`). No nativo o `accessibilityViewIsModal` já prende o leitor de tela; devolver o foco do VoiceOver/TalkBack pediria a referência de quem abriu em cada chamada (cerca de 90 arquivos), fora do escopo | proposta da frente, 03/11; aceita (Gustavo, 03/11) |
| D5 | Texto do botão `perigo` (proposta aplicada; confirmar no PR) | `textoSobre(cores.perigoFundo)` de `tema/tokens.ts` (a mesma regra do `sobreMarca`), sem campo novo em `Cores`; o teste confere ≥ 4,5:1 em todas as variantes de tema | proposta da frente, 03/11 |
| D6 | Véu da Folha (proposta aplicada; confirmar no PR) | Token novo `VEU` em `tema/tokens.ts` (o mesmo preto translúcido de hoje), usado pela `Folha`. O `Passeio` não muda aqui: o arquivo é da frente Aluno (decisão do Gustavo, 03/11); usar o `VEU` nele fica como pendência solta | proposta da frente, 03/11; Passeio: Gustavo, 03/11 |
| D7 | Kanban com movimento reduzido (proposta aplicada; confirmar no PR) | Hoje não há animação temporizada: o cartão segue o dedo enquanto arrasta (`translateX/Y`, opacidade 0,9) e volta na hora. Com movimento reduzido o cartão não flutua (fica no lugar, com a borda em `anelFoco` enquanto arrasta) e o soltar continua valendo pela posição do dedo; "Mover para" segue como alternativa. Alternativa: considerar o arrastar manipulação direta (WCAG 2.3.3 isenta) e só documentar | proposta da frente, 03/11 |
| D8 | ✓ da série desabilitado (proposta aplicada; aceita) | `ui/BotaoMarcar` ganha o visual desabilitado só com tokens que já existem, sem opacidade nem token novo: faixa `superficie3` e borda `borda` (o habilitado vazio usa `campo` e `bordaCampo`); o ícone `textoSuave` segue ≥ 4,5:1 sobre a faixa (`contrasteDasPecas.test.ts`). Vale nos dois casos em que o ✓ trava: prévia do treinador e valor que não é número (`invalido`, na execução do aluno). Feito e desabilitado continua verde (a série feita não deve parecer apagada). Regra em `coresDoMarcar` (`ui/marcar.ts`, com jest). Pedido do visual: Gustavo, 03/11 | proposta da frente, 03/11; aceita (Gustavo, 03/11) |

## Passos
- [x] 1. **C3, Folha com um diálogo só, foco inicial e retorno do foco** (`ui/Folha.tsx`; e2e novo `e2e/folha-foco.spec.ts`; `e2e/cadastro-aluno.spec.ts` ajustado) — commit/run: `8594879f`
  - Feito: o painel é o único `role=dialog` (a camada do `Modal` do react-native-web perde o papel pelo `ref`); quem tinha o foco é lido no primeiro render e recebe o foco de volta quando o painel sai e no `onDismiss` (a trava do `Modal` fica um render a mais); se o foco já está em outro diálogo, fica lá; na web o fundo escurecido não entra no Tab (o Tab dá a volta só dentro do painel).
  - Aceite: com uma Folha aberta na web há exatamente um `role=dialog` (com `aria-modal` e o nome do título); o foco
    inicial fica dentro da folha (primeiro controle no PC, X no celular, como hoje); Esc, X, tocar fora e o voltar do
    navegador devolvem o foco ao elemento que abriu a folha (se ele ainda existir); `PainelConfirmacao` aberto de
    dentro da folha continua por cima e devolve o foco para dentro dela. e2e de teclado em 390 e 1280 px.
- [x] 2. **Cores da Folha e do Botão pelo tema** (`ui/Folha.tsx`, `ui/Botao.tsx`, `tema/tokens.ts`, `ui/contrasteDasPecas.test.ts`) — commit/run: `8594879f`
  - Aceite: nenhum hex/`rgba` literal em `Folha.tsx` e `Botao.tsx`; o texto do botão `perigo` sobre `perigoFundo` passa
    de 4,5:1 em claro, claro areia e escuro, com e sem contraste alto e bordas reforçadas (`contrasteDasPecas.test.ts`);
    visual igual ao de hoje nos três temas (captura 390/1280, claro e escuro).
- [x] 3. **Kanban dos Interessados com movimento reduzido** (`treinador/interessados/QuadroKanban.tsx`, fora de `ui/`) — commit/run: `8594879f`
  - Aceite: com `useMovimentoReduzido()` ligado (preferência "Reduzir" ou o do aparelho) o cartão não se desloca nem
    muda de opacidade ao arrastar (D7); desligado, nada muda. Conferido no e2e dos Interessados com
    `reducedMotion: 'reduce'` (em `e2e/interessados-crm.spec.ts` ou spec novo, a decidir com a sessão principal).
- [x] 4. **Verificações** — typecheck, lint, jest, e2e inteiro pela trava (porta 8103), `git checkout -- app/src/uniwind-types.d.ts`, `app/tsconfig.json` sem mudança — commit/run: —
  - Resultado (03/11, depois do merge com a `main` que já tem o PR B e a frente Aluno #63): tsc 0 erros, lint limpo, jest 244 suítes e 3819 testes; e2e inteiro 688 passaram, 8 pulados, 0 falhas (porta 8103, pela trava). Na rodada anterior, o `cadastro-aluno:507` falhava por causa do C3 (a pergunta "Sair sem salvar?" é um `alertdialog` por cima da Folha) e o spec passou a buscá-la por `alertdialog`; `peso-historico-aluno` 390 é instável sob carga.

- [x] 5. **✓ da série desabilitado** (`ui/BotaoMarcar.tsx`, `ui/marcar.ts`, `ui/marcar.test.ts`, `ui/BotaoMarcar.test.ts`, `ui/contrasteDasPecas.test.ts`) — commit/run: `8594879f`
  - Aceite: o ✓ desabilitado (prévia ou valor inválido) não tem a cara do habilitado (D8); contraste conferido no teste das peças; nenhum e2e usa o visual.

## Fora do escopo
- Cores fixas fora de `ui/Folha.tsx` e `ui/Botao.tsx`: `components/ui/switch.tsx` (`#FFFFFF` do polegar),
  `components/ui/alert-dialog.tsx` (`bg-black/50`), sombras `rgba` de `EscolhaSuspensa`, `SelecaoMultiplaSuspensa`,
  `Calendario`, `BuscaGlobal` e `CartaoDoUsuario` (este no PR B). Ficam para "Pendências soltas" se não entrarem.
- ~~Devolver o foco do leitor de tela no celular (D4)~~: feito na frente [foco-da-folha-nativo.md](foco-da-folha-nativo.md); falta conferir no aparelho (Gustavo).
- Texto da Ajuda e linha do `AGENTS.md` sobre o foco da Folha: depois do merge do PR B (os dois arquivos estão nele).

## O que ficou para trás
- `VEU` no `ui/Passeio.tsx` (frente Aluno), depois do merge das duas.
- Cores fixas fora da Folha e do Botão (lista em "Fora do escopo").
- ~~Foco do leitor de tela no celular ao fechar a folha (D4)~~: feito em [foco-da-folha-nativo.md](foco-da-folha-nativo.md); conferir no aparelho é do Gustavo.
- ~~Frase do `AGENTS.md` sobre o foco da Folha~~: feita (o PR B já está na branch).
- Véu do `Passeio` pelo token `VEU`: o arquivo ficou com a frente Aluno (03/11); fazer depois do merge das duas.
