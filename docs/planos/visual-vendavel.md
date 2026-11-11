# Visual vendável: cor com função, hierarquia e marca harmoniosa (prévia primeiro)

Situação: Prévia do alvo de 11/11 em andamento (passo 3c): fundação e Início do treinador prontos, aguardando o Gustavo ver antes das outras telas · Onde: `main` (só `docs/`, nenhum código) · Atualizado: 11/11/2026 · Registro: pedido do Gustavo de 10/11 (prints de todas as telas em pasta local, fora do repositório)

## Objetivo
Deixar o app mais bonito, conciso, padronizado e vendável: cor em lugares estratégicos, hierarquia clara, e a pessoa
entendendo onde está e o que tem de fazer. Duas exigências do Gustavo: a cor da Marca (12 prontas × 10 paletas) tem de
se aplicar de forma harmoniosa, e as cores por tipo de série têm de aparecer em mais lugares importantes, no treinador e
no aluno.

## O que os prints mostram hoje (base `6dca4d9f`)
1. **Monocromia.** Cor só no menu ativo e no botão principal. Selos pequenos e contornados. A cor de identificação é um
   ponto ou uma barra de 6 px.
2. **Hierarquia fraca.** Título de cartão com 16 px e corpo com 15 px (`ui/tipografia.ts`). KPI "0" grande e cinza. Nada
   diz "faça isto agora".
3. **Vazio e densidade desigual.** Início do aluno e Resumo da ficha com mais de metade da tela vazia; painel com
   cartões de alturas diferentes.
4. **Repetição.** Três ícones em todo cabeçalho de cartão do painel; a sugestão de carga escrita três vezes no cartão da
   série; três parágrafos no cartão "Carga de trabalho".
5. **Bordas do mesmo peso em todos os níveis** (cartão contornado dentro de cartão contornado).
6. **A seleção invertida disputa com a ação principal.** No tema escuro o chip escolhido é branco: o ponto mais claro
   da tela é um filtro, não o botão que a pessoa precisa apertar.

## Sugestões (um arquivo de "como aplicar" cada)
| # | Sugestão | Arquivo | Mexe em regra do design? |
| --- | --- | --- | --- |
| S1 | Marca em rampa (sólida só na ação principal; tons para ativo, seleção, foco, progresso) | [S1](visual-vendavel/S1-marca-em-rampa.md) | Sim: seleção invertida e lista fechada da marca (4.5) |
| S2 | Cor de identificação em mais lugares (composição das séries, selo tingido, chips de tipo) | [S2](visual-vendavel/S2-cor-de-identificacao.md) | Sim: D10 de 03/11 (só barra de 6 px + selo) |
| S3 | Hierarquia tipográfica e de superfície, cabeçalho de página padrão | [S3](visual-vendavel/S3-hierarquia.md) | Sim: 3 variantes de texto e a regra das bordas |
| S4 | Início do treinador: "Precisa de você hoje" primeiro | [S4](visual-vendavel/S4-inicio-do-treinador.md) | Não (é a frente 5.6 que não começou) |
| S5 | Lista e ficha do aluno | [S5](visual-vendavel/S5-lista-e-ficha-do-aluno.md) | Não |
| S6 | Aluno: Início e treino do dia | [S6](visual-vendavel/S6-aluno-inicio-e-treino.md) | Não |
| S7 | Dieta (aluno e editor) | [S7](visual-vendavel/S7-dieta.md) | Não |
| S8 | Mobilidade (aluno e editor) | [S8](visual-vendavel/S8-mobilidade.md) | Não |

