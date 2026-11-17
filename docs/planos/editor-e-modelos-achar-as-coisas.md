# Editor de treino e modelos: achar as coisas

Situação: Planejando (plano pronto, esperando o Gustavo confirmar as recomendações; nenhum código) · Onde: main · Atualizado: 16/11/2026

Fonte: pedidos da reunião de 15/11 (IDs R1115-Cxx) e leitura do código em 16/11/2026. Validade: vale enquanto `CartaoExercicio`, `FolhaReceitas`, `FolhaSalvarReceita` e `planejamento/index.tsx` não mudarem; se mudarem, refazer "Conferido no código".

## Objetivo
Na reunião o treinador do piloto montou o treino no editor e não achou controles que já existem (trocar exercício, receita de séries, onde criar receita). Viu o exercício novo cair no fim sem como subir, aplicou uma receita que apagou o que tinha montado e rejeitou o modelo de dia. Diretriz do pedido: deixar tudo à vista. Ao fim: Trocar, Subir e Descer têm texto em qualquer largura e aparecem na linha da lista; o exercício novo entra logo depois do selecionado; a receita pergunta se substitui ou acrescenta; "Usar receita" e "Criar receita" são fáceis de achar; "Organizar coleções" mostra só as coleções da área aberta; salvar um modelo já pergunta a coleção; o modelo de dia some da tela. Quase tudo é texto, posição e esconder, **sem contrato novo** (só app).

## Conferido no código (16/11/2026)
- Confirmado: `moverExercicio` (`app/src/dominio/combinacoes.ts:271`) e `removerExercicio` (`:308`) existem e `inserirExerciciosApos` **não existe**; `agruparPorColecao` (`dominio/colecoes.ts:23`) existe e `colecoesDaArea` **não existe**; `LIMITE_SERIES = 30` (`dominio/editorTreino.ts:130`) e `seriesDaReceita` (`:483`), sem `acrescentarSeries`; `CartaoExercicio.tsx:68` calcula `largo` por `LARGURA_MENU_LATERAL` (768, `tokens.ts:568`) e só então mostra "Trocar" em texto (`:195-198`; abaixo é `IconeBotao`); botão "Receita de séries" com `rotuloAcessivel="Usar uma receita de séries"` em `:144`; `[...lista, ...novos]` em `treinador/treino/EditorDeTreino.tsx:503` e `exercicioSelecionadoUid` em `:113`; "Adicionar dia de treino" em `treinador/treino/FolhasDoTreino.tsx:57,76`; "Salvar como dia de treino" via `aoSalvarModelo` em `CartaoSessao.tsx:36,76`; `SESSAO_TREINO` em `treinador/planejamento/modelos.ts:14,27,73`; seções recolhíveis em `treinador/FolhaReceitas.tsx:91`; prefixo "Técnica: " em `dominio/receitasDeSeries.ts:112`; `OrganizarColecoes` em `app/treinador/planejamento/index.tsx:167,211` e campo "Coleção" em `:202`; `criarPastaModelo` em `api/rotas.ts:1084`; `criarReceita` aceita `pastaId` (uso em `FolhasDoTreino.tsx:131`); `ItemDaListaDoEditor` usado também pela dieta (`EditorDeDieta.tsx:36`); `ALVO_TOQUE = 44` (`tokens.ts:563`); `FolhaBiblioteca.tsx` fica em `treinador/treino/`.
- **Não conferido** (linhas do rascunho, base antiga): `ItemDaListaDeExercicios` (`ListaDeExercicios.tsx:52`), `EditorDeTreino.tsx:365-369,433`, `FolhaReceitas.tsx` linhas de aviso e de estado vazio, `FolhasDoTreino.tsx:84-108,124-150`, `FolhasDaDieta.tsx:77,139`, `EditorDeMobilidade.tsx:132`, `CartaoPastas.tsx:299`, `PlanoDtos.java:64` (`SalvarComoReceitaRequest`), `SeletorDeSessoes.tsx:104`, o corte em 80 resultados da `FolhaBiblioteca`, todos os números de linha dos e2e e as contagens de uso (`IconeBotao` em 57 arquivos, `ajuda/conteudo.ts`).

