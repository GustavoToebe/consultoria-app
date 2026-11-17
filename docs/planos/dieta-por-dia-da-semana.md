# Dieta por dia da semana (ciclo de carboidrato)

Situação: Passos 1 a 6 feitos (contrato do app e da API, editor, tela do aluno, PDF e lista de compras, Ajuda); falta o passo 7 (verificação final, revisão e APK novo) · Onde: `main` (passos 1 a 5 commitados; o 6 sem commit) · Atualizado: 17/11/2026 · Base: rascunho sobre 61dc3a5a, implementado a partir do HEAD 1f33299d · Validade: até alguém mexer em `dieta/ConteudoDieta.java`, `ValidadorDieta.java`, `dominio/dieta.ts` ou `EditorDeDieta.tsx`

## Objetivo
O Saraiva prescreve dieta que muda conforme o dia (ciclo de carbo: dias de mais carbo e dias de zero carbo) e hoje manda
dois PDFs para o mesmo aluno, porque o app só guarda uma dieta por aluno. Ele viu o concorrente com as variações da
ficha, cada uma com seus dias da semana, e pediu o mesmo aqui, com um botão para duplicar a variação e trocar só o carbo.
Quando a frente acabar: o treinador monta variações dentro da dieta do aluno, marca os dias de cada uma, duplica e muda só
o carbo; o aluno abre a dieta no dia de hoje e vê a variação daquele dia; o PDF e a lista de compras entendem a semana.
Vem depois da frente "Dieta pronta para o Saraiva começar a usar" (`dieta-pronta-para-comecar.md`).

## Itens da reunião cobertos
| ID | Pedido | Situação hoje | Tipo de mudança | Passo |
| --- | --- | --- | --- | --- |
| R1115-C64 | Dieta com variação por dias da semana, dias selecionáveis no topo | Falta (só o treino tem dia: `Sessao.diaSemana`, `ValidadorTreino.java:80-84`) | contrato (JSON da dieta) + regra pura + tela do treinador e do aluno + PDF | 2 a 6 |
| R1115-C65 | Duplicar a variação já com dias marcados e trocar só o carbo | Falta (duplicar só existe para pasta e modelo) | comportamento sobre C64 | 2 e 4 |
| R1115-C60 | Só a parte "dias da semana acima do Total do dia" | Parcial (o Total do dia já fica acima das refeições, kcal em destaque; sem dias: `treinador/dieta/EditorDeDieta.tsx:172`) | tela | 4 e 5 |
| R1115-C69 | Anel que enche conforme o aluno marca as refeições | Fora do escopo (depende desta frente: a marcação precisa saber a variação do dia) | só restrição de desenho | — |
| R1115-C92 | Pacote treino + dieta + mobilidade com a dieta tendo variações | Validado na reunião; o pacote leva a dieta inteira (`receitas/ConteudoPastaModelo.java:10`), mas só levará as variações se a cópia as carregar | contrato (cópia) | 3 e 7 |

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Onde moram as variações | dentro do conteúdo da dieta: `ConteudoDieta.variacoes[]` (identificador, rótulo, dias da semana, refeições); sem coluna nova (migration só se for preciso reescrever dietas já gravadas, o que não é obrigatório) | recomendação da análise de 16/11 (o Gustavo confirma) |
| D2 | Quantas dietas ativas | continua **uma** dieta ativa por aluno. "Mais de uma dieta ativa" fica descartada: contraria o índice único `ux_plano_dieta_ativo` (`V001__inicial.sql:801`) e obrigaria a mudar tudo que assume uma dieta por pasta (aluno, PDF, pacote) | recomendação da análise de 16/11 (o Gustavo confirma) |
| D3 | Dieta sem variação | vale como hoje (uma variação implícita para todos os dias); sem camada de legado nem leitura de formato velho | regra do projeto (`AGENTS.md:53-54`) |
| D4 | Número do dia | 1 = segunda ... 7 = domingo, o mesmo do treino (`ValidadorTreino.java:80-84`, `dominio/formatos.ts:105`) | regra do projeto |
| D5 | Total do dia | continua somando só a opção A de cada refeição (`dominio/dieta.ts:57-60`), agora por variação | regra do projeto |
| D6 | Ordem do trabalho | decisões → regra pura em `dominio/` com teste → API e validador → editor → tela do aluno → PDF e lista de compras → pacotes, modelos e importadores → guia | recomendação da análise de 16/11 (o Gustavo confirma) |
| D7 | Risco | contrato crítico (API, tipos espelhados, offline do aluno, PDF): revisão independente e `plano-trio` antes de implementar | recomendação da análise de 16/11 (o Gustavo confirma) |
| D8 | Dado sensível | dieta nunca em log, no git ou em serviço externo; a auditoria só registra o rótulo "DIETA" (`auditoria/Auditoria.java:47`) | regra do projeto (`AGENTS.md:86`) |
| D9 | Seleção dos chips | neutra (`superficie3` + `bordaCampo` + ✓), nunca a cor da marca; a cor não é a única informação | regra do projeto (`docs/design-e-front.md:119,219`) |
| D10 | Dia sem variação (cobertura) — **substitui a recomendação da decisão 2 abaixo** | publicar com dia descoberto é permitido (o "dia de descanso", raro): o `ValidadorDieta` dá **aviso confirmável** (`CONFIRMAR_AVISOS`, "Dia sem dieta marcada: sábado, domingo.", só os nomes dos dias), nunca erro; variação sem nenhum dia continua erro; o aluno vê "Sem dieta marcada para hoje" (sem refeições de outro dia) e os chips para ver as outras; o editor diz no aviso que pode publicar assim. Aviso confirmável e não "nenhum aviso": é o único freio contra esquecer um dia por engano, e custa um toque | Gustavo (pedido de 17/11); o aviso é decisão do executor, trocar por nenhum é uma linha em `ValidadorDieta.variacoes` |