Sugestões do back (não são desta frente; viram frente própria se o Gustavo quiser): [back.md](visual-vendavel/back.md).

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| D1 | Ordem | prévia HTML primeiro; código só depois do ok | regra do projeto (D1 de 02/11) |
| D2 | Dados da prévia | só fictícios (consultoria "Studio Forja"); nenhum print nem texto de produção no repositório | regra do projeto (D8) |
| D3 | Seleção: rampa da marca ou invertida (hoje) | rampa da marca (recomendação aceita em 10/11); confirmar na prévia Calma | Gustavo |
| D4 | Marca fora da lista fechada (item ativo tingido, chip escolhido, progresso, foco) | direção aceita em 10/11; confirmar na prévia Calma | Gustavo |
| D5 | Cor de identificação além da barra de 6 px + selo (barra de composição, selo tingido, chip de tipo colorido) | **revista em 10/11**: o Gustavo achou a prévia colorida demais; vale a seção "Dose de cor" | Gustavo |
| D6 | Três variantes de texto (bloco 16→18, titulo 24→28, destaque 28→36 em ≥ 768) | direção aceita em 10/11; é design system, lista de telas no S3 | Gustavo |
| D9 | Contorno de 1 px no lugar de 2 px (`BORDA_BLOCO`), pela referência de 10/11 | **em aberto**; é design system e muda a identidade "contorno 2 px" do documento de design; a prévia Calma mostra | Gustavo |
| D10 | Seleção neutra (referência de 10/11) no lugar da rampa da marca do D3 | **em aberto**; a chave da prévia passa a ter Neutra, Rampa e Invertida | Gustavo |
| D11 | Densidade de PC: com mouse e ≥ 1024 px, botão e campo com 36 px e texto 14 px; chip e aba com 32 px. Em toque ou abaixo de 1024 px continua 44 px | **em aberto**; é design system (`ALVO_TOQUE`); a prévia Calma mostra | Gustavo |
| D8 | Dose de cor | modo Calma como padrão da prévia; o visual anterior fica como "Viva" só para comparar | Gustavo (10/11: "muito colorido até demais") |
| D7 | Ordem de aplicação | S3 e S1 primeiro (fundação), depois S2, depois as telas (S4 a S8), uma por PR | proposta |

## Dose de cor (ajuste de 10/11)
Princípio: cor é sinal, não decoração. Onde um arquivo S1 a S8 disser diferente, vale esta seção.
1. **Texto e número** sempre em `texto` ou `textoSuave`. Nunca número colorido (KPI, contagem da fila, resumo por tipo).
2. **Marca:** sólida só na ação principal da área e no cartão Hoje; o resto pela rampa (S1). Sem mudança.
3. **Status só na exceção:** o estado normal ("Em dia", "Completo", "Publicada") é texto de apoio, sem selo colorido.
   Âmbar e vermelho só em quem pede ação, no selo ou no quadrado do ícone. Verde só para confirmar o que a pessoa
   acabou de fazer.
4. **Cor de identificação: uma vez por tela, mais o item aberto.** Uma barra de composição com legenda no resumo
   (sessão no editor, topo do treino do dia do aluno, "Treino de hoje" da ficha). Linha de lista leva só o texto
   neutro "1 Aq · 3 FS · 1 WS · 2 Back off". No item aberto, barra lateral de 6 px + selo do tipo (o D10 de 03/11).
   Chip de tipo: o ponto da cor fica; o escolhido usa a seleção padrão, não a cor do tipo. No exercício do aluno, só a
   série da vez leva a cor; as feitas e as próximas ficam com selo neutro.
5. **Dieta:** a cor da refeição só na barra lateral de 6 px. Horário e etiqueta de quantidade neutros.

Referência de estética que o Gustavo indicou em 10/11: reactnativereusables.com (shadcn/ui para React Native). O que
vem dela para a prévia Calma: base neutra, contorno de 1 px suave, seleção neutra (escolhido = superfície levantada com
texto forte, sem cor), selo em pílula pequena, descrição em texto apagado. O que não vem: reescrever as telas com classes do Tailwind (corrigido em
11/11: a base da biblioteca já está no app, em `app/src/components/ui/`, com Uniwind e `@rn-primitives`; as peças de
`ui/` já ficam sobre ela). A fonte Geist e o botão principal neutro (claro sobre escuro), que não vinham na Calma,
passaram a vir com o alvo de 11/11 (seção "Menos variáveis"). Na prévia Calma, com a seleção neutra a marca fica só no botão principal, no cartão Hoje, no progresso e na logo.