## Itens da reunião cobertos
| ID | Pedido | Situação hoje | Tipo de mudança | Passo |
| --- | --- | --- | --- | --- |
| R1115-C74 | Etiqueta do dia maior (a reclamação era do concorrente; cor vai em outro plano) | Para decidir | Apresentação (opcional) | 10 |
| R1115-C76 | "Digitei em Adicionar exercício e não apareceu" | Testar de novo (sem defeito provado) | Comportamento, só se reproduzir | 11 |
| R1115-C77 | "Trocar exercício" existe e ninguém acha | Parcial (texto só a partir de 768 px, ícone sem dica abaixo) | Apresentação | 4, 5 |
| R1115-C78 | Exercício novo cai no fim; não dá para subir | Parcial (só setas, só ícone, só no cartão aberto; arrastar não existe) | Comportamento e apresentação | 1, 3, 4, 5 |
| R1115-C81 | Aplicar receita apaga o que já estava montado | Para decidir | Comportamento | 1, 6 |
| R1115-C83 | Receitas em categorias, estilo playlist | Parcial (há seções por bloco e técnica, mas nascem abertas) | Apresentação | 6 |
| R1115-C84 | Onde criar formato novo de receita | Respondido (falta atalho) | Apresentação | 6 |
| R1115-C85 | "Organizar coleções" mostra a dieta dentro de Treino | Falta | Comportamento (só no app) | 1, 8 |
| R1115-C86 | Modelos soltos, "sem coleção" | Para decidir | Comportamento | 9 |
| R1115-C87 | Escolher e criar a coleção ao salvar o modelo | Parcial (o Planejamento já escolhe; o salvar do editor não) | Comportamento | 9 |
| R1115-C88 | Categoria para três tipos: "ficaria muita coisa" | Para decidir (some com C85 e C89) | Nenhuma própria | 8 |
| R1115-C89 | Modelo de dia rejeitado | Falta | Esconder, sem apagar dado | 2 |
| R1115-C90 | Metodologia é uma só | Validado na reunião | Nenhuma (orientação) | — |
| R1115-C97 | "Usar receita" passa despercebido (só nome e posição; cor em outro plano) | Para decidir | Apresentação | 7 |

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | C76: reproduzir antes de mexer; não há defeito provado. O corte de resultados da `FolhaBiblioteca` entra pelo padrão "mostrar mais" do plano da dieta, se ele já estiver pronto | Passo 11 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D2 | C77: texto "Trocar" visível em qualquer largura e o atalho de trocar também na linha da lista | Passos 4 e 5 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D3 | C78: exercício novo entra logo depois do selecionado (sem selecionado, no fim; dentro de grupo, depois do grupo inteiro); Subir e Descer ganham texto e aparecem na linha da lista. Arrastar fica fora, junto com o arrastar da dieta | Passos 1, 3, 4, 5 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D4 | C81: exercício com séries, a folha oferece "Substituir séries" e "Acrescentar ao fim" (limite de 30); sem séries, aplica direto; o Desfazer continua | Passo 6 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D5 | C97 + C84: o botão passa a se chamar "Usar receita" (hoje "Receita de séries", `CartaoExercicio.tsx:144`; manter o `rotuloAcessivel`) e a folha de receitas ganha o atalho "Criar receita" | Passos 6 e 7 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D6 | C83: seções da folha de receitas recolhidas por padrão quando há mais de uma, com o nome da técnica em destaque; a busca reabre tudo | Passo 6 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D7 | C89: esconder o modelo de dia (chip, "Adicionar dia de treino", "Salvar como dia de treino") sem apagar dado, API nem migration. Remover de verdade é lote futuro, depois da reunião de feedback: tira o tipo `SESSAO_TREINO`, os dias de fábrica da V063 e uma migration | Passo 2; remoção fora do escopo | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D8 | C85 + C88: "Organizar coleções" e o campo "Coleção" do formulário mostram só as coleções da área aberta, filtrando no app; coleção vazia aparece em todas as áreas; a coleção continua uma só | Passo 8, sem migration | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D9 | C87 + C86: ao salvar modelo ou receita, escolher a coleção, com "Nova coleção" ali mesmo | Passo 9 | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D10 | Como gravar a coleção ao salvar semana ou dieta: **sem contrato**, salvar e depois `alterarReceita` com a `pastaId` (duas chamadas; se a segunda falhar, o modelo fica salvo sem coleção e o app avisa). A alternativa (`pastaId` opcional em `SalvarComoReceitaRequest`, quatro controllers, testes Java) fica de fora | A receita de séries usa `criarReceita`, que já aceita `pastaId` | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D11 | "Sem coleção" nasce recolhida quando há ao menos uma outra coleção com modelos; a busca reabre. Hoje todas nascem abertas de propósito (a lista existe para achar o modelo) | Passo 9c | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D12 | Ações na linha da lista (passo 5): Trocar, Subir e Descer em texto numa segunda linha do item, em todas as linhas; se estourar a coluna (240 a 360 px), só na linha escolhida | O Gustavo escolhe olhando as capturas do executor-front | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D13 | "Usar receita" também no estado vazio das séries ("Nenhuma série ainda." ganha "Usar receita" antes dos botões de tipo) | Passo 7b | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D14 | C74, etiqueta do dia maior: não fazer antes de o treinador confirmar se vale para o chip de sessão do Overtraining | Passo 10 parado | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D15 | **Revisão de 17/11/2026:** C81 confirmado: com séries, duas ações, "Substituir as séries" (como hoje, com desfazer) e "Acrescentar ao fim" (uids novos, com desfazer); sem séries, uma ação só; a regra pura vai em `dominio/` com teste (`executor-front`, Onda 3H) | Gustavo, 17/11 |
| D16 | C97: "Receita de séries" passa a "Usar receita" (botão, folha, Ajuda, e2e); nova variante `destaque` do `Botao` (fundo tingido a 12% da cor de informação do tema, texto e ícone na cor de informação, contraste nos três temas em `contrasteDasPecas.test.ts`) em "Usar receita", "Modelos prontos" e "Adicionar refeição" (C94); continua um primário por área; registrar no `design-e-front.md` (ver [hierarquia-visual-tres-temas.md](hierarquia-visual-tres-temas.md)) | Gustavo, 17/11 |
| D15 | Nome "coleção" fica até se decidir o nome de aulões e playlists (ver `comunidade-playlists.md`), para trocar tudo por busca e substituição | Passo 9 nasce com "coleção" | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D16 | C90: metodologia "uma só" é orientação; nada no código | — | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D17 | Cor do botão "Usar receita" e da etiqueta do dia não entra aqui; vai em `areia-contraste-e-cor.md` | Passo 7 só nome e posição | Decidido pela recomendação em 16/11, conferir com o Gustavo |
| D18 | Sem camada de compatibilidade nem migração de legado | `AGENTS.md` | Regra do projeto |
| D19 | Botões novos com alvo de toque de 44 px e fonte mínima de 12 | `ALVO_TOQUE = 44` (`tokens.ts:563`); `docs/design-e-front.md` | Regra do projeto |