## Decisões que faltam antes de começar
1. **Onde ficam as refeições quando há variações (detalhe do formato que o pedido não fechou).** Recomendado, dentro da
   forma já decidida: dieta sem variação continua com `refeicoes` na raiz (uma variação implícita para todos os dias, como hoje);
   dieta com variação guarda cada variação em `variacoes[]` (`uid`, `rotulo`, `dias`, `refeicoes`) e a `refeicoes` da raiz fica
   vazia (o validador recusa as duas ao mesmo tempo). Uma função `refeicoesDoDia(conteudo, dia)` esconde isso de quem consome.
   Alternativa A: sempre tudo em `variacoes[]` e `refeicoes` sai da raiz (mais limpo, mas mexe em todo consumidor da lista
   abaixo de uma vez). Alternativa B: `refeicoes` fica como "variação-base" e `variacoes[]` guarda só as extras (menos
   consumidores a tocar, mas cria uma variação sem rótulo nem dias e casos especiais em duplicar e nos chips; também já
   responderia a decisão 2 por tabela). Quem: Gustavo. Sem isso para o passo 2.
2. **(Decidida em 17/11: ver D10; o texto abaixo é o histórico.) Dia sem variação marcada (cobertura).** A conferência já prevê o validador checar "cobertura" (`conferencia-3`, C64).
   Recomendado: com variações, publicar exige os 7 dias cobertos e sem repetição (erro; o rascunho pode ficar incompleto, e a
   cópia nasce sem dias de propósito); assim o aluno nunca cai num dia sem dieta. A tela do aluno abre na variação de hoje e
   mostra chips para ver as outras. Alternativa: só avisar e, no dia descoberto, mostrar "Sem dieta marcada para hoje" e os
   chips. Quem: Gustavo, com o Saraiva confirmando se há dia sem dieta. Para os passos 2, 3 e 5.
3. **Como a lista de compras soma a semana.** Recomendado: por variação, `dias da variação × (período ÷ 7)`; semana = 7 dias,
   2 semanas = 14, mês = 30 dias fixos como hoje (`dominio/listaDeCompras.ts:22-26`), arredondando só na tela. Alternativa:
   contar os dias reais a partir de hoje (a lista mudaria conforme o dia em que é gerada). Quem: Gustavo. Para o passo 6.
4. **O PDF da dieta com variações.** Recomendado: um PDF só, com uma seção por variação ("Dias: seg, qua, sex", total do
   dia da variação e as refeições). Alternativa: um PDF por variação (o que o Saraiva faz hoje). Quem: Gustavo, ouvindo o
   Saraiva. Para o passo 6.
5. **Modelo de dieta também tem variações?** Recomendado: sim, o modelo de dieta e o pacote já carregam o `ConteudoDieta`
   inteiro; o modelo de uma refeição (`REFEICAO`) não tem. Pendência junto: "Usar modelo de dieta" (`FolhasDaDieta.tsx:62`)
   hoje troca só as refeições; com variações, recomendo substituir a dieta toda, refeições da raiz e variações (com Desfazer). Quem: Gustavo. Para o passo 7.
6. **"Duplicar" copia os dias ou deixa vazio?** Recomendado: vazio (a conferência sugere o mesmo), para o treinador marcar e
   não gerar dois dias na mesma variação; os identificadores são novos. Alternativa: copiar os dias e tirar do original. Quem:
   Gustavo (o consolidado deixou "a confirmar"). Para o passo 4.