Segunda referência de 10/11: um editor de treino no estilo shadcn que o Gustavo mandou como exemplo ("faz do seu
jeito, deixa bonito"). O que vem dela: densidade de PC (D11), controle segmentado nas escolhas curtas, resumo em lista
chave–valor, ações do cabeçalho em contorno com uma única preenchida. O que não vem: selo verde "Pronto" em toda linha
(aqui o normal não leva selo) e a ausência total de cor de tipo de série (aqui fica no item aberto e uma vez no resumo).
O arquivo do exemplo não entra no repositório.

Alvo dito pelo Gustavo em 11/11: "dashboard minimalista em tema escuro, com paleta quase monocromática", "acabamento
premium e microinterações suaves", no estilo do bloco dashboard-01 de ui.shadcn.com (animate-ui.com para as animações).
O que a prévia Calma ainda não tem disso: botão principal neutro (hoje é a cor da marca), painel de conteúdo destacado
do menu, raio menor nos controles, selo de situação em contorno com ponto colorido e as microinterações. Em aberto: onde
a cor da marca do treinador continua aparecendo.

## Menos variáveis (11/11)
Caminho escolhido: trocar a pele (tokens e peças de `ui/`), sem reescrever telas. Decidido pelo Gustavo em 11/11: a
fonte passa de Inter para Geist (medido em 11/11, base `6dca4d9f`: 230 arquivos leem as cores do tema e 2 têm cor
fixa; 129 têm espessura de borda escrita à mão; 18 já usam Reanimated; 8 tratam hover).

Decidido pelo Gustavo em 11/11 (segunda resposta, com a referência de um site escuro azulado com um só destaque
laranja):
- **Ficam** o tema Areia, a preferência "bordas reforçadas" e a fonte Metal Mania do nome da consultoria: o Saraiva
  gostou. Com a Metal Mania fica a escolha de fonte do nome inteira (`ui/MarcaTitulo.tsx`).
- **Ficam as 10 paletas e as 12 cores da marca.** O meio-termo é: a paleta só tinge fundo, superfícies e contorno; a
  cor da marca é o único destaque e aparece em lugares fixos. A referência dele tem quase as mesmas cores da paleta
  Oceano (`#0B132B` de fundo, `#1A223C` de superfície) com uma cor de marca.
- Lugares fixos da cor da marca (proposta da sessão a partir das marcações dele na referência): botão principal (um
  por tela); rótulo pequeno acima do título de seção; a fileira de números grandes do Início; número de ordem
  (passo, série da vez); progresso e cartão Hoje do aluno; indicador do item ativo (aba, menu); logo ou nome. Todo o
  resto é cor de texto. Verde, âmbar e vermelho só em ponto ou selo de situação.
- Isso abre uma exceção à "Dose de cor" (regra de 10/11, "número em cor de texto"): vale só para a fileira de
  números grandes no topo de um painel, nunca para número em lista ou tabela.

Proposta da sessão que ele não contestou (confirmar antes do código):
- Um contorno de 1 px como padrão (2 px só com "bordas reforçadas"), dois raios (8 no controle, 12 no cartão), uma
  seleção (neutra), sem sombra nem gradiente.
- Preferência "barras escuras" (só muda a barra de rolagem da web no tema escuro, `app/_layout.tsx:68`): sai; a
  barra segue o tema.
- Ficam por acessibilidade: contraste alto, tamanho do texto e movimento reduzido.

## Passos
- [x] 1. Prévia HTML: fundação (`base.css`, `base.js`, `index.html`), Início do treinador, lista e ficha — executor-front — arquivos em `docs/prototipos/visual-vendavel/` (estado local, sem commit); conferida com Playwright em 390, 768, 1280 e 1800, Escuro, Claro, Café + Bronze e Meia-noite + Azul; contraste das 12 marcas × 10 paletas sem falha
- [x] 2. Prévia HTML: editores de treino, dieta e mobilidade (treinador) — executor-front — `treinador-treino.html`, `treinador-dieta.html`, `treinador-mobilidade.html` e `editores.css` em `docs/prototipos/visual-vendavel/` (estado local, sem commit); Playwright em 390, 768, 1024, 1280 e 1800 nas quatro combinações (180 casos sem problema); 38 conferências de fluxo sem falha; contraste sem falha (menor valor 4,50). Não conferido: leitor de tela real; arrastar não foi desenhado (só o menu "Mover")
- [x] 3. Prévia HTML: aluno (Início, treino do dia, exercício, dieta, mobilidade) — executor-front — `aluno-*.html` e `aluno.css` em `docs/prototipos/visual-vendavel/` (estado local, sem commit); Playwright em 390, 768 e 1280, Escuro, Claro, Café + Bronze e Meia-noite + Azul; 35 conferências de fluxo sem falha; contraste de texto e das barras de série sem falha. Não conferido: leitor de tela real; 768 só pela checagem automática
- [x] 3b. Prévia HTML: modo Calma (seção "Dose de cor") com a chave Calma | Viva — executor-front — `base.css`, `base.js`, `editores.css`, `aluno.css` e as 10 páginas em `docs/prototipos/visual-vendavel/` (estado local, sem commit). Calma + seleção Neutra é o padrão; Viva comparada pixel a pixel com a anterior em 24 capturas (idêntica). Contraste sem falha nas quatro combinações em 390 e 1280, nas três seleções; layout em 180 casos (único alerta: alvo de 36 px no PC com mouse, que é o D11); fluxos dos editores e do aluno sem falha. A sessão principal olhou 7 capturas (editor de treino, Início, exercício do aluno em 1280 Escuro; ficha, treino do dia, Início do aluno e mobilidade do aluno em 390 Claro), corrigiu o botão principal do aluno que encolhia para 36 px no PC e reabriu as 9 telas e as duas fichas sem erro de console. Não conferido: aparelho de toque real, leitor de tela, as 108 capturas uma a uma, Bronze e Azul em todas as telas
- [x] 3c. Prévia HTML do alvo de 11/11 (seção "Menos variáveis"): Geist, contorno de 1 px, raio 8 e 12, cor da marca nos sete lugares fixos, microinterações; começa pelo Início do treinador e segue para as outras telas — executor-front — pedido do Gustavo de 11/11 ("vamos criar os protótipos e ver como vai ficar"). Fechada em 11/11 (estado local, sem commit): as dez telas e o `entrar.html` no acabamento do alvo; o Gustavo gostou do `treinador-treino.html` e mandou o PDF de ajustes para aplicar direto no app (passo 5)
  - **Segunda rodada de 11/11 (dez melhorias pedidas pelo Gustavo):** Início com fila de ponto de situação, zero apagado, grade de 3, resolver pela Folha com Desfazer; `entrar.html` novo (normal, vazio, erro, enviando, "Crie sua senha"); telas do treinador (lista em tabela/cartões com filtros em faixa que rola, ficha com um botão principal, editores com sobretítulo e menu ⋯ com ícones, mobilidade com remover + Desfazer) e do aluno (✓ neutro e verde só no que acabou de marcar, série da vez com o número em destaque, vibração leve/firme, estados na barra "Prévia"). Checagens automáticas dos agentes: Início 147, páginas 37, treinador 314 e aluno 422, sem falha (contraste AA em Escuro, Oceano, Claro e Areia, alvo de 44 px em 390, foco, movimento reduzido, sem rolagem horizontal). A sessão principal conferiu as capturas do Início e do `entrar.html`; as das outras telas foram vistas só pelos agentes.
  - Não conferido: Meia-noite, Ameixa e Café; marcas além do Laranja; leitor de tela, toque e vibração em aparelho real. Sobras da prévia que não sobem para a base porque o destino passou a ser o app: `.faixa-rolavel`, migalha de 44 px, `.ok`/`.ok--agora`, animações `vv-assenta`/`vv-aparece`, contorno da marca de pouco contraste, aviso acima de rodapé fixo (viram referência para a fundação no app).
  - **Feito em 11/11 (estado local, sem commit; base `6dca4d9f`): fundação e Início do treinador.** `base.css` e `base.js` reescritos, `treinador-inicio.html` refeito, fontes em `fontes/` (Geist variável do pacote `geist` 1.9.2 e Metal Mania do `@expo-google-fonts/metal-mania`, com as licenças). O alvo é o padrão ao abrir (Escuro + Laranja `#C2410C`); a barra ficou com marca, paleta, "Bordas reforçadas", "Nome: Padrão | Metal" e "Todas as telas"; o endereço aceita `?paleta=&marca=&bordas=reforcadas&nome=metal`. Início: menu no tom do fundo e conteúdo em painel destacado, rótulo com tracinho na marca, fila "Precisa de você hoje" com abas segmentadas (indicador que desliza) e linhas que abrem a Folha (direita no PC, de baixo no celular), fileira de números na marca entre dois fios, selos em pílula de contorno com ponto, Primeiros passos com número de ordem na marca.
  - Conferido (executor-front, Playwright, Chromium 1194): 1280 e 390 em Escuro, Oceano, Claro e Areia com Laranja, mais Escuro + Vermelho, Folha aberta, bordas reforçadas e nome em Metal; 71 checagens do Início e 30 aberturas das 10 telas + índice sem falha (console, rolagem horizontal, Geist carregada, contraste do texto da marca 5,49 a 6,32:1, botão principal 5,18:1, peças 3,04 a 4,20:1, movimento reduzido sem deslize, teclado da Folha e das abas). A sessão principal olhou 8 capturas (1280 Escuro, Oceano, Areia, bordas, Metal e Folha; 390 Escuro e Folha) e repetiu os dois scripts: 0 falhas.
  - Achado: a Geist nunca carregava nas prévias anteriores (um `*/` no comentário do índice do `base.css` engolia o `@font-face`); corrigido.
  - Não conferido: as outras 6 paletas, leitor de tela, celular e Safari de verdade, captura com movimento reduzido (só os números), 768 px, contraste alto (a prévia não tem).
  - **Falta:** lista e ficha, editores de treino, dieta e mobilidade e as cinco telas do aluno. Elas abrem sem erro com a fundação nova, mas não foram redesenhadas: em 390 as abas do "Cartão Hoje" do aluno quebram em duas linhas e as sessões do editor de treino empilham; em 1280 a coluna "Pasta" da lista quebra a data. Só começam depois de o Gustavo ver o Início.
  - Para decidir no código: o número grande usa o tom de texto da marca (4,5:1), um pouco mais claro que o botão; o tom de peça (mais vivo) daria 3,76 a 4,28:1 nas paletas escuras, que só passa como texto grande (3:1). Capturas e scripts ficam fora do repositório (scratchpad da sessão, pasta `3c`).
- [x] 4. Gustavo aprova a prévia ou pede ajuste — Gustavo — 10/11: aceitou a direção e pediu menos cor; 11/11: redefiniu o alvo; depois gostou do `treinador-treino.html` e mandou o PDF `guia-visual-premium-consultoria.pdf` para aplicar no app, sem prints, tudo numa branch (`visual-premium-comunidade`)
- [x] 5. Fundação no app: papéis de cor em `tema/`, Geist, peças compartilhadas, menu, `docs/design-e-front.md` — executor-front — regras em [guia-premium-no-app.md](visual-vendavel/guia-premium-no-app.md) (o PDF vale sobre "Menos variáveis" nos números e no número da série) — commit/run: sem commit (estado local); typecheck limpo, lint sem erro, Jest 294 suítes e 6710 testes em 11/11; nada conferido renderizado (sem e2e nem captura). A conferir na tela: menu suspenso sem sombra no tema claro e a rolagem do painel do conteúdo no PC (`overflow: hidden`). Perigo do escuro ficou `#FA717B` (o `#FB7185` do PDF ficava perto demais do magenta de categoria)
- [x] 6. Os seis fluxos do PDF (lista, cadastro, ficha, pasta, treino, dieta) e o Início do treinador — executor-front — commit/run: sem commit (estado local, 11/11); lint sem erro e Jest 296 suítes, 6771 testes; e2e não rodados (passo 8). Lista com "Mais filtros" e a linha "Filtrando:" (`ui/BarraDeFiltros`), seleção neutra, "Falta a carga" e "Sem quantidade" em âmbar, séries em abas no PC e sanfona abaixo de 540 px (`TabelaDeBlocos`), macros pela peça `ui/ValoresDaDieta`. A conferir na tela: sanfona das séries a 390 px, "Ir à primeira pendência" no celular, linha "Filtrando:" longa
- [x] 7. Telas do aluno (web e app) — executor-front — commit/run: sem commit (estado local); typecheck limpo, lint sem erro, Jest 296 suítes e 6761 testes em 11/11; e2e não rodados (ficam no passo 8). ✓ neutro quando feito e verde só no recém-marcado (`ui/marcar.ts`, `aluno/useMarcadoAgora.ts`); a conferir na tela: barra da água ainda na cor do texto, medalha e selo de recorde verdes ao reabrir "Bom trabalho!"
- [x] 8. Verificações locais (typecheck, lint, Jest, e2e das telas mexidas) e revisão — commit/run: sem commit (branch local, 11/11): `npm run typecheck` e `npm run lint` limpos (0 erros, 11 avisos antigos), Jest 296 suítes / 6772 testes, e2e inteiro (1253 passaram, 24 falharam, 10 pulados) e, depois das correções, as 11 specs que falharam rodadas de novo (326 testes: 325 passaram e o da importação passou depois de corrigido). Das 24 falhas: 9 eram specs antigas que pediam `button` onde a `Escolha` é `radio` desde 09/11, 1 o link do recorde com `?aba=` (também anterior à branch), 2 a busca do mural (`searchbox`), 2 o teste do selo neutro, reescrito pelo guia, 8 o desalinhamento de 3 px entre Repetições e Descanso (o grupo segmentado tem 50 px; `linhaCompacta` de `treino/CamposBasicos.tsx` passou a alinhar pelo topo) e 2 corridas dos próprios testes (importação e filtros dos Interessados). Revisão independente só da API (comunidade e ajustes do back); as telas não tiveram revisor. Nada foi visto renderizado (capturas dispensadas pelo Gustavo)
- [x] 9. Telas restantes do segundo PDF (`guia-premium-telas-restantes.pdf`, 31 páginas, 11/11): reconciliar cada orientação com a tela de hoje e corrigir só o que falta — executor-front, sete lotes em paralelo com um dono por arquivo (A Atualizações e Agenda; B Biblioteca, Planejamento e Questionários; C Interessados, Números, Equipe e Auditoria; D Importação e Montador; E conta, Marca, Perfil, Segurança e Ajuda; F fluxos públicos) — regras, donos e o texto integral do PDF em [guia-telas-restantes.md](visual-vendavel/guia-telas-restantes.md). Fora: telas do aluno, Comunidade, Início e os fluxos já revisados. — feito em 11/11 pelo executor-front (lotes A a F e o G, da Biblioteca em superfície comum com divisórias) e integrado pela sessão principal ("Revisada" neutra para o treinador e ainda visível na Agenda, pergunta e resposta do detalhe da atualização, motivo no "Salvar seus dados", título "Convite de aluno", textos da Ajuda, `AGENTS.md` e `docs/design-e-front.md`); a reconciliação por tela está em "Resultado" do [guia](visual-vendavel/guia-telas-restantes.md). commit/run: no passo 11.
- [x] 10. Cabeçalho e menu lateral do treinador como na prévia (páginas 28 a 31 do mesmo PDF e o `Documento sem título (3).pdf` do Gustavo): barra de 52 a 56 px com o controle do menu e o contexto à esquerda, busca, Todas as telas e conta à direita; identidade compacta na lateral; grupos discretos; conteúdo começando mais cedo — executor-front (lote N do mesmo guia). — feito em 11/11: barra de topo de ~66 para ~53 px (botão "Minimizar menu"/"Expandir menu" e `contextoDoTopo` à esquerda; busca "Buscar", Todas as telas e conta à direita; compacta abaixo de 1000 e de 840 px), identidade da lateral de 96 para 68 px (`MarcaDoMenu`), contagem neutra no menu aberto, grupos a 12 px; altura útil do conteúdo +13 px (1280×720: 636 → 649; 1440×900: 816 → 829), medidas declaradas pelo lote, não vistas na tela. De fora: subtítulo da identidade (sem dado real) e dica no botão só-ícone. commit/run: no passo 11.
- [ ] 11. Verificações locais do segundo PDF (typecheck, lint, Jest, e2e das telas mexidas, guias em PDF se a Ajuda mudar), commit, merge na `main` e push (autorizados pelo Gustavo em 11/11; sem reconstruir o ambiente local, a pedido dele).

## Critérios de aceite
- Com qualquer uma das 12 cores em qualquer uma das 10 paletas: botão principal, item ativo, chip escolhido e texto na
  cor da marca passam AA (texto 4,5:1, peça 3:1), calculado em `tokens.test.ts`.
- Nenhuma cor de identificação nem a marca se confunde com status (verde, âmbar, vermelho, cinza).
- Cada tela tem um h1, uma ação principal e diz onde a pessoa está (migalha no treinador, título e passo no aluno).
- A cor nunca é a única informação: texto ou ícone junto.

## Fora do escopo
- Sombra e gradiente (o flat com contorno é a identidade; fica). Fonte e raio entraram no escopo em 11/11.
- Tela nova de funcionalidade. Regra de negócio. API.
- Trocar o nome do produto nas telas.
- Qualquer código antes do ok da prévia.

## Prévia
`docs/prototipos/visual-vendavel/index.html` (abrir no Chrome); a tela do alvo de 11/11 é `treinador-inicio.html`. A
barra do topo abre recolhida; "Ajustar" mostra: cor da marca (12 prontas e livre), paleta (10), "Bordas reforçadas" e
"Nome: Padrão | Metal". As chaves Calma/Viva, Seleção e Anotações saíram em 11/11 (passo 3c).

## O que ficou para trás
- A frente [editor-de-treino-reorganizado.md](editor-de-treino-reorganizado.md) está em andamento: o S2 no editor entra
  depois dela ou no mesmo lote, nunca em paralelo nos mesmos arquivos.
- Visto na prévia, para pesar em D3 e D5: com a marca Azul, a seleção pela rampa fica perto da cor do FS; com Bronze,
  o chip escolhido fica perto do aviso âmbar ("Falta a carga"). Texto e ícone seguram a leitura nos dois casos.
- Prévia Calma, desvios do que foi pedido ao agente: grupo com 6 ou mais opções e as sessões abaixo de 600 px usam chips
  soltos (o controle segmentado quebrava em várias linhas); o "Total do dia" da dieta continua em faixa, não em lista
  chave–valor. Com a marca vermelha padrão, a marca e o perigo são a mesma cor (`#C62828`): já estava no S1.
- Para o código (D9 e D11): dois contornos de controle falhavam em 3:1 e foram para `--borda-campo`; a densidade de 36 px
  no PC é exceção ao `ALVO_TOQUE` de 44 e precisa entrar no `design-e-front.md` se for aprovada.
- A prévia não desenhou: trilho de ícones do menu entre 768 e 1023 px, estado "dia perdido" na semana da ficha,
  arrastar item na mobilidade. Os dados de exemplo do Treino A diferem entre as telas (séries e exercícios).