## Passos
- [ ] 1. Regra pura e testes: inserir exercícios depois de um ponto, coleções da área, acrescentar séries com limite — executor: executor · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - `app/src/dominio/combinacoes.ts`: nova `inserirExerciciosApos(s, ancora, novos)` ao lado de `moverExercicio`. A âncora é um exercício ou um grupo; sem âncora, no fim. Se o exercício está dentro de um grupo, inserir depois do grupo inteiro (os membros são ligados por `grupoUid` e precisam ficar contíguos; separar faz o validador recusar publicar). Teste em `combinacoes.test.ts`.
  - `app/src/dominio/colecoes.ts`: nova `colecoesDaArea(colecoes, modelos, tiposDaArea, manter?)`: entram a coleção com modelo de algum tipo da área, a coleção sem nenhum modelo e a `manter` (a atual do modelo que se edita). Teste em `colecoes.test.ts`.
  - `app/src/dominio/editorTreino.ts`: nova `acrescentarSeries(atuais, novas)` ao lado de `seriesDaReceita`; devolve nulo acima de `LIMITE_SERIES`. Teste em `editorTreino.test.ts`.
- [ ] 2. Esconder o modelo de dia (C89) — executor: executor-rapido (revisão do diff pela sessão principal) · tamanho: M · migration: não · APK: não · API: nenhuma (não apagar dado, rota nem coluna) · commit: —
  - Sai da tela: chip "Dias de treino" (tirar `'SESSAO_TREINO'` do grupo Treino em `planejamento/modelos.ts:27`), opção "Adicionar dia de treino" e os casos `sessao`/`salvarSessao` em `FolhasDoTreino.tsx`, item "Salvar como dia de treino" do ⋯ da sessão (`CartaoSessao.tsx:76`) e a prop `aoSalvarModelo` passada pelo `EditorDeTreino`.
  - Fica de propósito: `TipoReceita` e os `Record<TipoReceita, ...>` (o compilador exige), o modo `unica` do editor, a rota por endereço direto de um dia de fábrica, API, banco e os dias da V063. É código sem entrada na tela; sai no lote futuro.
  - "Importar de texto" continua para semana e plano do aluno; só o modo `unica`, alcançado pelo modelo de dia, perde a entrada. Pacote não referencia modelo de dia (hipótese do rascunho, `EditorModelo.tsx` não reconferido).
  - Risco: com a opção "dia" fora, o "Usar modelo" da sessão vazia abre só "Usar semana de treino", que troca as sessões do plano inteiro (a folha já avisa e há Desfazer). Não mudar o botão: um e2e o espera na sessão vazia (`editor-clareza.spec.ts`, linha não reconferida).
  - Testes: `planejamento-colecoes.spec.ts` (chip "Dias de treino") e `editor-de-treino-reorganizado.spec.ts` (⋯ da sessão), `modelos.test.ts` e `receitasDeSeries.test.ts`. Os e2e que só usam `SESSAO_TREINO` como resposta falsa de rota seguem.