7. **Nome da coisa na tela.** Recomendado: "variação", com rótulo livre escrito pelo treinador ("Dia de carbo alto"); o aluno
   vê "Hoje: <rótulo>". Evitar "versão" (já é a versão publicada do plano: `VersaoDetalhe`) e rótulo em letra A/B (já é a
   "opção A" da refeição, que manda no total do dia). Quem: Gustavo e o Saraiva. Para os passos 4 e 5.
8. **Como é o topo do editor (hipótese, não confirmada).** O pedido foi "os dias (segunda, terça...) selecionáveis em cima do
   editor". Recomendado: faixa de chips das variações (mesmo padrão do `SeletorDeSessoes` do treino, `treinador/treino/SeletorDeSessoes.tsx:35`)
   e, dentro da variação aberta, sete chips de dia marcáveis (marcar um dia tira o dia de outra variação), tudo acima do Total
   do dia. Confirmaria: rever o trecho P1 1:17:45 a 1:19:00 e 1:23:45 a 1:24:19 da gravação e a tela do concorrente. Quem:
   Gustavo. Para o passo 4.
9. **Orientações, observações, suplementação, medicação e água são globais?** Recomendado: sim, ficam na raiz, iguais em
   todas as variações (o pedido é só variar a comida). Quem: Gustavo. Para os passos 3 e 4.
10. **App antigo.** O aluno com APK antigo não conhece `variacoes`: `normalizarDieta` copia só os campos que conhece
    (`dominio/dieta.ts:106-164`) e `formatoDoPacote.ts:194` só confere o treino, então ele não recusa a dieta nova: provavelmente
    mostraria uma dieta sem refeições (a `refeicoes` da raiz fica vazia), hipótese, não confirmada; confirmaria abrindo a dieta
    publicada com variação num APK antigo. Recomendado: só publicar variação para aluno depois de instalar o APK novo (o piloto
    é pequeno). Alternativa: nenhuma trava técnica possível no app antigo. Quem: Gustavo. Para a entrega do passo 5.

## Passos

### Quem lê o conteúdo da dieta hoje (em 61dc3a5a)
Referência para o que cada passo abaixo toca.
API, `api/src/main/java/br/com/treinos/api/`:
- Contrato e cópias: `dieta/ConteudoDieta.java:39-48` (record), `54` e `61` (construtores de conveniência), `149` (`vazio`), `154-160`
  (`semErgogenicos`/`comErgogenicos`), `172-178` (`comItens`), `182-196` (`comUidsNovos`).
- Serviço e validação: `dieta/PlanoDietaService.java:54,60,70,80` (ganchos de uid, leitura, rascunho e cópia), `97-108`
  (`paraPublicar`: copia fator e grupo do alimento só do que acha em `refeicoes`), `dieta/ValidadorDieta.java:37-119` (laço das
  refeições em `46-82`, kcal do dia em `77-78` e `111-113`), `dieta/PlanoDietaController.java:56-104`.
- Aluno e exportação: `execucao/AlunoAppService.java:151`, `execucao/dto/ExecucaoDtos.java:146,155`, `privacidade/PrivacidadeDtos.java:47`.
- Modelos e pacotes: `receitas/ConteudoPastaModelo.java:10`, `receitas/AplicarModeloService.java:78-81` (aplica a dieta do
  pacote com `semErgogenicos().comUidsNovos()`) e `117-125` (salva a pasta como pacote com `dietas.rascunho`),
  `receitas/ReceitaService.java:168-172` e `223-224` (modelo de refeição exige 1 refeição), `receitas/DietasPadrao.java:79,136`,
  `receitas/DietasPadraoService.java:70`, `receitas/ReceitasPadrao.java:260-265`, `db/migration/V062__dietas_padrao.java:72` (migration antiga: não mexer).
- Importação: `importacao/assistida/ImportacaoAssistidaService.java:491-517` (reconstrói o record: precisa levar `variacoes`),
  `importacao/assistida/ia/InterpretadorPorRegras.java:230-283,307-314`, `importacao/completa/MontagemDaImportacao.java:1201-1216`,
  `importacao/completa/GravacaoDaPlanilha.java:370-380` (conta refeições e itens).
- Seeds: `demo/SeedDemo.java:384-407,500-508`, `execucao/SeedHistoricoDemo.java:357-362`.
- `new ConteudoDieta(` aparece em 11 pontos do código principal e em 13 arquivos de teste.

App, `app/src/`:
- Tipos e regra: `api/tipos.ts` (`Refeicao` ~861, `ConteudoDieta` ~896-909), `dominio/dieta.ts:45-60` (`somar`/`totalDoDia`),
  `106-164` (`normalizarDieta`), `167-177` (`aplicarReceitaDeDieta`), `219-223` (`itensSemValorNoTotal`).
