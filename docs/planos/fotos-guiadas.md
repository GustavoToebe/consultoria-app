# Fotos guiadas (lugares nomeados na pergunta FOTOS)

Situação: Em andamento (plano escrito antes do código, 16/11/2026) · Onde: main · Atualizado: 16/11/2026

Fonte: pedido do Gustavo de 16/11 (Lote C, itens 6 e 7) e mapa do código em 16/11/2026, base `0fa84b91`. Validade: vale enquanto a pergunta FOTOS só tiver `max` (1 a 6) e `FotoService.ligar` só gravar `pergunta_id`. Sem migration: nada aqui disputa a fila de V080+.

## Objetivo
O treinador dá nome aos lugares das fotos de uma pergunta FOTOS ("Frente", "Costas", "Lado direito"…). O aluno vê um guia com um espaço por lugar e um texto fixo, sem opinar sobre o corpo; o treinador vê cada foto pelo nome do lugar.

## O que existe hoje (conferido)
- FOTOS só tem `max` de 1 a 6 (`ConteudoQuestionario.java:47-48,70`, `LimitesQuestionario.FOTOS_POR_PERGUNTA = 6`, `ValidadorQuestionario` :58,:132,:228-229,:465-466,:483-484, `ValidadorAtualizacao.fotos` :274-292).
- A resposta é a lista de ids das fotos; `FotoService.ligar` só grava `atualizacao_foto.pergunta_id`: **a ordem das fotos só existe na lista da resposta**. A linha do tempo e a comparação (`ComparacaoDeFotosService`) leem `atualizacao_foto` e rotulam pelo `rotulo` da pergunta.
- App: `dominio/questionario.ts`, `respostasAtualizacao.ts`, `editorQuestionario.ts`, `PropriedadesDaPergunta.tsx`, `SecoesDoQuestionario.tsx`, `CampoFotos.tsx`, `fotosAtualizacao.ts`, `ResumoDaAtualizacao.tsx`. Fixtures: só por `scripts/questionario/gerar-fixtures.mjs`.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Contrato | `lugares` opcional na pergunta FOTOS: até `max` itens, nome de 1 a 40 caracteres depois do strip, sem repetir (sem diferença de maiúsculas); sem `lugares` tudo segue como hoje | recomendação desta sessão (o Gustavo confirma) |
| D2 | Resposta | continua a lista de ids; a foto de posição i é o lugar i; sem buraco (o aluno preenche em ordem) | recomendação desta sessão |
| D3 | Sem migration | a posição na resposta basta; não se grava o lugar em `atualizacao_foto` | recomendação desta sessão |
| D4 | Onde o nome aparece | detalhe da atualização e Resumo do treinador; **linha do tempo e comparação ficam com o rótulo da pergunta** (pendência) | recomendação desta sessão |
| D5 | Texto ao aluno | fixo, sem opinião sobre o corpo ("Tire a foto no lugar indicado"); nada de interpretação | regra do projeto (`AGENTS.md`) |
| D6 | Item 6 (reordenar séries) | já existe por setas ↑↓ (`moverGrupo`, `EditorSeries.tsx:119`); sem trabalho | conferido em 16/11 |

## Passos
- [ ] 1. Plano e entrada no README — commit: este
- [x] 2. API + regra pura (`executor`): `lugares` em `ConteudoQuestionario`, `ValidadorQuestionario`, `ValidadorAtualizacao` (resposta com mais fotos que lugares ou buraco = erro), `dominio/questionario.ts`, `respostasAtualizacao.ts`, fixtures por `gerar-fixtures.mjs` (casos válidos e inválidos), `AGENTS.md` — commit: ver `git log` ("Fotos guiadas: lugares na pergunta FOTOS"); decisão do executor: `max` do editor acompanha `lugares.length`, repetição ignora caixa e acento como as opções; testes unitários rodaram, `mvn verify` entra no passo 4
- [ ] 3. Editor e tela do aluno (`executor-front`, depende do 2): campo "Lugares das fotos" no `PropriedadesDaPergunta`, guia com um espaço por lugar no `CampoFotos`, treinador vê o nome no detalhe e no Resumo — commit: —
- [ ] 4. Verificação: `mvn verify` (fila única), typecheck, lint, jest, e2e das telas mexidas em 390 e 1280 — commit: —

## Fora do escopo
- Lugar na linha do tempo e na comparação (precisaria gravar o lugar por foto; migration).
- Pular um lugar no meio (D2).

## O que ficou para trás
- (preencher na entrega e copiar para "Pendências soltas")