- [ ] 3. Exercício novo entra depois do selecionado (C78) — executor: executor · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - `treinador/treino/EditorDeTreino.tsx:503`: trocar `[...lista, ...novos]` por `inserirExerciciosApos`, via `mudarGrupos` (não `mudarExercicios`, porque a regra mexe em exercícios e grupos). Âncora = seleção explícita (`exercicioSelecionadoUid`, `:113`, ou o grupo escolhido); não usar `escolhidoEm(true)`, que em duas colunas devolve o primeiro exercício mesmo sem toque (hipótese do rascunho, não reconferida). O cardio entra pelo mesmo caminho.
  - O primeiro dos novos continua escolhido; mostrar aviso "Adicionado depois de “X”." só quando não foi para o fim. Não mexer na troca de exercício.
  - Testes: e2e (selecionar o 2º de 4, adicionar, conferir o novo em 3º; sem seleção, vai ao fim; selecionado dentro de grupo, entra depois do grupo). Conferir os outros e2e que usam "Adicionar exercício": sem seleção continuam no fim.
- [ ] 4. Trocar, Subir e Descer com texto em qualquer largura (C77, C78) — executor: sessão principal · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - `treinador/treino/CartaoExercicio.tsx:195-198`: `Trocar` vira `Botao` com texto em qualquer largura (hoje só com `largo` ≥ 768 px); `Subir` e `Descer` também ganham texto (hoje só `IconeBotao`). Remover e Abrir/Fechar continuam em ícone. Manter os nomes acessíveis (`Trocar ${nome}`, `Subir ${nome}`, `Descer ${nome}`). `CartaoGrupo.tsx`: mesmo texto em Subir e Descer do grupo. Apagar o comentário `acoesLargas` desatualizado.
  - Não mexer em `IconeBotao` (peça compartilhada por dezenas de arquivos): sem dica global. Conferir a faixa do exercício a 390 px, sem rolagem lateral.
- [ ] 5. Ações na linha da lista (C77, C78) — executor: executor-front · tamanho: M · migration: não · APK: não · API: nenhuma · commit: —
  - A linha da lista em duas colunas é `ItemDaListaDeExercicios` sobre `ItemDaListaDoEditor` (`treinador/plano/ItemDaListaDoEditor.tsx`), hoje um `Pressable` só. Acrescentar uma área de ações **opcional** (dieta e mobilidade não mudam) com Trocar, Subir e Descer em texto; o item vira um contêiner com o `Pressable` principal e a linha de ações ao lado, sem botão dentro de botão. O `EditorDeTreino` passa as ações a cada linha (hoje só ao escolhido).
  - Seguir D12 com capturas a 1280 px e `docs/design-e-front.md` (seleção neutra, regra de toque). Não pode quebrar `ItemDaListaDoEditor` na dieta e na mobilidade (`editor-mobilidade.spec.ts`).