- Editor do treinador: `treinador/dieta/EditorDeDieta.tsx:56` (`normalizarDieta`), `93-111` e `215-250` (as ~27 leituras de `c.refeicoes`),
  `172` (`TotalDoDia`); `treinador/dieta/TotalDoDia.tsx:25`; `treinador/dieta/CartaoRefeicao.tsx:44-45` (resumo por refeição, não muda);
  `treinador/dieta/FolhasDaDieta.tsx:62-78` (modelo, refeição pronta, salvar refeição); `treinador/dieta/FolhaListaDeCompras.tsx`.
- Tela do aluno: `aluno/DietaDoAluno.tsx:62,98-105` (total e refeições), `app/aluno/dieta.tsx:70`, `app/aluno/lista-de-compras.tsx:70`,
  `aluno/ListaDeComprasDoAluno.tsx:100`, `dominio/inicioDoAluno.ts:50-55` e `aluno/CartaoDietaDoInicio.tsx:47` ("N refeições no seu plano"),
  `dominio/previaDoAluno.ts:57` e `treinador/plano/FolhaVerComoAluno.tsx:17` ("Ver como o aluno").
- Offline: `aluno/useDietaDoAluno.ts:15-18`, `offline/repositorioSqlite.ts:298-302` e `offline/repositorioLocal.ts:395-399` (a dieta é
  um documento inteiro, sem schema); `offline/formatoDoPacote.ts:194` confere só o treino, então um app antigo não recusa a dieta nova.
- Lista de compras e PDF: `dominio/listaDeCompras.ts:104-142` (laço em `107`), `150-161`, `164-168`, `176-191`; `ui/ListaDeCompras.tsx:124`;
  `ui/FolhaPdfDieta.tsx:95`; `pdf/pdfDieta.ts:59` (dias do período), `119` (total), `128-148` (refeições), `164-170` (macros);
  `pdf/pdfListaDeCompras.ts:3`; `treinador/gerarPdf.ts:53`; `treinador/CartaoPlanos.tsx:123`; `treinador/plano/TopoPlano.tsx:100-103`.
- Modelos e importação: `treinador/planejamento/modelos.ts:121-122,143-145`, `treinador/planejamento/EditorModelo.tsx:103,119`,
  `dominio/amostraDaPlanilha.ts:98-99,170`, `treinador/importacao/planilhaCompleta/EtapaDaAmostra.tsx:209,288`, `dominio/importacaoAssistida.ts:155`.
- Suítes a ajustar: API `ValidadorDietaTest`, `DietaIntegrationTest`, `FatoresDosAlimentosIntegrationTest`, `CopiarPlanoIntegrationTest`,
  `PastaPublicarCopiarPesoIntegrationTest`, `AplicarModeloPermissoesIntegrationTest`, `PlanejamentoIntegrationTest`, `DietasPadraoTest`,
  `PrivacidadeIntegrationTest`, `SeedDemoIntegrationTest`, `MontagemDaImportacaoTest`, `InterpretadorPorRegrasTest`; app `dominio/dieta.test.ts`,
  `listaDeCompras.test.ts`, `inicioDoAluno.test.ts`, `previaDoAluno.test.ts`, `modelos.test.ts`, `pdf/pdf.test.ts`, `pdf/injecao.test.ts`; e2e
  `dieta-ajustes`, `dieta-opcoes-e-preparo`, `lista-de-compras`, `aluno-clareza`, `ver-como-aluno`, `cores-historico-dieta`, `editor-inspetor-sobras`.

## Síntese do plano-trio (16/11/2026: Arquiteto, Guardião e Enxuto; o Front não foi chamado porque o rascunho já descreve a tela; sem crítica cruzada, não houve divergência real)
**Forma do JSON (decisão 1): a do rascunho, nos três votos.** Sem variação, `refeicoes` fica na raiz como hoje; com variação, tudo vai para `variacoes[]` (`uid`, `rotulo`, `dias`, `refeicoes`) e a raiz fica `[]`; o validador recusa as duas juntas. Sem migration: versão já publicada, sem o campo, lê `variacoes` nulo como lista vazia (`variacoesOuVazio()`), o que não é camada de legado, é o formato atual sem variação. As alternativas A (tudo em `variacoes[]`) e B (raiz como "variação-base") custam migration ou casos especiais em duplicar e nos chips.

