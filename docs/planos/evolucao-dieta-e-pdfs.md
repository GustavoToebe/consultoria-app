# Dieta: modo de preparo, opções lado a lado e PDFs com a identidade da consultoria

Situação: Em andamento (código pronto na branch; falta rodar os testes de integração com Docker e juntar na `main`) · Onde: branch `evo-dieta-pdf` (worktree, sem push) · Atualizado: 28/10/2026

## Objetivo
A refeição da dieta ganha um "Modo de preparo" opcional (receita), as opções alternativas de uma refeição ficam mais
claras para o treinador (lado a lado no PC, com o total de cada uma) e para o aluno ("Escolha uma das opções"), e todos
os PDFs passam a ter o mesmo cabeçalho, com a logo da consultoria na faixa da marca.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Modo de preparo | Campo opcional da refeição (`modoDePreparo`), texto livre até 2000 caracteres, quebras de linha preservadas; sem rendimento, porções nem conversão | Gustavo |
| D2 | Substituições | Só apresentação: nenhuma equivalência calculada e nunca a palavra "equivalente"; a regra do total do dia (opção A) não muda | Gustavo |
| D3 | PDFs | Logo na faixa da marca e cabeçalho uniforme; temas de documento e prévia própria ficam para depois (o navegador e o compartilhar do celular já mostram prévia) | Gustavo |
| D4 | Sem migration | O conteúdo da dieta é JSON; o campo novo entra no `ConteudoDieta` sem mudar o banco | Gustavo |
| D5 | Onde o limite é conferido | `@Size(max = 2000)` no record (400 ao salvar, sem repetir o texto) e erro `refeicoes[i].modoDePreparo` no `ValidadorDieta` (publicar); no app, `maxLength` e `modoDePreparoValido` | Claude |
| D6 | Campo opcional no tipo do app | `Refeicao.modoDePreparo?: string \| null` (opcional), para não mexer nas fixtures de outras frentes (`listaDeCompras.test.ts`, e2e); `normalizarDieta` sempre o preenche | Claude |
| D7 | Largura das colunas das opções | Colunas de no mínimo 300 px pela largura do próprio cartão (`colunasDasOpcoes`); no PC com o menu lateral isso começa por volta de 1024 px de janela; no celular, empilhadas. Antes eram abas (uma opção por vez) | Claude |
| D8 | Aluno | Mantém as abas da opção (escolher uma), com "Escolha uma das opções: A ou B." acima e "Total da opção A" embaixo; modo de preparo fechado por padrão, "Modo de preparo" abre (como o "Como fazer" do exercício) | Claude |
| D9 | Logo na faixa | Quadro branco de até 18 pt de altura e 90 pt de largura (proporção mantida, nunca ampliada), antes do nome, para a logo ficar legível sobre qualquer cor da marca | Claude |
| D10 | Cabeçalho uniforme | `cabecalhoDoPdf` em `pdf/html.ts`: faixa (logo + nome da consultoria), tipo do documento em h1, título com " (vN)" ou "(RASCUNHO, não publicado)" / "(prévia, não publicada)", e à direita Aluno, Período e Emitido em; colunas com `min-width: 0` e `overflow-wrap: anywhere`. O antigo `topo` saiu | Claude |
| D11 | PDF da dieta | A capa (logo grande + "SUGESTÃO DE PLANO ALIMENTAR") virou o cabeçalho comum (documento "Sugestão de plano alimentar"); "Nome" e "Emitido em" saíram da tabela de identificação (já estão no cabeçalho) | Claude |
| D12 | Comparação de fotos | Não muda: a imagem é gerada no servidor (`ComparacaoDeFotosService`), sem texto; não é PDF do app | Claude |

## Passos
- [x] 1. Modo de preparo na API (`ConteudoDieta.Refeicao.modoDePreparo`, `MODO_DE_PREPARO_MAXIMO`, `ValidadorDieta`, `comItens`/`comUidsNovos`) com `ValidadorDietaTest` (sem Docker) e o caso novo em `DietaIntegrationTest` (salvar → publicar → aluno, cópia para outro aluno, modelo REFEICAO, 400 acima de 2000 sem eco, nada na auditoria) — commit: ver abaixo
- [x] 2. App: tipo, `normalizarDieta`, `novaRefeicao`, campo no editor (plano do aluno e modelo REFEICAO, o mesmo `CartaoRefeicao`), `aluno/ModoDePreparo` na dieta do aluno, PDF da dieta, ajuda — commit: ver abaixo
- [x] 3. Opções lado a lado no editor (`colunasDasOpcoes`, `OpcaoDaRefeicao`) e "Escolha uma das opções" no aluno e no PDF (`textoEscolhaDasOpcoes`) — commit: ver abaixo
- [x] 4. Cabeçalho uniforme dos PDFs com a logo na faixa (`cabecalhoDoPdf`, `faixaDaMarca(marca, logo)`) em treino, dieta, mobilidade, cargas e lista de compras — commit: ver abaixo
- [x] 5. PDF de exemplo pelo Chromium do Playwright (nomes longos, logo fictícia de 400×120, marca amarela sem logo): sem sobreposição, logo 80×24 px (proporção mantida) — ver "Conferência visual"
- [ ] 6. `mvn verify` com Docker (o caso novo do `DietaIntegrationTest`) — Gustavo

