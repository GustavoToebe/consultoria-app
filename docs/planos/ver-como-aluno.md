# Ver como o aluno (C34)

Situação: Em andamento · Onde: branch `ver-como-aluno` (um PR) · Atualizado: 03/11/2026 · Registro: reunião de 30/10, C34

## Objetivo
No editor do plano de treino e de dieta do aluno, o treinador abre uma prévia "como o aluno vê", só de leitura, com o
que está na tela (inclusive o que ainda não foi salvo), montada com os mesmos componentes das telas do aluno. Nada é
gravado e os botões de marcar não fazem nada.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Onde abre | botão "Ver como o aluno" na `BarraDoPlano`, que abre uma `Folha` larga (`LARGURA_EDITOR`); no celular a Folha vira a folha de baixo. A Folha guarda o conteúdo do editor na memória, sem rota nova nem estado no endereço | Claude |
| D2 | De onde vêm os dados | `editor.estado.conteudo` do `usePlanoEditor` (o que está na tela, salvo ou não). Sem sessão nova e sem rota nova na API | Gustavo |
| D3 | Componentes | os do aluno (`app/src/aluno/`), por props, com as ações de registro trocadas por nada; o `AlunoProvider` **não** é montado (ele grava pacote e fila no aparelho em nome de quem está logado, aqui o treinador) | Claude |
| D4 | Deixar claro que é prévia | faixa fixa "Prévia: é assim que o aluno vê. Nada é registrado aqui."; botões de marcar com `accessibilityState.disabled` e sem efeito; nenhuma chamada que não seja GET sai da tela | Gustavo |
| D5 | Largura | no PC o conteúdo fica na largura de um celular dentro da Folha, para parecer a tela do aluno | Claude |
| D6 | Onde vale | editor de treino e de dieta do aluno; fora do modo modelo (`BarraDoModeloDoEditor`) e da mobilidade. O botão fica fora do `escritaLiberada`, como o PDF: quem só lê o plano também vê a prévia | Claude |
| D7 | O que a publicação copia | a dieta passa por `comFatoresDaBiblioteca` (grupo e fatores, `GET /alimentos/fatores`), como a prévia que já existe; o resto mostra o rascunho como está. O que a publicação ainda copia da biblioteca e o rascunho não tem fica registrado em "O que ficou para trás" | Claude |

## Passos
- [ ] 1. Regra pura em `dominio/` (rascunho → o que o aluno vê, com jest) e o modo leitura nos componentes do aluno que forem usados — executor — commit: —
- [ ] 2. Folha "Ver como o aluno" na `BarraDoPlano` (treino e dieta), e2e em 390 e 1280 px que confere que nada além de GET sai — executor-front — commit: —
- [ ] 3. Ajuda (`ajuda/conteudo.ts`, guias gerados de novo) e AGENTS.md — executor-rapido — commit: —

## Fora do escopo
- Prévia da mobilidade e do modelo do Planejamento (D6).
- Simular registros, recordes, "última vez" ou o progresso da semana do aluno.

## O que ficou para trás
- —