**Contrato Java.** `record Variacao(UUID uid, @Size(max = 40) String rotulo, @Size(max = 7) List<@NotNull @Min(1) @Max(7) Integer> dias, @Size(max = 12) List<@Valid @NotNull Refeicao> refeicoes)`; campo `@Size(max = 7) List<@Valid @NotNull Variacao> variacoes` no fim do `ConteudoDieta`, sem `@NotNull`. A variação não tem ergogênicos, suplementação nem observações (decisão 9).
- **Armadilha central (Guardião, bloqueante):** `comErgogenicos` (`ConteudoDieta.java:154-160`), `comItens` (172) e `comUidsNovos` (182) reconstroem o record. Se esquecerem `variacoes`, quem não tem `ERGOGENICO_ALTERAR` perde as variações a cada "Salvar" (`PlanoDietaService.paraGravarRascunho:70-75`), quem não tem `ERGOGENICO_LER` as recebe sem elas, e a exportação LGPD, a cópia para outro aluno e o pacote saem sem elas. Regra: **proibido construtor de 9 argumentos "sem variações"** (compilaria e apagaria em silêncio); os de 7 e 8 (`:54`, `:61`) ficam para seed, teste e importador (`ReceitasPadrao:265`, `SeedDemo:407` e a V062 usam o de 7: nenhuma migration já aplicada precisa mudar). Um helper `mapearRefeicoes` aplica a mesma troca à raiz e a cada variação; `comUidsNovos` também gera uid novo para a variação; `todasAsRefeicoes()` serve `paraPublicar` (os `alimentoId` de todas as variações; senão fator e grupo saem nulos e a lista de compras offline sai errada sem aviso) e o validador.
- **Validador:** dia fora de 1 a 7, dia repetido (na variação e entre variações), dia descoberto, variação sem rótulo, **sem dia** (o rascunho esqueceu: cobertura sem repetição não impede variação vazia) ou sem refeição, raiz junto com variações, uids num conjunto só, aviso de 0 kcal por variação. Mensagens fixas: o rótulo e o conteúdo nunca vão para mensagem, log ou auditoria (a de dia descoberto lista só os nomes dos dias).
- `@Valid` em cada variação (senão os limites de 12 refeições, 6 opções, 40 itens e 2000 caracteres do preparo não valem dentro dela). O controller já tem `@Valid` na entrada do rascunho. A API não tem `FAIL_ON_UNKNOWN_PROPERTIES` configurado (padrão do Spring Boot: ignora campo desconhecido), então a API com o campo novo sobe **antes** de qualquer tela que o mande.

**Regra pura do app (`dominio/`).** `DiaDaSemana = 1..7`; `variacaoDoDia(c, dia)` devolve `null` sem variações **e** em dia descoberto (quem chama distingue por `c.variacoes.length`; não inventar variação implícita sem uid); `refeicoesDoDia(c, dia)` (a raiz sem variações; `[]` em dia descoberto); `secoesDaDieta(c)` (sem variações, uma seção com os 7 dias; serve PDF, lista e editor); `totalDoDia(refeicoes)` e `itensSemValorNoTotal(refeicoes)` passam a receber a lista (o `tsc` aponta os chamadores: `DietaDoAluno.tsx:99,101`, `pdfDieta.ts:119`, `TotalDoDia.tsx:25`, `modelos.ts:144`); `diasSemVariacao`, `alternarDia` (marcar tira o dia da outra), `duplicarVariacao` (uids novos, dias vazios, rótulo "… (cópia)"), `criarVariacoes` (move a raiz para a variação 1 com os 7 dias). `normalizarDieta` preenche `variacoes: []` e aguenta ausente, nulo e malformado (dia fora de 1 a 7, refeições nulas) sem quebrar a tela offline. `aplicarReceitaDeDieta` (`dieta.ts:167`) troca `refeicoes` **e** `variacoes` juntas (trocar só a raiz deixaria os dois ao mesmo tempo, estado inválido); a troca de uids vira o helper `comUidsNovos(refeicoes)`, usado também por `duplicarVariacao`. Dia de hoje: `diaDaSemana()` (`formatos.ts:105`) usa o **fuso do aparelho**; a ordem combinada pede Brasília, então a regra nova usa a data de Brasília com `diaDaSemanaIso(iso)` (`formatos.ts:111`, não depende do fuso), com relógio injetável para teste. O treino continua com `diaDaSemana()`; unificar é outro pedido.

**Reuso (Enxuto, conferido no código):** `ui/FaixaDeChips` e o visual de chip do `SeletorDeSessoes.tsx:47-81` (seleção neutra, D9; ponto vermelho marca a variação com problema); `mover/remover/substituir` de `editorTreino`; no servidor a cópia, a replicação e o pacote já passam por `semErgogenicos().comUidsNovos()`, então levam as variações sem código novo.

**Cortes propostos (Enxuto), sem cortar segurança:** só "Duplicar variação" (na dieta sem variação ela vira "Criar variação": a raiz vai para a variação 1 com os 7 dias e nasce uma cópia sem dias); sem "Nova variação" vazia; sem o "N variações" no resumo do modelo (`modelos.ts:143`, só o ajuste de compilação do `totalDoDia`); virada de meia-noite reaproveita o relógio do treino (`app/aluno/treino.tsx:105`), mas o Guardião pede teste com relógio falso às 23:59 e 00:01 e recálculo quando o app volta para a frente (`AppState` `active`); seed com duas variações só se um e2e precisar (senão o spec monta pela API).