- [ ] 6. Folha de receitas: Substituir ou Acrescentar, seções recolhidas, "Criar receita" (C81, C83, C84) — executor: executor · tamanho: M · migration: não · APK: não · API: nenhuma · commit: —
  - C81: `FolhaReceitas.tsx` recebe se o exercício tem séries e quantas. Sem séries: "Aplicar receita" direto. Com séries: o aviso e dois botões, "Substituir séries" e "Acrescentar ao fim" (desabilitado com motivo acima de 30). `aoUsar` passa a receber o modo; `ModeloSimples` ignora. Em `FolhasDoTreino.tsx` (caso `receitaSeries`), no modo acrescentar concatenar com `acrescentarSeries` e o Desfazer diz "acrescentada ao fim". Só o ramo SERIES muda.
  - C83: com mais de uma seção, todas nascem recolhidas (hoje `recolhidas` começa vazio, `FolhaReceitas.tsx:91`); com uma só, aberta; buscar abre tudo. Avaliar tirar o prefixo "Técnica: " (`receitasDeSeries.ts:112`) e ajustar `receitasDeSeries.test.ts`.
  - C84: prop opcional `aoCriar`, só no caso `receitaSeries`. Botão "Criar receita" no topo da folha e no estado vazio: salva o rascunho e abre `/treinador/planejamento` com `{ aba: 'treino', tipo: 'series', novo: '1' }` (padrão de `TelaImportacao`, não reconferido). Conferir que o editor de modelo também salva.
  - Usos de `FolhaReceitas` que não mudam: refeição pronta e dieta, mobilidade, pacote, metodologia. e2e a ajustar: `editor-clareza.spec.ts`, `metodologia.spec.ts`, `series-metodologia.spec.ts` (aplicar vira "Substituir…", seções fechadas).
- [ ] 7. "Usar receita": nome e posição (C97) — executor: sessão principal · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - 7a. `CartaoExercicio.tsx:144`: `rotulo="Usar receita"`; manter `rotuloAcessivel="Usar uma receita de séries"` (e2e o usam com `exact`). A cor não entra (D17).
  - 7b. (D13) `treino/EditorSeries.tsx`: prop opcional `aoUsarReceita` que mostra "Usar receita" no estado vazio; o editor de modelo do Planejamento não passa a prop; `CartaoExercicio` repassa só quando não é cardio. Depois do passo 4 (os dois mexem em `CartaoExercicio.tsx`).
- [ ] 8. "Organizar coleções" e o formulário só com as coleções da área (C85, C88) — executor: executor · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - `planejamento/index.tsx:167,211` (`OrganizarColecoes`) recebe `colecoesDaArea(...)`; título e texto dizem a área ("Coleções de treino"). `:202` (campo "Coleção" do formulário): mesma lista, mantendo a coleção atual do modelo (`manter`).
  - Excluir: a coleção pode ter modelos de outras áreas; a mensagem diz quantos modelos passam para "Sem coleção" e quantos são de outras áreas. Limite aceito (D8): coleção criada em Treino e ainda vazia aparece também em Dieta até receber um modelo.
  - e2e: `planejamento-colecoes.spec.ts` e caso novo (coleção só de dieta não aparece em Treino; coleção vazia aparece). Atualizar o `AGENTS.md` (item do Planejamento no app).
- [ ] 9. Salvar modelo ou receita já escolhendo a coleção (C87, C86) — executor: executor · tamanho: M · migration: não · APK: não · API: nenhuma (D10, duas chamadas existentes) · commit: —
  - 9a. `treinador/FolhaSalvarReceita.tsx` (hoje nome e descrição): campo "Coleção" com as coleções da área, "Sem coleção" e "Nova coleção" com nome na hora (`criarPastaModelo`). `aoSalvar` passa a receber a `pastaId`.
  - 9b. As chamadas que usam a folha (treino em séries e semana, dieta, mobilidade, pacote) passam a `pastaId`; semana e dieta fazem `alterarReceita` depois. Se a coleção falhar depois de salvar, avisar e manter o modelo salvo. Coordenar com o plano da dieta, que também mexe em `FolhasDaDieta.tsx`.
  - 9c. (D11) "Sem coleção" nasce recolhida quando há outra coleção com modelos. Ajustar `planejamento-colecoes.spec.ts` e o `AGENTS.md`.
  - Testes: e2e de salvar série com coleção existente e nova; e2e da semana com a segunda chamada falhando (aviso).
- [ ] 10. Etiqueta do dia maior (C74) — executor: sessão principal · tamanho: P · migration: não · APK: não · API: nenhuma · commit: — (só depois de D14 ser revertida pelo treinador)
  - `SeletorDeSessoes.tsx` (fonte do chip) e a faixa "Segunda · Treino" do `CartaoSessao.tsx`. Só apresentação, sem cor.
- [ ] 11. Reproduzir "digitei e não apareceu" (C76) — executor: Gustavo, depois executor se reproduzir · tamanho: P · migration: não · APK: não · API: nenhuma · commit: —
  - Reproduzir em 390 e 1280 px, com a biblioteca da conta e com uma de mais de 80 exercícios, digitando em "Buscar na biblioteca". Hipóteses, não confirmadas: (a) a lista depende da biblioteca ter carregado; (b) em "Adicionar exercício" o toque só marca e o treino só muda no rodapé, o que parece "não apareceu". Se for só (b), um texto curto ao lado do campo; se reproduzir, corrigir a causa. Sem reprodução, não mexer.