## Conferência visual (28/10, Chromium `page.pdf`, dados fictícios)
- Cinco PDFs + dieta sem logo, A4: as duas colunas do cabeçalho nunca se sobrepõem (título à esquerda até ~467 px de 794, dados a partir de ~483 px), nomes longos de consultoria, aluno e plano quebram linha; nenhum documento passou da largura da página.
- A logo fictícia (400×120) saiu com 80×24 px no quadro branco da faixa.
- Dieta: "Escolha uma das opções: A ou B." abaixo da faixa da refeição; "Modo de preparo" em caixa cinza no fim da refeição, com as quebras de linha.
- Visto, fora do escopo: com marca amarela (`#FFEB3B`) o h1 e os títulos de seção na cor da marca ficam com pouco contraste sobre branco (já acontecia com o nome da consultoria no h1 e nos títulos de seção). Ficou nas pendências.
- Lista de compras: o h1 "Lista de compras" do cabeçalho e o h2 "Lista de compras — Semana (7 dias)" do corpo repetem o nome; o corpo é da frente evo-compras, que pode trocar o h2 por só o período.

## Permissões nos PDFs (item 3 do pedido)
Conferido no código: nenhum PDF mostra campo que a tela esconde. Medicação e ergogênicos: a API manda `ergogenicos` nulo
sem `ERGOGENICO_LER` (rascunho e versão, `PlanoServiceBase.paraLeitura`) e o PDF usa `ergogenicosPreenchidos(null)` = nada.
Peso no PDF da dieta do treinador: `GET /alunos/{id}/pesos` exige `ALUNO_SENSIVEL_LER`; sem ela dá 403 e o
`gerarPdfDoPlano` usa lista vazia (a ficha também não mostra o peso). Observação da série no PDF de cargas: a API manda
nula sem `ALUNO_SENSIVEL_LER`. O cabeçalho novo só traz consultoria, tipo, título, versão, aluno, período e emissão.

## Fora do escopo
- Temas de documento e prévia própria do PDF: depois (decisão do Gustavo).
- Lista de compras (`dominio/listaDeCompras.ts`, `ui/ListaDeCompras`, corpo do `pdfListaDeCompras.ts`): frente evo-compras; continua pelos ingredientes. Aqui só a chamada do cabeçalho mudou.
- Avaliação física (frente evo-avaliacao): usará `cabecalhoDoPdf` (documentado em `pdf/html.ts`, sem `versao` = documento sem versão).

## O que ficou para trás
- Rodar o `DietaIntegrationTest` com Docker (não há Docker nesta máquina).
- Contraste do h1 e dos títulos na cor da marca quando a marca é clara (amarelo): decidir junto com os temas de documento.
- Conferir no celular (APK) o editor com as opções empilhadas e o modo de preparo do aluno.

## Texto para o AGENTS.md
Acrescentar ao item "Água por dia" (ou como item próprio logo depois dele):

- Modo de preparo e opções da refeição (28/10, `docs/planos/evolucao-dieta-e-pdfs.md`): `ConteudoDieta.Refeicao.modoDePreparo` (opcional, texto livre até `MODO_DE_PREPARO_MAXIMO` = 2000, quebras de linha preservadas; `@Size` dá 400 ao salvar sem repetir o texto e o `ValidadorDieta` dá erro em `refeicoes[i].modoDePreparo` ao publicar; nunca em log nem auditoria) é só mostrado: sem rendimento, porção nem conversão. `comItens`/`comUidsNovos` o levam, então copiar para outro aluno, aplicar modelo (inclusive a refeição pronta `REFEICAO`) e replicar levam o campo; a anonimização apaga a dieta inteira. App: campo "Modo de preparo (opcional)" no `treinador/dieta/CartaoRefeicao` (plano e modelo), `aluno/ModoDePreparo` (fechado por padrão) na dieta do aluno e bloco "Modo de preparo" no fim da refeição no PDF; regras em `dominio/dieta` (`modoDePreparoValido`, `modoDePreparoParaMostrar`; `Refeicao.modoDePreparo` é opcional no tipo e `normalizarDieta` sempre o preenche). Opções são alternativas e só de apresentação (nada calculado entre elas, nunca "equivalente"; o total do dia segue só a opção A): no editor ficam lado a lado em colunas de 300 px ou mais pela largura do cartão (`colunasDasOpcoes`, `OpcaoDaRefeicao`; no celular empilhadas), cada uma com "Total da opção X" ("—" no que falta); o aluno e o PDF leem "Escolha uma das opções: A ou B." (`textoEscolhaDasOpcoes`). Testes: `ValidadorDietaTest`, `DietaIntegrationTest`, `dominio/dieta.test.ts`, `e2e/dieta-opcoes-e-preparo.spec.ts`.

Trocar, no item "PDFs" de "App: convenções", a frase da logo e do topo por:

- Todo PDF começa por `cabecalhoDoPdf` (`pdf/html.ts`): `faixaDaMarca(marca, logo)` (cor da marca, a logo num quadro branco de até 18 × 90 pt com a proporção mantida, e o nome da consultoria) e o bloco `.topo` (tipo do documento em h1, título com " (vN)", `semVersao` para o não publicado, e Aluno, Período e Emitido em à direita; `versao` ausente = documento sem versão; colunas com `min-width: 0` e `overflow-wrap: anywhere`, nome longo quebra sem sobrepor). Treino, dieta (a capa saiu; "Nome" e "Emitido em" só no cabeçalho), mobilidade, cargas e lista de compras usam o mesmo; PDF novo (avaliação física) também. Testes: `pdf/pdf.test.ts` ("cabeçalho uniforme", "faixa da marca") e `pdf/injecao.test.ts` (logo e modo de preparo atacados).