**Também no editor (Arquiteto):** além das linhas do rascunho, `EditorDeDieta.tsx` lê `c.refeicoes` em `:92` (`uidsComProblema`), `:155` (`aoIrAoPrimeiro` abre a variação da refeição com problema), `:168` (`recolhido`) e `:177-207`. `dominio/caminhos.ts:uidsComProblema` precisa aceitar `variacoes[i].refeicoes[j]...` (a conferir pelo executor antes de tocar a tela).

## Passos (ordem combinada em D6; a numeração do rascunho estava um à frente)
Todos esperam as decisões abaixo. Migration: **nenhuma**. Todos os passos do 3 ao 5 exigem **APK novo** (o editor do treinador no celular, o PDF e a lista também rodam no app), um APK só, depois do 5.
- [x] 1. Regra pura e tipos do app (`executor`, só app): `variacoesDaDieta.ts` (ou em `dieta.ts`) com teste, `tipos.ts`, `normalizarDieta`, troca mecânica dos chamadores de `totalDoDia`, `aplicarReceitaDeDieta` e o helper de uids. Testes: sem variações a raiz vale nos 7 dias; o dia certo cai na variação certa; `alternarDia`; `duplicar` com uids novos e dias vazios; `normalizarDieta` com `variacoes` malformado; relógio falso às 23:59 e 00:01 — feito (16/11): `variacoesDaDieta.ts`, `dieta.ts`, tipos e `variacoes: []` nas fixtures e2e; jest verde — commit: ver `git log` ("Dieta por dia: contrato do app e da API")
- [x] 2. API (`executor`, em paralelo com o 1, arquivos disjuntos): record, `Variacao`, `mapearRefeicoes`, `todasAsRefeicoes`, `paraPublicar`, `ValidadorDieta`, `ImportacaoAssistidaService:517`, seeds. Testes: unitário do record (`comUidsNovos`, `comItens`, `semErgogenicos` e `comErgogenicos` mantêm as variações: o guarda mais barato contra a perda silenciosa); `ValidadorDietaTest` com um caso por erro; **matriz de integração** (salvar rascunho sem e com `ERGOGENICO_ALTERAR`, ler sem `ERGOGENICO_LER`, publicar com fator e grupo copiados nas variações, copiar para outro aluno, replicar a pasta, aplicar pacote, salvar pasta como pacote, aplicar modelo de dieta, exportação LGPD, anonimização) em `DietaIntegrationTest`, `FatoresDosAlimentosIntegrationTest`, `CopiarPlanoIntegrationTest`, `PastaPublicarCopiarPesoIntegrationTest`, `AplicarModeloPermissoesIntegrationTest`, `PrivacidadeIntegrationTest`. Conferir `AplicarModeloService.java:78-81,117-125` (o pacote lê `dietas.rascunho`: se passar por `paraLeitura`, perde as variações). **Revisão independente ao fim** (`revisao-trio`: dado sensível e contrato) — feito (16/11): `ConteudoDieta.variacoes`, `Variacao`, validação, cópias/modelos/pacote/replicar, exportação; nada compilado nem rodado (fila do Maven). `REFEICAO` não aceita variação; `null` vira `[]` — commit: ver `git log` ("Dieta por dia: contrato do app e da API")
  - 1 e 2 sobem juntos e antes de qualquer tela (a mudança não é visível para ninguém).