- [ ] 12. Documentação, verificação e capturas — executor: executor-rapido (docs e verificação), Gustavo (APK) · tamanho: P · migration: não · APK: sim (conferir no celular; sem `expo-updates` em `app/package.json` e `app/app.json`) · API: nenhuma (sem `mvn verify`) · commit: —
  - `AGENTS.md` (Planejamento no app, "Usar receita", Substituir/Acrescentar, seções recolhidas), `docs/design-e-front.md` (item da lista com ações), Ajuda (`ajuda/conteudo.ts`); se o texto do guia mudar, `node scripts/guias/gerar.mjs` e versionar os PDFs.
  - `npm run typecheck && npm run lint && npm test` em `app/` e os e2e citados. Capturas a 390 e 1280 px, claro e escuro: faixa do exercício, linha da lista, folha de receitas (recolhida e aberta, com e sem séries), "Organizar coleções" em Treino e em Dieta, folha de salvar com coleção.

## Critérios de aceite
- A 390 px e a 1280 px, web e APK novo, claro e escuro: sem rolagem lateral e alvo de 44 px nos botões novos.
- Em qualquer largura a faixa do exercício mostra "Trocar", "Subir" e "Descer" em texto; em duas colunas as três ações estão na linha da lista; o nome acessível continua com o nome do exercício.
- Com o 2º de 4 exercícios selecionado, "Adicionar exercício" põe o novo em 3º e o escolhe; sem seleção, vai ao fim; com membro de grupo selecionado, entra depois do grupo inteiro e o grupo continua válido.
- Exercício com séries: a folha mostra "Substituir séries" e "Acrescentar ao fim"; o Desfazer devolve o estado anterior; acima de 30 séries o acrescentar fica desabilitado com motivo. Sem séries, aplica direto.
- A folha de receitas abre com as seções recolhidas (mais de uma), a busca as abre, e "Criar receita" leva ao Planejamento sem perder o rascunho. O botão do exercício se chama "Usar receita".
- Planejamento > Treino não mostra "Dias de treino"; "Modelos prontos" não oferece "Adicionar dia de treino"; o ⋯ da sessão não oferece "Salvar como dia de treino"; nenhum dado, rota ou migration mudou.
- "Organizar coleções" em Treino não lista coleção que só tem modelo de dieta; coleção vazia aparece em todas as áreas; excluir avisa de modelos de outras áreas. Salvar receita de séries ou semana pergunta a coleção e cria "Nova coleção" ali mesmo.
- O treinador diz "resolvido" quando, sem ajuda, troca um exercício, sobe o novo, aplica uma receita sem perder o que montou e acha onde criar receita.

## Riscos e revisão
- Inserir no meio é a única mudança com risco de dados: sem a regra do grupo (passo 1) o exercício novo separa os membros e a publicação é recusada. Por isso a regra é pura e testada antes da tela.
- Substituir/Acrescentar muda o contrato do `aoUsar` da `FolhaReceitas`, compartilhada por dieta, mobilidade, pacote e metodologia: conferir que os outros usos não recebem o modo.
- Inserir depois do selecionado surpreende quem tocou no exercício 2 e esperava o fim: o aviso do passo 3 e o novo escolhido na tela mitigam.
- A janela de coleções filtrada esconde coleção de outra área; o aviso de exclusão do passo 8 evita apagar sem ver o efeito.
- Revisão: só a do diff pela sessão principal. Não toca segurança, autenticação, isolamento de dados, migration nem contrato de API (com D10).

## Fora do escopo
- Arrastar exercício na lista (C78): componente novo a decidir, junto com o arrastar da dieta.
- Cor do botão "Usar receita" (C97) e da etiqueta do dia (C74): `areia-contraste-e-cor.md`.
- Remover o modelo de dia de verdade (C89: tipo `SESSAO_TREINO`, dias da V063, migration): lote futuro (D7).
- Coleções de fábrica pré-definidas (C86): exigem nomes do treinador e migration Java idempotente como a V063; mexem no que todo treinador novo recebe.
- Coluna de área na coleção (opção com migration de C85): o filtro no app basta enquanto a coleção for uma só.
- Limite de uma metodologia por consultoria (C90): é orientação.
- Editar o exercício da biblioteca a partir do plano (C76): não existe e não foi pedido.

## O que ficou para trás
- (nada ainda)