- [x] 3. Editor do treinador (`executor-front`; depende de 1 e 2): chips das variações e sete chips de dia acima do "Total do dia", "Criar/Duplicar variação" (dias vazios, uids novos), "Excluir variação", campo do rótulo (obrigatório, até 40), `TotalDoDia` da variação aberta, `FolhasDaDieta.tsx` ("refeição pronta", "salvar refeição", "Usar modelo") agindo na variação aberta; o "Usar modelo" substitui a dieta toda, com Desfazer. e2e novo `dieta-variacoes.spec.ts` (o spec monta pela API e calcula o dia de hoje em Brasília); `editor-inspetor-sobras` e `dieta-opcoes-e-preparo` só se quebrarem; 390 e 1280 px, claro e escuro — feito (16/11, sem e2e rodado): editor com cartão "Dias da semana" (`treinador/dieta/VariacoesDaDieta`), refeições sempre pela variação aberta, erro leva à variação, `EditorModelo` lista os rótulos; e2e `dieta-por-dia.spec.ts` (o plano o chamava `dieta-variacoes`) rodou em 16/11: 20 de 20 em 390 e 1280, capturas conferidas em claro, areia e escuro (corrigidos: aba sem `aria-selected` e chips que cortavam a variação aberta a 390 px) — commit: ver `git log` ("Dieta por dia: telas")
- [x] 4. Tela do aluno, início e prévia "Ver como o aluno" (`executor-front`, regra do dia pronta no passo 1; em paralelo com o 3, arquivos diferentes): abre na variação de hoje, "Hoje: <rótulo>", chips para ver as outras; dia descoberto na prévia mostra "Nenhuma variação para hoje"; "N refeições no seu plano" conta as de hoje; recálculo na virada do dia e quando o app volta para a frente. e2e `aluno-clareza`, `ver-como-aluno`, `cores-historico-dieta` — feito (16/11, e2e rodou): `DietaDoAluno` abre na variação de hoje (dia de Brasília, `aluno/useDiaDeHoje`) com troca manual; Início diz "Hoje: <rótulo> · N refeições" ou "Nenhuma variação para hoje"; lacuna do rótulo da variação na lista: fechada no passo 6 (17/11) — commit: ver `git log` ("Dieta por dia: telas")
- [x] 5. PDF e lista de compras (`executor`, **um só**, porque compartilham `pdf.test.ts`; em paralelo com 3 e 4): um PDF com uma seção por variação ("Dias: seg, qua, sex", total e refeições; sem variação o PDF fica igual ao de hoje); lista por `dias.length × período ÷ 7` (**multiplicar antes de dividir**: sem variação o resultado é exatamente o de hoje; arredondar só na tela, `listaDeCompras.ts:193-200` não muda). Testes: `listaDeCompras.test.ts` (5+2 dias, semana e mês), `pdf.test.ts`, `injecao.test.ts` (rótulo e dias escapados por `esc()`), e2e `lista-de-compras` — feito (16/11): `listaDeCompras.ts` (cada variação entra por dias × período ÷ 7; sem variação igual a antes), `pdfDieta.ts` (seção por variação, `textoDosDias`), `planejamento/modelos.ts`; jest verde, e2e não rodou. Lacunas: `ui/ListaDeCompras.tsx` (`EscolhasDaLista`) sem o rótulo da variação (fechada no passo 6); PDF avulso da lista sem o aviso dos dias; `totalDoDia` ainda aceita o conteúdo inteiro até as telas migrarem — commit: ver `git log` ("Dieta por dia: PDF e lista de compras")
- [x] 6. Guia e documentação: `app/src/ajuda/conteudo.ts` (treinador e aluno), `AGENTS.md` (contrato novo, dia 1 a 7, a regra do `comErgogenicos`), este plano e o README; PDFs de guia só pelo gerador — feito (sem commit) em 17/11: Ajuda atualizada; texto do `AGENTS.md` e linha do README entregues à sessão principal, que aplica; PDFs dos guias não regenerados (a sessão principal gera uma vez no fim). Entraram junto (pedido de 17/11): D10 (dia descoberto só avisa; `ValidadorDieta`, `DietaDoAluno`, Início e editor), escolha "Todas as variações" ou uma só no PDF da dieta (`FolhaPdfDieta`, `DadosPdfDieta.variacaoUid`, `soAVariacao`; o PDF do treinador e o do aluno) e o rótulo da variação na lista de compras (`escolhasDaLista`, `EscolhasDaLista`). Testes: jest verde (variacoesDaDieta, listaDeCompras, inicioDoAluno, pdf, ajuda); `ValidadorDietaTest` (13) e `DietaVariacoesIntegrationTest` (6) ajustados e verdes no Maven (17/11); e2e `dieta-por-dia.spec.ts` ajustado e com casos novos (prévia sem dieta no dia, aluno sem dieta no dia, treinador publica depois de confirmar o aviso, PDF com todas ou uma variação), não rodado — commit: —
- [ ] 7. Verificação final e revisão (`revisao-trio`; saída das suítes pelo `executor-rapido`); o Gustavo instala o APK novo e abre a dieta de um aluno de teste em dois dias diferentes — commit: —
- **Push:** 1 e 2 podem subir sozinhos; do 3 ao 5, um push só (editor publicado sem o aluno, o PDF e a lista deixaria as leituras da raiz vazias).

## Decisões para o Gustavo (opção recomendada primeiro)
1. **Forma do JSON.** (a) Sem variação, `refeicoes` na raiz; com variação, `variacoes[]` e raiz vazia. (b) Tudo em `variacoes[]`, a raiz some (exige migration das versões publicadas). (c) Raiz como "variação-base" mais extras (casos especiais). O trio todo recomenda (a); é técnica, só confirmar.
2. **Dia sem variação.** Decidida em 17/11 (D10): vale a (b), com aviso confirmável na publicação e "Sem dieta marcada para hoje" para o aluno. (Antes: (a) exigir os 7 dias.)
3. **Lista de compras.** (a) `dias da variação × período ÷ 7` (semana 7, 2 semanas 14, mês 30 como hoje). (b) Contar os dias reais a partir de hoje (a lista mudaria conforme o dia em que é gerada).
4. **PDF.** (a) Um PDF, uma seção por variação. (b) Um PDF por variação (o que o Saraiva faz hoje). Ouvir o Saraiva.
5. **Modelo de dieta e "Usar modelo".** (a) O modelo e o pacote levam as variações e "Usar modelo" substitui a dieta toda, com Desfazer. (b) Só o pacote leva. (O modelo de uma refeição continua com uma refeição só.)
6. **Duplicar.** (a) Dias vazios e uids novos. (b) Copiar os dias e tirar do original.
7. **Nome na tela.** (a) "Variação", rótulo livre obrigatório até 40 caracteres ("Dia de carbo alto"); o aluno vê "Hoje: <rótulo>". (b) Outro nome; evitar "versão" e "A/B".
8. **Topo do editor.** (a) Montar já: chips das variações e, dentro, sete chips de dia, tudo acima do Total do dia; o Gustavo confere na captura (mudar depois custa pouco). (b) Esperar a revisão do trecho da gravação (P1 1:17:45 a 1:19:00) e da tela do concorrente.
9. **Orientações, observações, suplementação, medicação e água.** (a) Globais, na raiz, iguais em todas as variações. (b) Por variação.
10. **APK antigo.** O aluno com APK antigo veria a dieta sem refeições; o **treinador** que edita no APK antigo apaga as variações do rascunho ao salvar (`normalizarDieta` descarta o campo). (a) Só usar variações depois de o treinador e o aluno instalarem o APK novo (o piloto é pequeno e o banco do Saraiva pode resetar). (b) Esperar o fim do piloto. Não há trava técnica no app antigo.

## Critérios de aceite
- Uma dieta com duas variações (uma em seg, qua, sex e dom; outra em ter, qui e sáb) é salva, publicada e lida de volta com os mesmos dias, e as duas valem sem trocar de dieta ativa.
- O treinador duplica uma variação com um toque: a cópia vem sem dias, com identificadores novos, e ao marcar um dia ele sai da outra variação.
- O Total do dia do editor, da tela do aluno e do PDF mostra o total da variação e continua somando só a opção A.
- O aluno abre a dieta na variação de hoje (data de Brasília), vê "Hoje: <rótulo>" e consegue ver as outras; dieta sem variação abre como hoje.
- Publicar recusa dia repetido, fora de 1 a 7, variação sem rótulo, sem dia, sem refeição e `refeicoes` na raiz junto com variações, com mensagem sem o conteúdo da dieta; dia que nenhuma variação cobre só pede confirmação (D10).
- Quem não tem `ERGOGENICO_ALTERAR` salva, publica, copia e exporta sem perder variação nenhuma (matriz do passo 2).
- Copiar para outro aluno, replicar a pasta, aplicar modelo e aplicar pacote levam as variações com uids novos.
- A lista de compras soma cada variação pelo número de dias dela; PDF e lista mostram a mesma conta; dieta sem variação continua idêntica na tela, no PDF e na lista (nenhum teste antigo muda de resultado).
- Conferido a 390 e 1280 px, claro e escuro, na web e no APK novo.

## Riscos e revisão
- **Variação perdida em silêncio** (bloqueante, acima): matriz de integração, teste unitário do record e revisão independente no fim do passo 2.
- **App antigo:** o aluno vê dieta sem refeições; o treinador no APK antigo apaga o rascunho das variações (decisão 10). Sem trava técnica.
- **Lista de compras:** conta nova; o arredondamento para cima só na tela não pode mudar.
- **Editor:** cerca de 30 leituras de `c.refeicoes`, e o desfazer e o inspetor guardam a refeição por uid; testar remover, desfazer e trocar de variação com refeição aberta.
- **Virada do dia com a tela aberta** e fuso (aparelho × Brasília): ver a regra do dia acima.
- **Dado sensível:** dieta nunca em log nem em auditoria (a auditoria só diz "DIETA"); o rótulo é texto do treinador e nunca entra em mensagem.

## Fora do escopo
- R1115-C60, resto (números grandes e posição do "Total do dia"): fica na frente `dieta-pronta-para-comecar.md`.
- R1115-C69 (anel de refeições feitas): quando vier, conta as refeições da variação de hoje (`refeicoesDoDia`), não `refeicoes` direto.
- Mais de uma dieta ativa por aluno (D2); importar ciclo de carbo por planilha ou IA; modelos e pacotes prontos do Saraiva com ciclo de carbo (C92, conteúdo); ligar a variação da dieta ao dia do treino; "N variações" no resumo do modelo; guias em PDF sem gerador.

## O que ficou para trás
—
