# Design, hierarquia visual e estrutura do front

Documento para quem vai ajudar no visual ou no front do consultoria-app: uma pessoa de design, um dev ou outra IA.
Explica o que o app é, como o front está montado, os problemas de design que estamos resolvendo e a regra que
vale acima de todas: **manter o sistema funcional, simples e rápido**. Escrito em 30/10/2026, sobre o código da
`main` (commit `68750b2`).


> **Visual-ponytail (17/11/2026), vale acima do que este documento diz sobre cor e superfície:** paletas novas do canvas
> "Overtraining · proposta visual" (página quase da cor do cartão, cartão com raio 20 e `sombra`, contorno sutil), cor de
> ação (índigo padrão, trocável em Ajustes) para ações de construção, aba ativa e item em edição, e excluir sempre com
> texto. Detalhes em `app/src/tema/tokens.ts` e nos testes de `tema/tokens.test.ts`.

---

## 1. O produto em poucas linhas

- **Quem usa:** o **treinador** e a equipe dele montam treino, dieta e mobilidade dos alunos, acompanham as
  atualizações e cuidam dos interessados e da agenda. O **aluno** vê o plano e registra carga e repetições.
- **Onde usa:**
  - O treinador usa quase sempre a **web no PC**, com tela larga, mouse e muita informação.
  - O aluno usa o **celular na academia**, com uma mão, pressa e às vezes sem internet.
- **Um app só** para os dois papéis, na web, no Android e no iOS. A marca (cor, logo e nome) é a de cada
  consultoria e é carregada depois do login.
- **Dado sensível:** peso, dieta, fotos e observações são dados pessoais protegidos pela LGPD. Isso limita o que
  pode aparecer em tela, em log e no aparelho.

---

## 2. Linguagens e tecnologias do front

| Camada | O que usamos | Observação |
| --- | --- | --- |
| Linguagem | **TypeScript** 6 (estrito) | Todo o front. Nada de JavaScript solto, exceto scripts de apoio em `.mjs`. |
| Base | **React 19** + **React Native 0.86** | Mesmo código para web e celular. |
| Plataforma | **Expo SDK 57** | Web pelo **react-native-web**; Android e iOS pelo EAS. |
| Navegação | **Expo Router** | Rotas por arquivo em `app/src/app/`. |
| Estilo | **StyleSheet do React Native + tokens próprios** (`tema/tokens.ts`) | É o padrão: cerca de 220 arquivos usam assim. Uniwind (Tailwind 4) existe, mas só nas peças-base copiadas do RNR (cerca de 12 arquivos). |
| Componentes-base | **RNR** (react-native-reusables, cópia local) sobre `@rn-primitives` | Ficam em `src/components/ui/`. As peças do app ficam em `src/ui/`. |
| Ícones | **lucide-react-native** | |
| Animação | **Reanimated 4** | Respeita "movimento reduzido". |
| Compilação | **React Compiler** ligado | Memoiza sozinho; não usamos `React.memo` à mão. |
| Offline (aluno) | **expo-sqlite** no celular, `localStorage` na web | Fila de envio idempotente. |
| Gráficos | SVG próprio (`GraficoLinha`, `GraficoBarras`) | Sem biblioteca de gráficos. |
| PDF | HTML montado no app + `expo-print` / impressão do navegador | |
| Testes | **Jest** (cerca de 185 suítes, regras puras e telas) e **Playwright** (48 arquivos de e2e na web, com a API simulada) | O e2e roda em 390 px (celular) e 1280 px (PC). |
| Fontes | Geist (texto, desde 11/11); Bebas Neue, Oswald e Metal Mania só no nome da marca | |

**O que não usamos de propósito:** biblioteca de UI pronta (Material, NativeBase etc.), CSS-in-JS de terceiros,
biblioteca de gráficos, Redux ou outro gerenciador de estado global. O estado mora nos *providers* (sessão, tema,
aluno offline) e nas próprias telas.

Os outros fronts do ecossistema (Central e Servirea) são **Angular 21 + Tailwind 3**, outra base. Eles seguem os
mesmos três pilares de design (seção 4.2), mas não dividem código com este app.

---

## 3. Como o front está estruturado

Tudo fica em `app/src/`. A regra é separar **rota**, **tela**, **peça visual** e **regra pura**:

```
app/src/
├── app/          Rotas (Expo Router). Arquivo = endereço. Só monta a tela, quase sem lógica.
│   ├── treinador/   /treinador/...  (início, alunos, ficha, planejamento, biblioteca, agenda, importação…)
│   ├── aluno/       /aluno/...      (início, treino do dia, dieta, mobilidade, histórico, conta)
│   └── entrar, convite, inscricao/[codigo], redefinir-senha…  (telas públicas)
├── treinador/    Peças das telas do treinador (cerca de 140 arquivos): editores de treino e dieta, cartões da ficha, importação…
├── aluno/        Peças das telas do aluno (cerca de 75): cartão Hoje, série, descanso, água, anamnese…
├── ui/           Peças compartilhadas (cerca de 100): Cartao, CabecalhoDeGrupo, Folha, Tabela, LinhaDaLista, Botao, Selo, Alerta…
├── components/ui Base copiada do RNR (button, card, tabs, switch…), adaptada pelos arquivos de ui/
├── dominio/      REGRAS PURAS, sem React (cerca de 140 arquivos, quase todos com teste): datas, cargas, períodos, textos de status…
├── tema/         tokens.ts (cores, espaços, larguras, fontes), TemaProvider, contraste
├── api/          cliente.ts (o único que fala HTTP) e rotas.ts (uma função por rota da API)
├── offline/      AlunoProvider, repositório local (SQLite/web), fila de sincronização
├── sessao/       login, renovação do token, perfil e permissões
├── pdf/          montagem dos PDFs (treino, dieta, mobilidade, cargas, lista de compras)
└── ajuda/        texto único da Ajuda e dos guias em PDF
```

### Regras de organização que mantêm o código sob controle

- **Regra de negócio não mora na tela.** Se é conta, texto de status ou decisão ("mostra o botão?"), vai para
  `dominio/` como função pura com teste. A tela só chama.
- **Uma peça para cada papel.** Lista de registros usa `LinhaDaLista`; seção usa `Cartao`; painel lateral ou
  formulário em cima da tela usa `Folha`; confirmação usa `PainelConfirmacao`; aviso na tela usa `Alerta`.
  Tela nova copia uma existente antes de inventar controle novo.
- **Dados de tela** vêm de `useCarregar` (chave → busca). Nada de buscar dentro de `useEffect` com `setState`
  síncrono (o lint recusa).
- **Permissões:** a tela pergunta `pode('CODIGO')` só para decidir o que mostrar. Quem autoriza de verdade é a API.
- **Nada é salvo sozinho nos editores.** Existem "Salvar rascunho" e "Publicar"; sair com alteração pendente pergunta
  antes (`GuardaDeSaida`).
- **O que não existe não aparece.** Recurso desligado, sem permissão ou sem dado some da tela. Valor ausente é
  "—", nunca zero inventado. Exceção: nos pares rótulo + valor dos Dados do aluno (ficha) o vazio é "Não informado"
  (`NAO_INFORMADO`, em texto suave) e o valor herdado é "Padrão da consultoria" ou "Padrão da consultoria (N dias)":
  ali o traço sozinho, numa coluna de texto, se confunde com um valor cortado.

---

## 4. O sistema visual de hoje

### 4.1 Como esse estilo se caracteriza

É uma **interface flat utilitária, de painel SaaS, organizada em blocos com contorno** (definida no protótipo do
editor de treino de 30/10; decisões em `docs/planos/editor-de-treino-visual.md`). **A partir de 11/11 a pele segue o
guia visual de 11/11** (PDF do Gustavo sobre a prévia `docs/prototipos/visual-vendavel/`; o PDF vale sobre o plano):
borda de 1 px, Geist, seleção neutra, conteúdo num painel ao lado do menu. O que mudou está marcado "(11/11)" abaixo.

**Os nomes que descrevem**
- **Flat design (flat UI):** cores chapadas, sem sombra, sem gradiente (exceção única, 23/11: o cartão de indicador pintado, seção 4.5) e sem efeito de vidro. A profundidade vem só de
  tons de superfície e de linhas.
- **Interface de cartões com contorno (card-based, "outlined cards"):** cada assunto é um bloco fechado por uma borda
  discreta (`divisor`), com uma faixa de título no topo. É o que resolve o "onde começa e onde termina". Contorno forte
  (`bordaCampo`) fica para campo, foco e item selecionado (11/11).
- **Painel SaaS utilitário, com muita informação:** tela de trabalho, densa, para quem usa todo dia (o treinador no
  PC), no espírito de ferramentas como Linear, Stripe Dashboard e Notion.
- **Borda de 1 px (11/11):** containers com 1 px em `divisor`; a preferência "bordas reforçadas" sobe tudo para 2 px
  (`dominio/preferencias`). O neo-brutalismo suave de 30/10 (2 a 3 px) saiu.

**As regras que dão a identidade**
- **Hierarquia por contenção:** página → bloco → faixa do título → item → campo, cada nível com um tom ou uma borda
  diferente. Não se usa cor aleatória para separar.
- **Cor com significado (cor semântica):** verde é "pronto", âmbar é atenção, vermelho é problema e cinza é encerrado;
  onde a cor da marca pode aparecer está na lista fechada da seção 4.5.
- **Seleção neutra (11/11, `ui/selecao.ts`):** a opção escolhida ganha fundo `sobre` (`superficie3` até 17/11), contorno `bordaCampo` e ✓
  (ou, no grupo segmentado de até cinco opções, sobe da trilha `superficie2`); a marca só aparece no indicador pequeno
  (sublinhado da aba, barra do menu ativo). Caixa de seleção e interruptor continuam preenchidos (é o desenho do controle).
- **Mostrar aos poucos (progressive disclosure, padrão "acordeão"):** uma série aberta por vez e as outras resumidas
  numa linha.
- **Status sempre com texto e ícone:** "Pronta", "Corrigir", "1 problema a corrigir"; a cor nunca fala sozinha.
- **Grade de 8 px, cantos de 12 px no cartão e 8 px no controle, fonte Geist (11/11)**, com números alinhados (tabulares).

**Para descrever a um designer ou a outra IA**

> UI flat utilitária de painel SaaS, organizada em cartões com contorno discreto de 1 px e faixa de título; menu no
> fundo e conteúdo num painel levemente destacado; sem sombras nem gradientes (só o cartão de indicador pintado tem um degradê leve da cor da situação); cor só com significado (verde, âmbar,
> vermelho e cinza para status, em pílula com ponto sobre um fundo escuro da própria cor; botão principal neutro, marca só
> no indicador pequeno do item ativo, no título e no cartão "Hoje"); seleção neutra em cinza com ✓; detalhes revelados aos poucos, como acordeão;
> cantos de 12 px no cartão e 8 px no controle, grade de 8 px, fonte Geist.

Termos para procurar referências: *flat SaaS dashboard*, *outlined card UI*, *data-dense admin UI* e *soft
neo-brutalism UI* (este último mostra o lado "borda forte").

### 4.2 Os três pilares (valem em todos os apps do ecossistema)

1. **Cor com significado:**
   - verde = positivo;
   - âmbar = atenção;
   - vermelho = problema ou ação destrutiva;
   - cinza = encerrado.

   A cor da marca **nunca** diz status e só aparece nos lugares da lista fechada da seção 4.5. Status sempre vem num
   selo **com texto**.
2. **Blocos:** tudo em cartão (cantos de 12 px, borda de 1 px em `divisor`, sem sombra nem gradiente, exceto o cartão de indicador pintado de 23/11; 11/11, antes
   2 px). Controles (botão, campo, chip, item de lista escolhível, botão de ícone) têm canto de 8 px (`RAIO_CONTROLE`).
   Sombra, borda e canto são os mesmos em todas as telas: tela não inventa a sua. A ficha é feita de blocos pequenos,
   cada um com seus botões.
3. **SaaS limpo:** visual *flat*, grade de 8 px, tipografia contida, nada decorativo.

### 4.3 Níveis de superfície (o coração da hierarquia)

Escada de 17/11 (`docs/planos/hierarquia-visual-tres-temas.md`, D1 a D6; travada por tema em `tema/tokens.test.ts`):

```text
                                                        Claro      Areia      Escuro
fundo / painel (página; menu e conteúdo no PC)          #D9DCE1    #CDCAC3    #09090B / #0B0B0D
 └─ Cartao   superficie + 1 px divisor                  #FFFFFF    #FFFFFF    #1C1C20 / #36363C (contraste alto: bordaCampo)
     ├─ faixa do título             superficie3         #F2F3F5    #EDEBE7    #26262B
     ├─ poço (item, apoio)          superficie2         #EEF0F2    #F1EFEB    #0F0F11 (mais escuro que o cartão)
     └─ campo   campo + bordaCampo (≥ 3:1)              #FFFFFF    #FFFFFF    #0F0F11
realce (hover, apertado, seleção)   sobre               #E4E5E7    #E6E4E0    #26262B (= a faixa)
hover na faixa e do IconeBotao      sobreNaFaixa        #E4E5E7    #E2E0DC    #2F2F33
painel flutuante (menu, calendário) superficie + borda  #FFFFFF    #FFFFFF    #1C1C20
```

Pisos (D1): cartão × página ≥ 1,35 no Claro (e Céu, Lavanda, Rosa), ≥ 1,6 na Areia e ≥ 1,15 nas escuras, medido sobre o
`fundo` e sobre o `painel`; contorno do cartão (`divisor`) × cartão ≥ 1,4; texto × cartão ≥ 7; faixa diferente do cartão e
da página, poço diferente do cartão (D2). Razões medidas de cada paleta: tabela "Razão final de cada par" do plano.

Realce (A6, 17/11): `sobre` e `sobreNaFaixa` não são escolhidos à mão, saem da escada (`comRealce` em `tema/tokens.ts`):
a faixa andando na direção do `texto`, em passos de 1%, até ficar ≥ 1,10:1 do cartão, do poço e do campo (`sobre`) e
também da própria faixa (`sobreNaFaixa`). Com a escada nova a faixa ficou a 1,03:1 do poço no Claro e 1,04 na Areia (e
mais escura que ele), e o hover que ia do poço para a faixa sumia. Nas escuras `sobre` é a própria faixa (o passo já era
1,27) e o `sobreNaFaixa` é mais claro: clarear a faixa até 1,10 derruba o `perigo` como texto abaixo de 4,5:1, por isso o
`sobreNaFaixa` só leva texto, texto secundário e ícone (3:1). Os dois mudam sozinhos se a escada mudar; o piso está em
`tokens.test.ts`.

Uso de cada nível (11/11):
- **`superficie` + borda `borda` (painel flutuante, 17/11):** menus suspensos (lista suspensa, seleção múltipla,
  calendário, menu da conta, passeio), **sem sombra** (o `SOMBRA_FLUTUANTE` saiu em 11/11). Até 17/11 ficavam no poço,
  que no Escuro passou a ser mais escuro que o cartão onde abrem (1,13:1): agora são cartão, separados do que está por
  baixo pela borda `borda` (≥ 1,9:1 contra o cartão; `bordaCampo` no contraste alto).
- **`superficie2` (poço):** conteúdo de apoio e item dentro do cartão.
- **`superficie3` (faixa do título):** faixa de título (`Cartao`, `CabecalhoDeGrupo`, Tabela, Folha, PainelConfirmacao).
- **`sobre` (realce):** hover, apertado e seleção neutra de linha, item, chip, opção de menu e dia do calendário.
  **`sobreNaFaixa`:** hover do que fica em cima da faixa (`IconeBotao` em qualquer lugar, faixa tocável do grupo e da
  divisão).
- **`painel`:** separação discreta entre o menu e o conteúdo no PC (`Navegacao`); nas paletas claras é o próprio
  `fundo` tingido (12/11), separado do menu pelo contorno `divisor`. Quem pinta o fundo da tela ou casa
  uma cor com ele (`Tela`, o esmaecido das faixas que rolam) usa `useFundoDaArea()` (`ui/fundoDaArea`),
  que devolve `painel` ali e `fundo` no resto. Faixa que rola **dentro de um cartão** esmaece com a `superficie` dele (`AbasDeOpcao`, 23/11).
- **Cartão só informativo** (um número, uma legenda) pode ficar sobre o fundo sem contorno forte; a borda `divisor` basta.
  No contraste alto o contorno do `Cartao` passa a `bordaCampo` (item abaixo).
- **Texto secundário** perde peso (fonte regular, 13–14), não contraste: `textoSuave` ≥ 4,5:1 em toda superfície, nunca
  opacidade.
- Os HEX acima são o ponto de partida do escuro (guia de 11/11). As outras oito paletas (claro, areia, lavanda, céu,
  rosa, meia-noite, ameixa, oceano) têm pares próprios e não precisam repetir esses valores: o que vale é o
  contraste medido em `tema/tokens.test.ts`.
- **Paletas claras (17/11, D3 e D6):** a página (`fundo` e `painel`, que nas claras são o mesmo tom) é tingida e o cartão e
  o campo são brancos, sem sombra: o cartão se destaca pelo tom (≥ 1,35:1) e o campo pelo contorno `bordaCampo`, pelo
  menos o dobro do contraste do `divisor` do cartão. Faixa (`superficie3`) e poço (`superficie2`) ficam entre a página e
  o cartão. Página / faixa / poço: Claro `#D9DCE1` / `#F2F3F5` / `#EEF0F2`; Céu `#D5DDE6` / `#F1F3F7` / `#ECF0F4`;
  Lavanda `#DCDBE7` / `#F3F3F7` / `#EFEFF4`; Rosa `#E1DAE0` / `#F5F2F4` / `#F2EEF1` (regra das três no comentário das
  paletas em `tema/tokens.ts`).
- **Areia (17/11, D4; volta à página do exemplo que o Saraiva aprovou em 14/11):** página (`fundo` e `painel`) `#CDCAC3`,
  cartão e campo `#FFFFFF`, `superficie3` (faixa) `#EDEBE7`, `superficie2` (poço) `#F1EFEB`, `faixaForte`
  `#C3C0B8`, `divisor` `#DED8CD`, `borda` `#A0998B`, `bordaCampo` (também o interruptor desligado) `#6E6659`, `textoSuave`
  `#4C4C54`. A cor da marca não muda. Verde, âmbar e vermelho um passo mais escuros só nessa paleta (`sucesso` `#0A5931`,
  `atencao` `#704300`, `perigo` `#961329`; ver 4.5). A paleta voltou a usar a variante `areia` das cores fixas fora de
  `Cores` (`VarianteDoTema`): agenda AZUL `#1B6ED4`, TURQUESA `#0B7C87`, OLIVA `#697716`, TERRA `#A4564A`; perfil LARANJA
  `#BC4E00`; identificação CIANO `#006483`, AZUL `#1959B4`; destaque azul `#173EAB`, ciano `#0B5D73`, violeta `#6A27D2`.
  Contraste alto: o `textoSuave` do claro (`#3F3F46`) é escurecido na conta até 7:1 sobre fundo, painel, `superficie`,
  `superficie2`, `superficie3` e `faixaForte`; nas claras de sempre segue `#3F3F46`.

- 24 px entre blocos, 16 px dentro do cartão.
- Toque mínimo de 44 px (48 nas linhas de lista e caixas de seleção); fonte mínima de 12.
- **Tipografia (11/11, Geist; `ui/tipografia.ts`):** página 24–28 (`titulo`), seção 18–20 (`bloco` 18/24), corpo 15–16,
  meta 13–14 (`pequeno` 13/18), selo 12. Rótulo de campo sempre visível; o placeholder nunca o substitui.
- **Movimento:** transições de 120–220 ms só em cor, borda e o "afundar" do botão (`translateY 1` + `scale 0,98`),
  desligadas com `useMovimentoReduzido`; nada segura a ação.
- Temas disponíveis: **claro** (padrão), **escuro**, **claro areia** (opção pedida na reunião de 29/10; areia mais escura desde 14/11) e
  **contraste alto**. O contraste de cada combinação é conferido por teste (`tema/tokens.test.ts`): texto ≥ 4,5:1 e
  borda de campo ≥ 3:1.
- **Contraste alto (`dominio/preferencias.coresComContraste`, 13/11):** `borda` (contorno de linha, item e controle)
  vira `bordaCampo`; `divisor` (linha da faixa do título, divisórias de lista e de tabela) sobe só até a `borda`
  original, para as divisórias não pesarem; `textoSuave` ≥ 7:1. O contorno do `Cartao` é a exceção
  (`contornoDoCartao`): `divisor` no padrão e `bordaCampo` no contraste alto, porque o fundo do cartão quase não se
  separa da página (cerca de 1,1:1) e é o contorno que marca a seção. Medido em 13/11 (Alunos, Financeiro › Cobranças
  e Ajustes, 1280 e 390 px; `e2e/cartao-contraste-alto.spec.ts`): o contorno contra a página e contra o cartão ia de
  1,75 a 1,95:1 no claro e de 2,09 a 2,33:1 no escuro; agora vai de 3,5 a 3,91:1 no claro e de 4,66 a 5,2:1 no escuro
  (o jest confere ≥ 3:1 nas nove paletas). Não era falha da WCAG 1.4.11 (o cartão é contêiner estático, identificado
  pelo título e pela faixa, não componente de interface): o ajuste cumpre o que a preferência promete. Com contraste alto **e** "bordas reforçadas" o
  `divisor` também chega a `bordaCampo` (as divisórias engrossam): é o efeito pedido pela segunda preferência.
- Seleção (chips, escolhas) é **neutra** (11/11): `sobre` + `bordaCampo` + ✓, nunca a cor da marca.
- Larguras:
  - formulário: 640;
  - editor: 1040 (em coluna única);
  - editor em lista + inspetor (treino, dieta, mobilidade, a partir de 960 px de conteúdo): até 1800, como as
    listas, com a "Configuração do plano" segurando os campos em 1040 (Gustavo, 04/11);
  - lista e painel: até 1800;
  - aluno: teto próprio por faixa, 1120 até a `normal` e 1688 da `larga` em diante (`TelaDoAluno`, 24/11);
  - Comunidade do treinador: coluna de leitura de 800 (constante local da tela, guia de 11/11; `LARGURA_LISTA` não muda).
- Pontos de quebra: abaixo de 768 px é celular (barra inferior); de 768 a 1023, menu lateral em trilho, com o
  rótulo curto embaixo de cada ícone; a partir de 1024, menu lateral completo, em grupos com título.

### 4.4 Peças principais

| Peça | Para quê |
| --- | --- |
| `Cartao` | Seção. Com título ganha a **faixa de cabeçalho**. Pode ser recolhível. |
| `CabecalhoDeGrupo` | Faixa de grupo (sessão, refeição, pasta, dia), recolhível, com resumo e selo. |
| `Folha` | Painel por cima da tela (formulários, escolhas). No PC pode ser arrastada pelo cabeçalho; no celular o mesmo arraste fecha. Entra no histórico do navegador. |
| `LinhaDaLista` / `ListaDeLinhas` | Lista de registros numa coluna: título, metadados, selos, ações. `ListaDeLinhas divisorias` (11/11): superfície comum, sem caixa por linha, divisória `divisor` só entre as linhas, realce `sobre` no hover com mouse, no foco e com o conteúdo de baixo aberto; seleção neutra mantida; padrão desligado (hoje só a Biblioteca usa). |
| `Tabela` | Colunas no PC, cartões empilhados no celular. `detalhe` põe um conteúdo extra abaixo do registro (a observação do peso); a coluna `acao` com `largura` fixa guarda os botões (Ações do peso, 64 px). `tingida` (24/11): linha que pede atenção (a lesão ativa), fundo liso `forte` e fio de `atencao` (`ui/superficiePintada`). Na tabela larga a linha tingida não leva borda própria: o fio é o de baixo da linha de cima, na cor da tinta se qualquer das duas é tingida, e a última não tem fio (a caixa recorta e fecha). No cartão empilhado, a borda do cartão. Nunca só a cor: o motivo também vai em texto (selo). |
| `ListaDeDados` / `LinhaDeDado` / `SubtituloDeDados` (24/11) | Pares rótulo–valor de leitura com ações: rótulo `textoSuave` numa coluna de 200 px (× tamanho do texto), valor ao lado, coluna de ações à direita centralizada na altura, 48 px mínimos, fio `divisor` embaixo de toda linha, inclusive a última de uma seção seguida de outra seção; só a última do cartão fica sem (`dominio/listaDeDados.linhaSemDivisoria`). Subtítulo de seção com 24 px acima e 12 px até a primeira linha. Todo botão ou ícone numa linha é pequeno (25/11): `Botao tamanho="pequeno"` (desenho de 32 px dentro de um alvo transparente de 44, rótulo 13 e ícone 16) ou `IconeBotao compacto` (32 px, também com `moldura`); o alvo entra 6 px no respiro da linha e o desenho fica a 8 px da divisória, então a linha com botão tem a mesma altura da sem botão (48 px no arranjo em linha). Fora da lista de dados o `Botao` segue no tamanho padrão. A lista mede a própria largura e empilha (rótulo em cima, em todas as linhas juntas) abaixo de rótulo + 16 + 200 (`dominio/listaDeDados.empilhaDados`). `vazio` ("—" ou "Não informado"), `numerico` só nos números (`partesNumericas`), `conteudo` (chips, selo), `nota`, `dica` (title + nome acessível). Subtítulo em caixa alta abre um grupo. Grupo = `role="list"`, linha = `listitem` com `term`/`definition` (o react-native-web 0.21 não gera `dl`); o par tem o nome "Rótulo: valor" e as ações ficam fora dele. Quem chama decide quais linhas existem (componente que pode devolver `null` não abre grupo). Usada nos Dados do aluno, Acesso ao app, Plano contratado e Conta › Meus dados. |
| `GraficoLinha` | Gráfico SVG próprio. Opcionais, que não mudam os usos antigos (peso e avaliação física, 13/11): `segmentos="retos"` e `semArea` (só os pontos medidos, sem sugerir valor entre as datas), segunda série tracejada em outra cor com legenda em texto (`serieB`, no máximo duas), dica por mouse, toque e teclado (`textoDaDica`), `destacarUltimo` e as pontas do eixo escritas só quando há `escala` (ou `legendaDaEscala`) com os mesmos números da legenda. Alvo de toque do ponto: 44 px (`ALVO_TOQUE`), com o desenho menor; pontos próximos dividem o espaço no meio do caminho entre os centros, sem sobrepor alvos. |
| `Alerta` | Caixa de aviso: `perigo` (erro), `atencao` (cuidado, mas não impede), `sucesso`. |
| `Selo` | Status curto com texto (11/11): `sucesso`/`atencao`/`perigo` viram pílula com ponto e texto na cor sobre o `*Suave` da situação; o estado normal (`neutro`) é só texto secundário, sem pílula. `categoria` (tipo de série, refeição: `useTema().identificacao[chave]`) é pílula escura com o texto na cor da categoria, sem ponto. |
| `Botao` | Um `primario` por área, **neutro** (17/11, D7): fundo `texto` e rótulo `fundo` (preto no Claro e na Areia, branco nas escuras), hover 15% na direção da página (`coresDoBotaoPrincipal`); a marca não pinta botão. O secundário tem borda `bordaCampo` e hover `superficie2`. `perigo` (confirmação destrutiva do painel) é contorno e rótulo em `perigo`, sem fundo cheio, hover `perigoSuave`; `perigoTexto` é o fantasma vermelho. `destaque` (17/11, D12) é a ação de apoio que precisa ser achada sem competir com a principal: fundo **opaco** `informacaoSuave` (a informação a 12% sobre o cartão), rótulo e ícone `informacao`, contorno `informacao` com o mouse em cima ou apertado (o fundo não escurece); hoje só "Usar receita" do exercício (no título Séries ou no estado vazio) e "Adicionar refeição" e "Modelos prontos" do editor de dieta. O tipo `cta` saiu. Todos com 44 px de altura mínima, foco pelo `anelFoco`, afundar ao apertar (sem movimento com "reduzir movimento"), carregando com indicador e desabilitado sempre com o porquê (`motivo`). |
| `Campo` / `MensagemDeErro` | Rótulo permanente, ajuda abaixo do campo, erro com ícone + mensagem + borda `perigo` (`MensagemDeErro` também na `Escolha`, no endereço e na `EscolhaEmFolha`); foco visível pelo `anelFoco`. |
| `Escolha` | Até cinco opções sem contagem = grupo segmentado; mais = chips com ✓. `contagem` mostra "Todos 48" em texto secundário sem mudar o alvo de toque. |
| `Abas` | Aba ativa com texto forte e sublinhado de 2 px em `marcaPeca`; contagem em pílula neutra; sem a versão invertida. |
| `Navegacao` | PC: menu no `fundo`, conteúdo no `painel`; item ativo em `superficie3` com a barrinha da marca; no trilho do tablet o rótulo curto fica embaixo do ícone; no minimizado o Início e os controles só de ícone mostram o nome no hover/foco e cada grupo vira um ícone que abre o submenu flutuante com os itens dele (`ui/SubmenuDoTrilho`, "Menu Button" da WAI-ARIA APG: Enter, Espaço e ↓ abrem no primeiro item, setas, Home/End, Esc devolve o foco ao ícone, Tab fecha; sem animação). No menu aberto, um fio vertical de 1 px em `borda` liga os itens do grupo aberto, na coluna da barrinha. Sem barra de topo (guia de 11/11): o conteúdo começa no respiro da `Tela`. Na web do treinador o menu lateral (24/11, padrão "ícones ao lado do logo") tem, de cima para baixo, **uma linha só no topo**: a logo e o nome da consultoria à esquerda (uma linha, reticências se longo, `minWidth: 0`) e, à direita, os botões de ícone [Recolher barra lateral] [Buscar] (`BotaoDoTopo`, neutros, 32 × 44 de área, hover sutil, foco visível, nome acessível, `shortcut:` por ficar abaixo dos 44 px de toque, que cabe só com mouse; o campo "Buscar" abaixo da logo saiu); recolhido (72 px), a logo no topo e abaixo os ícones empilhados [Expandir barra lateral] [Buscar], depois a navegação como sempre; só onde o menu recolhe; 240 aberto, 88 no trilho do tablet (lupa com "Buscar" embaixo, sem recolher; igual a antes); dica em cada ícone com o atalho ("Recolher barra lateral  Ctrl+B", "Expandir barra lateral  Ctrl+B", "Buscar  Ctrl+K"; ⌘ no Mac, `dominio/atalhosDoMenu`), no mouse e no foco, Esc a dispensa, aberta abaixo do ícone na barra expandida (para não cobrir o título da tela) e à direita na recolhida; **Ctrl+B alterna a barra e Ctrl+K abre a busca, sem agir com o foco em campo de texto, textarea, select ou conteúdo editável nem com Shift ou Alt**; título de grupo em 14 px semibold; a busca (`ui/BuscaGlobal`): abre a `Folha` "Buscar", com as favoritas e a estrela 44 px em `atencao` em cada tela; não há sino porque não existe central de notificações do treinador; a lista que rola e, fixa no pé, a conta (`ui/CartaoDoUsuario`: iniciais, nome que trunca e perfil; recolhido, só as iniciais com o nome na dica; o menu abre para cima no aberto e para o lado nos estreitos). No celular não há faixa global: Perfil › "Buscar telas" abre a mesma busca. No nativo largo, o recolher fica na linha da marca e a conta segue em Perfil. O menu aberto mostra a contagem neutra (contorno `divisor`, texto `texto`) de Atualizações e Interessados, e o ponto fica no trilho, no recolhido e no celular. Celular: barra inferior com pílula `superficie3` no ativo. |
| `corDoNumero` (`ui/indicador.ts`) | Número solto fora de cartão de indicador: comum em `texto`, atrasado em `perigo`, zero em `textoSuave`, nunca a marca. Número em cartão de indicador segue o `CartaoDeIndicador` (linha abaixo). |
| `CartaoDeIndicador` / `GradeDeIndicadores` (23/11, pintado) | Rótulo + número grande + detalhe. Com `tom` (`sucesso`, `atencao`, `perigo`, `informacao`, `conquista`) ou `corDeCategoria` (identificação), o cartão é **pintado** por `ui/superficiePintada`: degradê de 135° da cor misturada à base (14% nas escuras, 8% nas claras e na Areia) até a base pura em 70%, borda de 1 px na cor a 50%, ponto com brilho (ou `Icone`), rótulo e número na cor quando ela passa 4,5:1 no ponto mais forte (senão `texto`); detalhe em `textoSuave`. Neutro (sem significado), zero e indisponível: base, borda `divisor`, sem ponto. `lugar="cartao"` usa o poço `superficie2` como base. Contrato para outras peças: `superficiePintada(cor, base, variante, cores)` → `{ base, forte, degrade, borda, texto }` e `fundoPintado(p)` (estilo do fundo; quem quer liso usa `p.forte`). `textual` (24/11): valor em frase, fonte normal, para o que não é número ("Ontem", "Sem atualização pendente"). Cor de categoria pode ser o azul ou o ciano de destaque (`useDestaques()`) quando não há token de categoria; a situação vence a categoria quando o dado já tem uma. Resumo da ficha: três cartões lado a lado na mesma grade; em texto grande a grade empilha. |
| `EscolhaSuspensa` / `EscolhaEmFolha` | Escolha com busca: lista suspensa no PC, folha no celular. |
| `TabelaDeBlocos` (`treinador/treino`, 16/11) | Blocos de séries do exercício: lista de abas vertical com ativação manual (setas movem o foco, Enter e Espaço escolhem). Colunas Série, Tipo, Carga, Reps e Descanso; abaixo de 390 px da coluna das séries cada bloco vira linha empilhada. Ver 4.7. |
| `EscolhaDoExercicio` (`treinador/treino`, 16/11) | "Exercício aberto" no celular, com 3 ou mais exercícios na sessão: abre a folha com todos e rola até o escolhido (`EscolhaEmFolha`). |
| `useFaixaDaTela` (`ui/Tela`, 23/11) | A faixa de largura (4.10) que a `Tela` mede para a área ao lado do menu, por contexto; é com ela que o layout dentro da tela decide colunas e painel fixo (`PainelDaCobranca` na `ultralarga`). Fora de uma `Tela`, `compacta`. |

### 4.5 Cor por situação (Gustavo, 03/11)

Duas regras. Plano e passos em `docs/planos/auditoria-cores.md`.

1. **A cor da marca serve só para identidade e destaque pequeno** (desde 17/11, D7 e D8: o botão principal é neutro). Erro
   e alerta têm tom próprio, e desabilitado é cinza.
2. **Uma cor por situação, e âmbar só para quem precisa agir.** Quem espera vê neutro, e o texto diz quem age. Por
   exemplo, a atualização enviada diz "Enviada · aguardando revisão" ao aluno, em neutro, e "Para revisar" ao
   treinador, em âmbar.

   **Exceção: status de cobrança** (Gustavo, 03/11). Segue os três tons que aluno e treinador já conhecem de outros
   apps, mesmo para quem só espera: Em aberto `atencao`, Vencida `perigo`, Paga `sucesso`, Cancelada e Isenta `neutro`
   (`dominio/minhaConta.situacaoDaCobrancaParaTela`; o mesmo vale para as cobranças do Financeiro).

A cor nunca fala sozinha: todo status leva texto, e todo erro ou alerta leva ícone. A regra vale para qualquer marca:
a cor da marca muda por consultoria, mas `sucesso`, `atencao` e `perigo` são fixos no tema (`tema/tokens.ts`) e nunca
vêm da marca; por isso o status de cobrança também leva sempre o texto ("Em aberto", "Vencida", "Paga"). O selo de cobrança fica só
com o texto, sem ícone e sem mudar o desenho do `Selo` (Gustavo, 04/11).

**Onde a marca pode aparecer (lista fechada).** D8 (17/11) reduz o alvo a três lugares: menu ativo, título e cartão "Hoje"
do aluno. O `Botao primario` já saiu (neutro, D7); os demais itens abaixo ainda usam a marca no código e esperam a troca
(pendência do plano `hierarquia-visual-tres-temas.md`):
- nas telas públicas da consultoria, `BotaoPublico`;
- indicador pequeno do item de menu ativo e da aba ativa (barra ou sublinhado, `marcaPeca`; o fundo do item é neutro, 11/11);
- cartão "Hoje" do aluno;
- nome da marca (`MarcaTitulo`), a inicial no trilho do menu (`MarcaDoTrilho`) e a da identidade do menu aberto (`MarcaDoMenu`, 68 px, logo e nome numa linha);
- dia de hoje e ações do `Calendario`;
- PDFs: faixa, título das seções, cabeçalho das tabelas e valores em destaque (carga e quantidade);
- prévias da Marca e das Preferências;
- barra da sessão no editor de treino (`CartaoSessao`);
- dia treinado no cartão para compartilhar (`cartaoDoTreino`).

Qualquer outro lugar precisa de decisão nova.

| Situação | Tom (token) | Quando usar | Exemplos | Aluno e treinador | Mínimo WCAG AA | Pior valor medido (claro · areia · escuro; 17/11 nas linhas de ação e situação, 11/11 nas demais) |
| --- | --- | --- | --- | --- | --- | --- |
| Ação principal | neutra (17/11, D7): fundo `texto`, rótulo `fundo`, hover `coresDoBotaoPrincipal().fundoAoPassar` | Uma por área | "Salvar", "Publicar treino", "Começar treino" | Sim | 4,5:1 (texto) | rótulo sobre o botão: 14,47 · 12,16 · 19,39; sobre o hover: 10,59 · 9,24 · 13,96 |
| Ação de apoio em destaque | `acao` do `Botao` (17/11; `destaque` é o mesmo, nome antigo): fundo `acaoSuave`, rótulo e ícone `acao` (índigo por padrão, configurável em Ajustes), contorno a 35% e cheio com o mouse em cima. **Regra da cor de ação (24/11):** `acao` = ação que **cria ou manda algo novo** (adicionar, registrar, enviar, gerar, novo/nova, trocar-por-outro); `secundario` (neutro) = ação que só **altera ou mantém** (editar, mudar, definir senha, copiar, configurar, alterar). Rótulo condicional leva o tipo condicional ("Enviar logo" `acao`, "Trocar logo" `secundario`). Ambíguo (sem verbo, envio de formulário ao lado do `primario`) fica `secundario`; "Trocar" de uma configuração que já existe (foto, chave, credenciais, capa, metodologia) e "Renegociar" são `secundario`; "Cobrar renovação pelo WhatsApp", "Contratar plano", "Usar modelo" e "Usar pacote" são `acao`; "Publicar" é a ação principal da tela e não entra na regra. **Regra complementar (24/11, fechamento do lote):** botão que se repete em cada linha de tabela ou em cada cartão de uma lista fica `secundario`, mesmo que crie ou mande algo ("Registrar pagamento" por linha da inadimplência; "Nova série" tracejado neutro, "Trocar exercício" e "+ Opção" dentro de cada cartão; "Adicionar pergunta" por seção; "Adicionar item" por seção da mobilidade): a cor de ação aparece uma vez por área | Ação de construção que o treinador precisa achar e não é a principal da área; não substitui o `primario` (continua um por área) | "Adicionar exercício", "Usar receita de séries", "+ Opção", "Adicionar refeição" e "Modelos prontos" da dieta | Treinador | 4,5:1 (texto); 3:1 (contorno do hover) | `coresDaAcao` garante ≥ 4,5:1 para rótulo/ícone no cartão e em `acaoSuave` em todas as paletas (`tokens.test.ts` e `contrasteDasPecas.test.ts`) |
| Destaque da marca | `marcaPeca` (indicador), `marcaTexto` (texto e ícone) | Só nos lugares da lista acima | Menu ativo, nome da marca, cartão Hoje | Sim | 4,5:1 (texto); 3:1 (peça) | `marcaTexto` ≥ 4,5 e `marcaPeca` ≥ 3 por construção (`marcaParaTexto`, `marcaParaPeca`) |
| Positivo, concluído | `sucesso` | Terminou bem e não falta nada | Paga, Ativa, Revisada, Sincronizado, Treino concluído, Realizado, Com acesso, Publicado | Sim | 4,5:1 | cartão 7,06 · 8,45 · 10,34; pílula 5,89 · 6,94 · 8,12 |
| Pendente, alguém precisa agir | `atencao` | Falta uma ação de alguém, mas nada impede de seguir | Em aberto, Para revisar, Responder até, Adiada, Pausada, Contestada, Alterações não salvas, "Falta a carga" e "Sem quantidade" (campo vazio que ainda vai ser preenchido; valor inválido é `perigo`) | Só quem age (a cobrança Em aberto, para os dois: exceção acima) | 4,5:1 | cartão 7,05 · 8,43 · 9,29; pílula 5,89 · 6,92 · 7,29 |
| Problema, erro ou atraso | `perigo` em texto, ícone e borda; o `Botao perigo` é contorno e rótulo `perigo`, sem fundo cheio (D7) | Algo deu errado, impede de seguir ou passou do prazo; ação destrutiva | Atrasada, "Vencida há N dias", Falhou, Faltou, Corrigir, Falha ao salvar, erro de campo | Sim | 4,5:1 | cartão 7,30 · 8,67 · 5,28; pílula 5,91 · 6,98 · 4,58 (pior das nove paletas: Ameixa, 4,51) |
| Informação | `informacao` (17/11, D9) | Medida ou estado sem juízo: o que está acontecendo agora | Série em andamento do aluno, número de indicador sem juízo no painel | Sim | 4,5:1 | cartão 5,82 · 5,82 · 6,02; pílula 4,89 · 4,89 · 5,04 (pior: Oceano, 4,80) |
| Conquista | `conquista` (17/11, D9) | Recorde, nível, marca pessoal | Aviso de recorde, "Recordes da semana" no painel, `BadgeNivel` | Sim | 4,5:1 | cartão 6,68 · 6,68 · 5,86; pílula 5,52 · 5,52 · 4,93 (pior: Oceano, 4,74) |
| Encerrado, inativo ou informativo | `neutro` | Acabou, foi desligado, ou é só informação, inclusive o que ainda vai acontecer, sempre com a data; também quem espera a ação de outro | Cancelada, Estornada, Encerrada, Arquivado, Inativo, Pasta concluída, Dispensada, Sem conexão, "Em 15 dias", "Enviada · aguardando revisão" (quem espera); rascunho sem erro (11/11): Rascunho, Nunca publicado, Alterações não publicadas, Alterado desde a publicação | Sim | 4,5:1 | `textoSuave` sem pílula: 6,26 · 6,04 · 6,83 (sobre `superficie3`) |
| Desabilitado | fundo `superficie3`, borda `borda`, texto e ícone `textoSuave`, sem opacidade e sem a marca | Controle que não pode ser usado agora | Botão com `motivo` ("Preencha o nome"), opção indisponível, ✓ na prévia | Sim | Isento pela WCAG 1.4.3; o `motivo` abaixo é texto comum (4,5:1) | `textoSuave` sobre `superficie3`: 6,26 · 6,04 · 5,42 |
| Seleção | neutra (11/11): fundo `sobre` (17/11), contorno `bordaCampo`, ✓ e letra `texto`; caixa de seleção e `Interruptor` seguem preenchidos | Opção escolhida (chips, `Escolha`, calendário, opção de folha) | Chip marcado | Sim | 4,5:1 (texto); 3:1 (contorno) | `texto` sobre `sobre` ≥ 12,6 (pior: ameixa); `bordaCampo` ≥ 3:1 (pior 3,56, ameixa) |
| Identificação | paletas próprias (`PALETA_DE_IDENTIFICACAO`, agendas, fases e `PALETA_SO_DO_PERFIL`) | Diz *qual* coisa é, nunca status | Tipo de série, refeição, agenda, fase do ciclo, cor do perfil na Comunidade | Sim | 4,5:1 (texto); 3:1 (marcador) | conferido em `tokens.test.ts` |

- **Cinco papéis de situação (17/11, D9; `ui/contrasteDasPecas.test.ts`, nas nove paletas):** `sucesso`, `atencao`,
  `perigo`, `informacao` e `conquista`, cada um com a pílula `*Suave` = a cor a 12% sobre o cartão (`tingidoDaPilula`).
  O número principal fica em `texto`, menos no cartão de indicador pintado (23/11, item abaixo), onde vai na cor quando ela passa 4,5:1; a cor entra na pílula, na barra, no ícone e no tingido. Valores decididos:
  escuro `#00E699 #FFB020 #FF4D6A #4D9BFF #B57BFF`; Claro e Areia `#0E7A43 #8A5300 #C01834 #1D5FD1 #7A2FD0`. Ajustados o
  mínimo para os pisos que já existiam (o texto da caixa `Alerta` direto na página e a série feita do aluno a 4,5:1):
  Claro `sucesso` `#0C6638`, `atencao` `#804D00`, `perigo` `#AB152E`; Areia `#0A5931`, `#704300`, `#961329`; `perigo` da
  Meia-noite `#FF4F6B` e do Oceano `#FF526E` (a faixa e a pílula deles). Informação e conquista ficaram como decididas.
  Os tokens neon do estudo (`stndrd.neon`) só sobram no Financeiro, marcados `shortcut:` em `tema/tokens.ts`.
- **Casos que não estão na tabela** (04/11; teste `dominio/corPorSituacao.test.ts`):
  - **Atualização revisada** (11/11, segundo guia): para o treinador `neutro` (`statusAtualizacaoTreinador`: é
    informativa; "Para revisar" segue `atencao`); para o aluno continua `sucesso`.
  - **Etapa da inscrição** (`dominio/inscricoes.seloDaSituacao`, 11/11): Nova, Em contato e Em negociação `neutro`
    (é etapa; o destaque é do retorno atrasado ou de hoje), Aceita `sucesso`, encerradas `neutro`.
  - **Situação do membro da equipe** (11/11): texto neutro ao lado do perfil (convite pendente é espera).
  - **Cor da marca** (11/11): só nome e amostra, sem frase de emoção.
  - **Prévia "Para o aluno"** do editor de séries (19/11, séries no padrão da dieta; antes, de 11/11, era caixa com fundo e borda na cor do estado): sem caixa, no rodapé da série aberta, com o ícone na cor do estado (✓ `sucesso` quando não há nada a corrigir, ⚠ âmbar com aviso, ⊗ vermelho com erro); o texto continua na cor do texto.
  - **Acesso do aluno** (`CartaoAcesso`, só a equipe vê; `dominio/cadastroDoAluno.seloDoAcesso`): Sem acesso `neutro`,
    Aguardando primeiro acesso `neutro` (quem age é o aluno; o treinador espera), Com acesso `sucesso`.
  - **Pagamento da inscrição** (`dominio/inscricoes.seloDoPagamento`): Aguardando `atencao` (exceção da cobrança; o
    treinador confirma à mão), Não controlado `neutro`, Confirmado (manual) `sucesso`.
  - **Cobrança contestada** (`dominio/financeiro.seloDaCobranca`): Contestada `atencao` para o aluno e para o treinador
    (exceção da cobrança; o treinador decide entre manter paga e estornar); Estornada `neutro`.
  - **Consumo da conta** (`dominio/minhaConta.estadoDoConsumoParaTela`, só quem tem `CONTA_LER`): Dentro do limite
    `sucesso`, Perto do limite e Limite atingido `atencao` (o administrador decide se amplia), Acima do limite
    `perigo`, Sem limite configurado `neutro`.
- **Selo sobre a `faixaForte`:** o selo sem ícone tem fundo transparente e, sobre essa faixa, fica abaixo de 4,5:1.
  É o caso do selo do grupo muscular, de "Cardio", de "Sem progressão" e de "Fora da biblioteca", na faixa do
  exercício do editor de treino. Medido:
  - `neutro`: 4,49 · 4,25 · 4,43;
  - `sucesso` no areia: 4,37;
  - `atencao` no areia: 4,28;
  - `perigo` no escuro: 4,01.

  Regra: o selo de situação tem sempre fundo opaco (`*Suave`, 11/11; os números acima são do selo antigo, transparente).
  O `neutro` virou texto secundário sem pílula e é conferido sobre a `faixaForte` em `ui/contrasteDasPecas.test.ts`.
- **Categoria e macros (11/11):** badge de categoria é pílula escura com o texto na cor da categoria (`Selo categoria`).
  Marcas de macronutriente saem sempre da peça `ui/ValoresDaDieta` (`MACROS`, `MarcaDoMacro`, `kcalNaTela`,
  `gramasNaTela`; editor da dieta e dieta do aluno usam a mesma): ponto na cor de identificação e o número neutro,
  nunca o verde de `sucesso` nem o vermelho de `perigo` (a distância ΔE ≥ 40 entre categoria e status é conferida em
  `tokens.test.ts`). Tela nova de macro reutiliza a peça; não cria cor nem formato próprio.
  **Regra (19/11, Gustavo): as cores de macro (proteína, carboidrato, gordura e fibra) são só marca, nunca cor de texto.** A
  marca de 8 px precisa de ≥ 3:1 (`tokens.test.ts`); rótulo e valor ficam sempre em `texto` ou `textoSuave` (4,5:1). É por
  isso que a fibra (verde-lima, `PALETA_DA_FIBRA`, fora das cores de identificação e a ΔE ≥ 40 do verde de `sucesso`) pôde
  ser clara o bastante para diferir em luminosidade das outras três (ΔL* ≥ 10, para quem não distingue cores): no tema
  claro e na areia ela passa 3:1, não 4,5:1, e por isso nunca vira texto. Conferido em 19/11: nenhuma das quatro aparece
  como cor de texto no app (o `cor.cor` da dieta do aluno é a cor da refeição, outra categoria). Tela nova que precise
  da cor de um macro em texto troca por marca + texto neutro; não escurece a marca. A `LegendaDosMacros({ fibra = true })` de `ui/ValoresDaDieta` mostra "■ Fibra" (verde-lima, a mesma marca da linha) depois de "G = gordura" na Biblioteca › Alimentos, na folha Alimentos do editor de dieta e na dieta do aluno (aqui só se algum item tem fibra, `omitirFibraSemValor`).
  **Cor por modalidade do exercício (24/11, `dominio/exerciciosDaBiblioteca.COR_DA_MODALIDADE`):** só cores de identificação já existentes, sem token novo: Peso livre ciano, Máquina azul, Elástico índigo, Peso corporal violeta, Cardio magenta, Outro neutro (`textoSuave`). **Cor é só marca**, como a dos macros: bolinha de 8 px antes do nome da modalidade, texto neutro, ≥ 3:1 em `superficie`, `sobre` e `superficie2` nas 9 paletas × contraste alto × bordas reforçadas (`exerciciosDaBiblioteca.test.ts`). A legenda acima da lista mostra só as modalidades da lista à vista (`treinador/biblioteca/ModalidadeDoExercicio`). A linha de detalhe fica "● Máquina · Abdômen · Cabo" + ícones neutros de play ("Tem vídeo") e imagem ("Tem imagem") no fim, com `role=img`, nome acessível e `title` na web; "com vídeo" em texto saiu. Filtros do painel da aba Exercícios: Grupo muscular (com "Buscar grupo"), Modalidade (multi-seleção com a bolinha, prop `marca` de `ui/CaixaSelecao`), Vídeo e Imagem em segmento (Todos · Com · Sem), chips em "Filtrando:" e "Limpar filtros".
- **Feito e recém-marcado (11/11, `ui/marcar.coresDoMarcar`, `aluno/useMarcadoAgora`):** o ✓ do que já estava feito é
  neutro (`superficie3`, `bordaCampo`, ✓ em `textoSuave`); verde (`sucessoSuave`/`sucesso`) só no que a pessoa acabou
  de marcar nesta tela. Verde é comemoração curta, não o estado permanente da lista.
- **Número (11/11):** indicador, total do dia e número da série em `texto` (exceto no cartão de indicador pintado, item abaixo). Só o atrasado é `perigo`
  (`ui/indicador.corDoNumero`). A série em edição é a regra do item seguinte (19/11), não cor no número.
- **Cartão de indicador pintado (Gustavo, 23/11; plano `docs/planos/cartao-de-indicador-pintado.md`):** cor só onde
  significa algo. Situação: recebido, recebido das cobranças e pago `sucesso`; a receber, em aberto, vencendo e para revisar
  `atencao`; em atraso, vencido, atrasadas e saídas avulsas `perigo`; receita recorrente mensal `informacao`; recordes
  `conquista`. Categoria: tipos de série (Séries por tipo do editor) e entradas avulsas (o azul que os Lançamentos já usam).
  Neutros: alunos pagantes, valor médio, total, resultado, contagens e medidas sem juízo (Interessados, exceto Aceites em
  `sucesso`; treinos registrados do resumo do aluno; o peso medido). Valor zero ou "—" volta a neutro. O fundo é o degradê de
  `ui/superficiePintada` (`experimental_backgroundImage` no nativo, `backgroundImage` no web), a única exceção ao "sem
  gradiente"; a faixa grossa à esquerda saiu. O texto na cor é conferido no ponto mais forte do degradê nas 9 paletas, com
  contraste alto e bordas reforçadas (`tema/tokens.test.ts`, "superfície pintada"); onde não passa 4,5:1, vai em `texto`.
  **Só o marcador (25/11):** `corDoMarcador` pinta só a bolinha (8 px, sem brilho) com a cor de categoria; cartão, borda, rótulo e valor ficam neutros, inclusive no zero (é identificação, não sinal). Usado em "Treinos esta semana" (Frequência e mobilidade da ficha), com o azul do treino (`useDestaques().azul`, o mesmo de "Treinos registrados" do Resumo); "Mobilidade esta semana" fica sem bolinha. Bolinha ≥ 3:1 sobre `superficie` e `superficie2` (`ui/aparenciaDoIndicador.test.ts`).
- **Um nível de destaque por vez (Gustavo, 19/11; séries no padrão da dieta):** o destaque de "em edição" (cor de
  ação) aparece num nível só. A lista mestre marca o item escolhido (`ItemDaListaDoEditor`: fundo `acaoSuave`, contorno
  de ação e o selo "Editando", que fica só ali); o painel que está sendo editado ganha a faixa vertical de 6 px à esquerda
  (no treino, `CartaoExercicio` aberto, na cor de ação; na dieta, `CartaoRefeicao`, na cor de identificação da refeição);
  o item aberto dentro do painel (a série) usa só o fundo tingido (`coresDaEdicao().fundoDoBloco`, 8% da ação sobre o
  cartão), sem contorno, halo nem selo, com o chevron ↓ na cor de ação. Nada de moldura de ação dentro de moldura de
  ação, nem o mesmo título repetido (a linha aberta já é o título do bloco; o nome acessível "Editando série N, tipo"
  fica para o leitor de tela). O tingido é 8% e não o `acaoSuave` (13%) porque com a marca amarela como cor de ação nos
  temas escuros o contorno dos campos ficava abaixo de 3:1 (`treinador/treino/blocoAberto.contraste.test.ts`). A dieta já
  seguia a regra nas opções e nos alimentos (conferido no código em 19/11: opção é o painel da aba, sem caixa, alimento é
  faixa `superficie2` sem cor de ação).
- **Publicar (11/11):** o botão diz o que publica ("Publicar treino", "Publicar dieta", "Publicar mobilidade",
  "Publicar alterações da pasta", "Publicar questionário", "Publicar anamnese", "Publicar perguntas") e só é o
  principal quando há o que publicar.
- **Exceção da P5 no Planejamento (11/11, segundo guia, pág. 8):** busca, "Organizar coleções" e "Nova …" (primário)
  ficam numa fileira só, acima das coleções, e não na faixa do cartão.
- **Lista compacta de coleções e categorias (24/11):** "Organizar coleções" (`treinador/planejamento/FolhaColecoes`) e "Organizar categorias" da Vitrine (`treinador/vitrine/FolhaCategorias`) usam a mesma forma: folha em `LARGURA_FOLHA`, texto explicativo e o bloco "Nova …" fixos na `faixa` (só a lista rola); campo + "Criar …" (`acao`) na mesma linha, botão sempre habilitado (vazio = erro no campo, Enter cria); `ListaDeLinhas divisorias` com nome + contagem (plural real: "12 modelos", "1 modelo", "Nenhum modelo"; a das coleções soma todos os tipos, porque a exclusão solta todos) e "Renomear" (`secundario`) + "Excluir" (`perigoTexto`); renomear é inline (campo preenchido e focado, Salvar/Cancelar, Enter salva, Esc cancela sem fechar a folha); excluir abre painel de confirmação que diz para onde vão os itens ("Os 12 modelos continuam no Planejamento, em Sem coleção."; "Nenhum modelo será afetado."); estado vazio "Nenhuma coleção ainda.". **O botão "Renomear" usa `secundario` normal: o `Botao` não tem variante de tamanho e o alvo mínimo é 44 px.** Nome repetido (sem acento, caixa nem espaços sobrando) é regra só do app (`erroDoNomeDaColecao`); a API de coleções não tem UNIQUE em `pasta_modelo.nome`.
- **Aviso de rodapé (`useAviso`):** o tom de atenção é para o aviso que não é erro, como "o navegador bloqueou a nova
  aba" ou "a mensagem foi preparada, mas não foi registrada". O vermelho fica para o que falhou.
- **Marca parecida com um status:** a marca padrão `#C62828` é o mesmo vermelho do `perigoFundo` do escuro e, com o
  `perigo` de 17/11, também a Magenta `#BE185D` avisa na Marca (`avisoDeMarcaPertoDeStatus`). Por isso o erro e o botão
  destrutivo se distinguem pela forma, com ícone, texto, contorno e fundo `tingido` do `Alerta`, e nunca só pelo tom.

---

**Cor do perfil da Comunidade (10/11/2026, escolha do Gustavo):** o aluno escolhe uma entre AZUL, ROXO (VIOLETA), ROSA (MAGENTA), LARANJA, TERRA e OLIVA (`dominio/perfilDaComunidade.ts`, `CORES_DO_PERFIL`). O laranja é o único token novo e mora numa paleta irmã, `PALETA_SO_DO_PERFIL` em `tema/tokens.ts` (claro `#D15700`, escuro `#FF7A1A`; `corDoTomDoPerfil`, tipo `TomDoPerfil`), e **não** na `PALETA_DA_AGENDA`, porque o tipo da agenda espelha o enum da API e a V043. No tema claro o laranja tem 3,23:1 como pior caso (4,14:1 sobre o branco): só serve de anel, amostra, ícone e borda, **nunca de texto**; no escuro passa de 5,3:1. A cor do colega pinta só marcador, nunca o texto, e a moldura tem forma própria (fina, dupla, tracejada, grossa), então nada depende só da cor. VERDE usa OLIVA (`shortcut:` no mapeamento), porque o único verde dos tokens é o `sucesso`, de status.

### 4.6 Padrões de composição (proposta de 10/11/2026)

Plano e passos: `docs/planos/composicao-visual.md`. A regra: **a mesma função tem o mesmo alinhamento, espaçamento,
hierarquia e comportamento em qualquer tela.** O que muda de uma tela para outra é uma **variante nomeada** aqui
(por tarefa ou por dispositivo), nunca uma margem solta. Problema comum se corrige na peça de `ui/`, não em cada tela.

**Como ler o status de cada padrão**

| Marca | Significa |
| --- | --- |
| **Peça existe** | A peça compartilhada existe e foi **lida no código** em 10/11/2026 (não foi conferida na tela). |
| **Proposto** | A regra ainda não existe em código: é decisão a aprovar e implementar. |
| **Verificado** | Conferido na tela renderizada em 390 e 1280 px, nos 4 temas, com o e2e ou a conferência citada em `docs/planos/composicao-visual.md` (sem capturas salvas: decisão do Gustavo, 10/11). Na peça compartilhada só o intervalo de datas do P2 está verificado (23/11, com o escopo citado nele); P2 e P3 têm outras partes "Verificado só em" uma tela, com a tela, as larguras e os temas citados. |

Cada padrão só sobe de "Proposto" para "Verificado" depois da captura; quem implementar atualiza esta tabela e o plano.
A seção "Observado no código" de cada padrão são **hipóteses de causa** achadas na leitura, a confirmar na tela.

#### P1. Modal: cabeçalho, corpo rolável e rodapé de ações

- **Quando usar:** formulário, escolha ou detalhe por cima da tela (`Folha`); pergunta curta de sim ou não
  (`PainelConfirmacao`).
- **Estrutura:** cabeçalho fixo (faixa `superficie3`, título, X) · corpo que rola sozinho · rodapé fixo com as ações,
  sempre visível. O rodapé tem uma ação principal à direita (a última na ordem de leitura) e as secundárias à esquerda
  dela; "Cancelar" nunca é o principal. O motivo de uma ação indisponível aparece **uma vez**, no padrão P5.
- **Peça:** `Folha` (`topo`, `faixa`, `area`, `conteudo`, `rodape`), `PainelConfirmacao`, `LinhaDeAcoes`.
- **Larguras (variantes):** confirmação 480 · editor ou prévia com mídia `LARGURA_EDITOR`. A largura vem da tarefa, não do
  conteúdo que sobrou. **Duas larguras de família (24/11, decisão do Gustavo):** **pequena** (`LARGURA_FOLHA`, 600) para
  formulário simples (convite, confirmação) e **média** (`LARGURA_FOLHA_LARGA`, 800; é a mesma peça, o nome é de 23/11) para
  escolha entre opções, resultado e editores com lista (Nova importação, resultado da planilha completa, Editar alimento,
  janela "Criar" da Agenda). Na mesma família, as telas usam a mesma constante, nunca o número fixo em cada tela. A
  `Folha`, no PC, tem sempre a altura do conteúdo até 90% da janela (25/11), com ou sem `largura`, inclusive a de detalhe "No centro"; só o corpo rola, com cabeçalho e rodapé fixos; o painel lateral e a `telaCheiaNoCelular` mantêm a altura da janela. A prop `alturaDoConteudo` ficou sem efeito (a Nova importação e o resultado da planilha completa ainda a passam; sai numa próxima limpeza). Na folha centralizada no PC, quando o status ou o erro do rodapé aparece, some ou cresce, a folha cresce ou encolhe só para cima (`ui/ancoraDoRodape.ts`, medido antes da pintura): a ação do rodapé não sai do lugar (P4); o que o corpo muda continua centralizado e, no teto de 90%, quem cede é o corpo. O formulário da Vitrine (Novo/Editar item) usa cartões de seção com título (Item, Preço, Onde comprar, Visibilidade), como Editar alimento e Editar exercício. Campos de formulário na
  folha ocupam a largura toda dela, alinhados com os demais (nada de `maxWidth` que deixe uma área vazia reservada à
  direita: foi o "bloco vazio" do Editar perfil). Mais 900 px para a matriz de
  permissões (`EditorDePerfil`, constante da tela). `Folha telaCheiaNoCelular` (opcional, só o editor de perfil usa) ocupa
  a tela inteira no celular; as outras folhas continuam na largura com o rodapé embaixo.
- **Variante "painel fixo ao lado"** (23/11, `treinador/financeiro/PainelDaCobranca`): o mesmo conteúdo da folha, sem
  modal, numa coluna fixa de 480 px à direita da tabela, só na faixa `ultralarga` (`useFaixaDaTela`, 4.10). É uma
  `role="region"` com o título, grudada na rolagem; o corpo rola e o rodapé de ações é fixo, **em duas linhas**: a ação
  principal em cima, cheia, e as secundárias embaixo, duas por linha. X e Esc fecham e devolvem o foco à linha de origem;
  abrir outra troca o conteúdo; o passo a passo que abre por cima (Renegociar) fica sobre o painel. A folha (600 px, ou 800 px com "Detalhes abrem: No centro", e
  celular) segue a preferência; o painel não muda.
- **Responsivo:** no PC a folha é uma caixa centrada com a largura da variante; no celular ocupa a largura e o rodapé
  fica colado embaixo, com os botões em coluna, o principal em cima, `cheio`.
- **Conferência visual:** o rodapé está sempre visível sem rolar a página; as ações ficam na mesma borda em todas as
  folhas equivalentes; nenhum espaço vazio entre o último campo e o rodapé que não seja do corpo rolável; o X, o Esc e
  o voltar fecham.
- **Status:** `Folha` e `PainelConfirmacao` = **Peça existe**. Regra de ordem das ações, rodapé com `LinhaDeAcoes` e
  largura por variante = **Proposto**.
- **Observado no código:** o rodapé da `Folha` usa `flex-end` com quebra própria (`flexWrap`), enquanto o do
  `PainelConfirmacao` usa a sua e põe o motivo à direita; as duas não passam pela `LinhaDeAcoes`. Hipótese: as ações
  mudam de lugar conforme a peça.

#### P2. Formulário e barra de filtros, incluindo intervalo de datas

- **Quando usar:** formulário de cadastro ou edição (`Campo`, `CamposEmLinha`); filtro de lista (`BarraDeFiltros`).
- **Estrutura do formulário:** rótulo em cima, campo, ajuda ou erro embaixo (`Campo`); campos relacionados na mesma
  linha por `CamposEmLinha` e **sempre com o mesmo número de colunas** num mesmo formulário. O erro fica junto do campo.
- **Estrutura do intervalo de datas (`ui/CamposEmLinha.ParDeDatas`, 23/11):** dois `CampoData` (início e fim) no
  `ParDeDatas`, que é uma `CamposEmLinha` com a largura mínima da variante: mesma largura e mesmo topo, o erro de um
  fica embaixo dele sem desalinhar o outro, e a faixa vem de `dominio/datasValidas`. Duas variantes nomeadas:
  **`formulario`** (padrão; 190 px por data): lado a lado na folha do PC, empilhados no celular (rótulos à vista
  "Início"/"Fim", com "(opcional)" quando é); **`filtro`** (150 px por data, `treinador/SeletoresDeFiltro.CamposDePeriodo`):
  lado a lado também no celular, um rótulo de grupo à vista ("Entrada") e os rótulos "De" e "Até" também à vista em
  cada data (24/11, decisão do Gustavo; WCAG 3.3.2). **Regra nas duas variantes: todo campo de data tem rótulo visível (no `filtro`, "De"/"Até" em peso normal e `textoSuave`, para o rótulo do grupo mandar),
  nunca só o nome para o leitor de tela.** Quando há vários períodos no mesmo painel (`nomeUnico`: Cobranças e
  Interessados), o nome para o leitor de tela é "De (Entrada)" e "Até (Entrada)", que começa pelo texto visível. Nos
  dois, empilham só quando a largura não dá duas datas (texto grande, cartão estreito).
- **Estrutura da barra de filtros:** busca · "Filtros" com contagem · etiquetas "Filtrando" (✕ por filtro) · "Limpar
  filtros". Os seletores só existem no painel lateral abaixo, no PC e no celular: não há cartão "Filtros avançados" na
  página nem folha "Filtros" com efeito na hora.
- **Painel lateral de filtros (12 e 13/11, `docs/planos/filtros-laterais.md`; é o único modo de filtrar):**
  `BarraDeFiltros` com o título "Filtros de <assunto>". O botão abre um diálogo
  (`role=dialog` com o título como nome, `aria-haspopup`) pela `Folha lateral`: no PC encosta à direita, 460 px
  (`LARGURA_PAINEL_LATERAL`), altura da janela, borda esquerda em `divisor`, sem sombra; entra deslizando da direita em
  180 ms (`withTiming`, saída suave) com o véu clareando junto, e nasce no lugar com movimento reduzido (do sistema ou do
  app); a saída é imediata e o foco volta ao botão "Filtros". No celular é a folha de baixo na largura toda, sem animação nova. Cabeçalho fixo com o X, corpo rolável em uma coluna com grupos
  `GrupoDoPainel` (título de seção e divisor de 1 px, sem cartão), rodapé fixo `Limpar filtros` (fantasma) · `Cancelar`
  · `Aplicar filtros` (o único primário). Rascunho copiado do aplicado ao abrir; X, Esc, fundo, Cancelar e o voltar
  descartam; Aplicar confere os campos (`useProblemaNoPainel` + `dominio/painelDeFiltros`): com erro, o painel fica, a
  frase vai ao rodapé, cada erro fica no campo e o foco vai ao primeiro marcado. Lista suspensa e calendário abrem
  acima do painel e o Esc fecha primeiro a camada de cima. A página atrás fica inerte e a tabela não muda de largura.
  As escolhas só valem em "Aplicar filtros"; a etiqueta ✕ da página tira o filtro na hora.
  - **Variantes nomeadas:** (1) com grupos `GrupoDoPainel` (Identificação, Situação, Datas, Outros, nesta ordem; grupo
    sem seletor não aparece); (2) sem grupo: as abas
    da Biblioteca (`BarraDaBiblioteca`: busca mais os seletores da aba, direto no corpo; sem nada a filtrar fica só a
    busca); a categoria dos vídeos e o tipo do mural usam um grupo Identificação com um seletor só (fica como está).
  - **Dois "Limpar filtros", escopos diferentes:** o do rodapé do painel limpa só o rascunho (a busca fica) e ainda
    pede o Aplicar; o da página (`Botao` depois das etiquetas, o "link das etiquetas") e a ação do estado vazio limpam os
    filtros aplicados de uma vez e nunca a busca ("Limpar busca" é outra ação do vazio). Nomes acessíveis conferidos no
    código em 13/11: o da página chama-se "Limpar filtros aplicados" (o nome acessível precisa conter o texto
    visível, WCAG 2.5.3, mas o texto visível continua "Limpar filtros"); o do rodapé do painel e o do estado vazio
    seguem "Limpar filtros"; a etiqueta, "Tirar filtro: <texto>". Enquanto uma aplicação está a caminho, o toque em
    "Filtros" é ignorado (alguns milissegundos, o voltar do histórico).
  - **Ao cruzar a largura (PC ↔ celular, 768 px do menu lateral; 960 px de conteúdo da lateral da Agenda):** o painel
    aberto e o rascunho sobrevivem, porque a barra e a tela são montadas uma vez e só o layout muda (a `Navegacao` mantém a
    tela no mesmo lugar da árvore nas duas formas; a Agenda, a coluna principal). Quem cria uma casca ou tela com duas
    formas de layout não pode pôr a barra (nem o `Slot`) em dois ramos da árvore. A gravação atrasada do Aplicar é
    descartada se a tela já saiu (saída confirmada de um editor com a guarda do voltar ativa).
  - **Seleção em lote (Cobranças e Alunos, D9):** aplicar filtro diferente que limpa o lote avisa quantos saíram
    (`selecaoDepoisDosFiltros`, `dominio/painelDeFiltros.ts`); a busca que limpa o lote também avisa, em Cobranças com o
    número e em Alunos sem número ("A seleção de alunos foi limpa porque a lista mudou."); sem nada marcado não avisa;
    Aplicar sem mudar nada mantém.
  - **Faixa de contexto (Cobranças):** o aluno de "Ver no Financeiro" é contexto obrigatório, não filtro: aparece numa
    faixa neutra acima da barra ("Cobranças de" + o nome) e como leitura no grupo Identificação, não vira etiqueta nem
    entra no contador; os dois "Limpar filtros" o mantêm e só "Ver cobranças de todos os alunos", na faixa, o tira. O
    mesmo vale para o que chega pelo endereço e não é filtro do painel (`?retornos=` e etapas dos Interessados).
  - **Filtro de cartão (13/11, passo 7A):** quando o filtro mexe só num cartão de uma tela com vários (ficha do aluno:
    Pastas, Registros e cargas da pasta; Histórico do aluno: Registros), cada cartão tem a sua `BarraDeFiltros` com o
    título do cartão ("Filtros de pastas", "Filtros de registros"), as suas etiquetas e o seu contador. O aluno e a pasta
    são contexto: leitura (`CampoLeitura`) no grupo Identificação, sem etiqueta nem contador. Estado local da tela. Os
    Registros da pasta não abrem painel por cima (15/11): são etapa da própria folha da pasta (item seguinte); o corpo
    da pasta fica escondido sem desmontar e, ao voltar, a pasta reaparece na mesma rolagem com o foco em "Filtros".
  - **Etapa dentro da folha (13/11, passo 7A):** o filtro de uma folha de escolher (Escolher exercício no editor de
    treino; Escolher exercícios do Progresso) e o dos Registros e cargas da folha da pasta ("Filtros de registros")
    não empilham um painel: "Filtros" (`BarraDeFiltros naFolha`) troca o título,
    o corpo e o rodapé da mesma folha pelos da etapa (`ui/EtapaDeFiltros`; "Filtros de exercícios", "Filtros de
    progresso"). O rodapé é o mesmo do painel e o rascunho segue as mesmas regras. O X, o Esc, o fundo, o Cancelar e o
    voltar retornam à lista sem fechar a folha. A busca e as marcações ficam como estavam. O foco vai ao primeiro controle
    da etapa e, na volta, ao botão "Filtros". Seleção (D9): no editor, aplicar outro grupo tira o que não é dele e avisa
    quantos saíram no status do rodapé (`selecaoDepoisDoGrupo`). No Progresso o grupo só muda a lista e as marcações
    ficam; por isso o "Limpar" da `SelecaoMultipla` tira só as marcações das opções à vista (o que o grupo ou a busca
    esconde continua marcado, como diz a contagem "N de M marcados").
  - **Folha movida no PC:** a folha centralizada pode ser arrastada pela alça; ao ficar abaixo de 768 px (a tela segue
    montada) o deslocamento zera e ela volta à posição de folha de baixo, sem levar o arrasto para o celular.
  - **Divergência com o guia de 11/11 (pág. 7):** o guia pedia os atalhos com contagem Todos / Para revisar / Atrasados
    na lista de Alunos; eles viraram as opções "Para revisar" e "Atrasada" do filtro Atualização, no painel (um modo só
    de filtrar; a contagem por atalho saiu junto). Decisão do plano `filtros-laterais.md`, passo 4.
- **Peça:** `Campo`, `CamposEmLinha`, `ParDeDatas`, `CampoData`, `CampoSenha`, `BarraDeFiltros`, `SelecaoMultiplaSuspensa`, `EscolhaEmFolha`.
- **`BarraDeFiltros` `antes` e `depois`** (23/11, Agenda): `antes` é o que fica à esquerda na linha do botão "Filtros",
  ocupando o que sobra (Hoje, setas e período do calendário); `depois` vem logo depois do botão (o segmento da visão). Uma
  barra só acima da grade; as etiquetas "Filtrando" continuam embaixo da linha inteira.
- **Senha:** `CampoSenha` tem o olho como botão de alternar (WAI-ARIA APG): o nome fixo "Mostrar senha" e o estado em
  `aria-pressed` na web e em `checked` no celular, nunca o nome que troca junto com o estado (10/11, `e2e/entrada-por-publico.spec.ts`).
- **Responsivo:** a partir de `LARGURA_TABELA` os campos relacionados ficam em linha; abaixo disso, uma coluna.
- **Conferência visual:** os campos de uma linha têm a mesma altura e a base alinhada (com e sem mensagem de erro em
  um deles); intervalo de datas: os dois campos têm o mesmo tamanho; a linha de filtros não deixa buraco quando um
  seletor some por permissão.
- **Status:** `Campo`, `CamposEmLinha`, `CampoData` e `BarraDeFiltros` = **Peça existe**. Intervalo de datas como par
  padrão e o alinhamento com erro em só um campo = **Verificado na peça compartilhada** (`ParDeDatas` e
  `CamposDePeriodo`, passos 5 e 6, 23/11; Chromium, só web, API simulada, sem capturas), por posição e tamanho
  (as duas caixas com o mesmo tamanho e pelo menos 44 px; lado a lado com o mesmo topo ou empilhadas com a mesma borda
  conforme a variante; "31/12/2026" sem corte; erro num campo só sem desalinhar; ação do rodapé à vista e sem nada por
  cima; página sem rolagem lateral), em 390 e 1280 px nos temas Claro, Escuro, Areia e Claro com contraste alto:
  variante `filtro` na Auditoria (`app/e2e/composicao-visual-pares-de-data.spec.ts`) e nos Interessados, Kanban e Lista,
  também em 768 e 1920 px no claro e no escuro, com o calendário dentro da janela (`app/e2e/interessados-composicao.spec.ts`,
  agora sobre a peça compartilhada); variante `formulario` nas folhas Copiar pasta para outro aluno, Copiar para outro
  aluno (plano), Aplicar modelo ao aluno e Registrar outra data do ciclo (aluna) (`composicao-visual-pares-de-data.spec.ts`).
  **Só estrutura migrada, posição não conferida por e2e:** Atualizações e Importação (filtro) e Nova pasta e Lesão
  (formulário), com os e2e funcionais delas verdes (`filtros-laterais-fase-b`/`-c`, `filtros-nas-listas`,
  `pasta-periodo`, `datas-validas`); Replicar/Duplicar plano e as datas da Configuração do plano não têm e2e que as
  abra (só typecheck e jest). **Não
  conferido:** app nativo (Android e iOS), leitor de tela e texto grande. O par do financeiro passou ao
  `CamposDePeriodo` em 24/11 (o `FiltrosEmGrade` saiu).
  Painel lateral = **Verificado em** (Chromium, só web, API simulada; capturas fora do repositório):
  Financeiro › Cobranças e Biblioteca › Exercícios/Alimentos (12/11): 390, 1024, 1280, 1440 e 1920 px no escuro (topo,
  fim, calendário perto do rodapé), menu recolhido, e em 390 e 1280 px nos temas Claro, Areia, Lavanda, Céu, Rosa,
  alto contraste (escuro e claro), bordas reforçadas e texto grande, com a lista de Situação aberta
  (`app/e2e/filtros-laterais.spec.ts`); Cobranças com o aluno de contexto e com período incompleto em 390 e 1280 px,
  escuro e claro. Lançamentos, Alunos, Atualizações, Interessados, Auditoria e Equipe (13/11,
  `filtros-laterais-fase-b.spec.ts`): 390 e 1280 px no escuro e, em Alunos, Lançamentos, Auditoria e Interessados, também
  1280 e 1920 px no claro. Agenda, Comunidade (vídeos e mural), questionários, Importação e Biblioteca › Importar, Outros e
  Suplementos (13/11, `filtros-laterais-fase-c.spec.ts`): 390 e 1280 px no escuro e, em Agenda, Importação e vídeos, também
  1280 e 1920 px no claro. **Não conferido:** os temas Areia e alto contraste fora das telas da fase 1, o leitor de
  tela e o app nativo (Android e iOS).
- **Observado no código (antes do painel lateral; no painel os campos ficam numa coluna):** a `BarraDeFiltros`
  posicionava seletores em grade com `columnGap` e `rowGap`, mas não define nada para o par de datas. Em 10/11 o par
  `treinador/SeletoresDeFiltro.CamposDePeriodo` empilhava De e Até até em 1280 px (base de 280 px por célula) e tinha
  dois níveis de rótulo (grupo mais "De"/"Até"); em 23/11 a base já era 150 px e sobravam os dois níveis e uma linha
  própria fora da `CamposEmLinha`. Corrigido no passo 6: Atualizações, Auditoria, Importação e Interessados usam o
  `CamposDePeriodo` sobre o `ParDeDatas`; Cobranças e Lançamentos passaram ao mesmo `CamposDePeriodo` em 24/11 (o `financeiro/FiltrosEmGrade` saiu).
  A caixa do `SelecaoMultiplaSuspensa` (rótulo dentro, 52 px) e a do `Campo`/`CampoData` (rótulo em cima, 44 px) têm
  alturas e idiomas de rótulo diferentes: na mesma linha a base não fecha; por isso os Interessados usam duas linhas.
- **Variante do par de datas com atalho** (24/11, folha de lesão): "Hoje" é um `Botao secundario` entre as duas datas, na linha do campo (espaçador do tamanho do rótulo); lado a lado as duas datas têm o mesmo tamanho, empilhadas o Início fica mais estreito. O Fim condicional (aparece só com a situação que o pede) não é gravado quando escondido. Chips de atalho que preenchem um campo de texto livre ficam logo abaixo dele, em `Escolha` sem rótulo visível (nome acessível próprio, que não repete o do campo), e o campo continua editável.

#### P3. Seleção de opções e lista de ações

- **Quando usar:** até 8 opções: `Escolha` (botões lado a lado) ou `GradeDeOpcoes` com `OpcaoCartao` quando cada opção
  tem descrição ou amostra. Mais de 8: `EscolhaEmFolha`. Várias marcadas: `SelecaoMultiplaSuspensa`. Registros com
  ações: `LinhaDaLista` dentro de `ListaDeLinhas`; atalhos e itens de ação: `ItemDeLista`.
- **Estrutura:** a opção escolhida é neutra (`sobre` + `bordaCampo`, 11/11; `superficie3` até 17/11), com ✓; motivo de opção desabilitada fica sob o
  grupo (P5); as ações de uma linha ficam **à direita**, a principal da linha só uma.
- **Peça:** `Escolha` (`distribuida` para dividir a largura, `compacta` para caber em duas fileiras no celular),
  `GradeDeOpcoes` (1 coluna abaixo de 700 px, 2 acima), `OpcaoCartao`, `LinhaDaLista`.
- **Responsivo:** `Escolha` quebra linha; com `distribuida` nenhuma linha termina com sobra. `GradeDeOpcoes` troca de
  1 para 2 colunas em 700 px.
- **Conferência visual:** em 390 e 1280 px nenhuma linha de opções termina com um botão solto e esticado; os cartões de
  uma grade têm a mesma altura; a opção escolhida é reconhecível sem a cor.
- **Status:** todas as peças acima = **Peça existe** (`Escolha`, `GradeDeOpcoes`, `OpcaoCartao` lidas em 10/11).
  Regra de quando usar `distribuida` = **Proposto**. Lista de ações com `ItemDeLista` em grupos ("Mudar de etapa", que
  vale na hora, e "Aceitar ou encerrar", que abre a confirmação) = **Verificado só no ⋯ (antigo "Mover para") dos Interessados**
  (passo 4c, 10/11): 390 e 1280 px nos 4 temas, nome longo, linhas de mesma borda e largura com
  44 px ou mais, foco inicial (X na folha de baixo, primeira ação na centrada), Esc devolve o foco ao botão, Recusar
  abre a confirmação sem gravar, encerrada só com "Reabrir atendimento": `app/e2e/interessados-composicao.spec.ts`.
- **Observado no código:** `Escolha` sem `distribuida` deixa a sobra à direita; `GradeDeOpcoes` usa 700 e a
  `BarraDeFiltros`, outro ponto de quebra. Hipótese: telas vizinhas mudam de colunas em larguras diferentes.

#### P4. Prévia de mídia com configurações e exportação

- **Quando usar:** gerar uma imagem, um carrossel ou um PDF a partir do que a pessoa escolheu, com prévia (hoje: comparação
  de fotos).
- **Estrutura (Proposto):** prévia no topo, centralizada, com a proporção real da saída · configurações abaixo, na ordem
  em que mudam a prévia · aviso ou motivo (P5) · ação de exportar **no rodapé fixo da folha (P1)**, não no fim do
  corpo. Várias imagens: uma prévia por imagem, com o rótulo em cima de cada.
- **Peça:** `Folha` (`LARGURA_EDITOR`), `ImagemProtegida`, `Escolha`, `Interruptor`, `Botao`; hoje o corpo vive em
  `fotos/CartaoFotos.tsx` (`FolhaGerar`). Peça compartilhada nova só se uma segunda tela precisar.
- **Responsivo:** no PC, prévia e configurações podem ficar lado a lado quando a prévia é alta (Stories); no celular, em
  coluna, com a prévia limitada à altura da janela.
- **Conferência visual:** a prévia não corta nem estica; o botão de exportar está visível sem rolar; configurações e
  botão compartilham o mesmo alinhamento; a prévia do Feed e a do Stories mostram a proporção certa.
- **Status:** **Verificado** na comparação de fotos (`fotos/FolhaGerar` em `CartaoFotos.tsx` e `fotos/PreviaDaImagem.tsx`;
  10/11/2026, árvore local sem commit; `app/e2e/comparacao-de-fotos.spec.ts`, casos "composição…", em 390, 768, 1280 e
  1920 nos temas claro e escuro, e em 390 e 1280 nos temas areia e contraste alto; sem capturas): prévia com a proporção
  do arquivo (Stories e Feed, ±2%) e, no Stories, quadros e logo no lugar do `layoutDaImagem` (±2 px); lado a lado a partir de 768 e empilhada em 390;
  ação no rodapé, visível sem rolar; trocar Stories, Feed e "Os dois" não move a ação nem as configurações; explicação
  de "Os dois" logo abaixo do seletor; autorização uma vez (status com a data, ou o motivo do botão); erro ao gerar no
  rodapé, sem mover a ação; carrossel com duas prévias por linha. **Não verificado (P1, passo 4a):** em 768 e 1920 sobra
  uma faixa vazia abaixo do rodapé, porque a `Folha` com `largura` fixa a altura em 90% e o corpo não cresce.

#### P5. Legendas, resumos, avisos e motivos de ação indisponível

- **Quando usar cada um (Proposto):**

  | Situação | Peça | Onde |
  | --- | --- | --- |
  | Explicar um campo | `Campo` `ajuda` (`pequeno`, suave) | Embaixo do campo |
  | Erro de um campo | `Campo` `erro` | Embaixo do campo, mesma posição da ajuda |
  | Erro ou aviso da tela inteira | `Alerta` (`perigo`, `atencao`, `sucesso`) | No topo do corpo, antes dos campos |
  | Conteúdo que o papel não pode ver | `Bloqueado` / `SemPermissao` | No lugar do conteúdo |
  | Item sem valor informado | `Incompleto` | No item |
  | Por que o botão está apagado | `Botao` `motivo` | **Colado embaixo do botão**, no mesmo alinhamento dele |
  | Por que uma opção está apagada | `OpcaoEscolha.motivo` | Embaixo do grupo |
  | Resumo de uma lista ou seção | `Texto` `suave` na faixa do `Cartao` | Na faixa, nunca solto no corpo |

- **Estrutura:** uma mensagem por motivo, uma vez. O mesmo texto não aparece como aviso e como `motivo` ao mesmo
  tempo. Legenda nunca fica solta entre dois blocos: ela pertence ao campo, ao grupo ou à faixa que descreve.
- **Peça:** `Campo`, `Botao`, `Escolha`, `Alerta`, `Bloqueado`, `Incompleto`, `Cartao`, `Texto` (`pequeno`, `suave`).
- **Exceção registrada (23/11):** na folha da cobrança, o motivo do "Enviar pelo WhatsApp" desabilitado (sem telefone) fica
  **ao lado** do botão, na mesma linha, junto do link "Adicionar telefone" (só com `ALUNO_ALTERAR`), e não no `motivo` do
  botão: continua uma vez só, mas a frase precisa de um link dentro dela e cabe melhor ao lado em 480 px.
- **Responsivo:** o texto quebra linha; o motivo de um botão `cheio` fica centralizado, o de um botão com o tamanho do
  texto fica alinhado à esquerda dele. Num rodapé de modal (P1), o motivo fica sob a ação a que se refere.
- **Conferência visual:** nenhuma mensagem repetida na mesma tela; nenhuma legenda sem o elemento a que se refere
  ao lado; o motivo está dentro do rodapé visível; a mensagem de estado tem ícone ou texto, não só cor.
- **Status:** as peças = **Peça existe**. A tabela "quando usar cada um" e a regra "uma mensagem, uma vez" =
  **Proposto**.
- **Observado no código:** o motivo do `Botao` fica abaixo dele alinhado à esquerda (ou centralizado se `cheio`); o do
  `PainelConfirmacao` fica abaixo da linha de botões e à direita; os dois usam o mesmo texto pequeno.

**Sugestões para a peça compartilhada (Proposto; só com o escopo autorizado, ver 4.4 e a tabela do `executor-front`):**
(a) um rodapé único para `Folha` e `PainelConfirmacao` (ordem, alinhamento, motivo) sobre `LinhaDeAcoes`; (b)
`CamposEmLinha` aceitar o par de datas; (c) uma largura nomeada por variante de modal.

**Indicadores, tabela e abas de ajustes (19/11, Financeiro e Números; planos `docs/planos/financeiro-numeros-19-11.md`):**
- **Indicador com cor** = `ui/CartaoDeIndicador` numa `ui/GradeDeIndicadores` (pintado desde 23/11: tons `sucesso`, `atencao`, `perigo`, `informacao`, `conquista`, `neutro` ou `corDeCategoria`; a regra vem de `ui/aparenciaDoIndicador` e `ui/superficiePintada`; zero e indisponível ficam neutros). Quem mostra total ou contagem usa a peça; não cria cartão próprio. A grade (24/11, `dominio/gradeDeIndicadores`): cabendo todos, uma linha só. Total **com divisor** (2, 3, 4, 6, 8, 9, 10, 12) usa o maior divisor que caiba com a largura mínima da célula, senão 1 coluna (4, 2 + 2 ou 1; 6, 3 + 3, 2 + 2 + 2 ou 1). Total **sem divisor** (5, 7, 11, 13) usa o maior número de colunas entre 4, 3 e 2 que caiba e **distribui equilibrado** (`linhasDaGrade`): as linhas diferem em no máximo 1 cartão e as de cima ficam com os que sobram (7 em 3 colunas = 3 + 2 + 2, 7 em 4 = 4 + 3, 5 em 3 = 3 + 2); cada linha com menos cartões **estica até a largura toda**, e só quando ainda sobra um cartão (5 em 2 colunas = 2 + 2 + 1) ele fica esticado sozinho; só vira 1 coluna quando nem 2 cabem. O esticar é a prop `ultimaLinha?: 'igual' | 'esticar'` da `ui/Grade` (padrão `igual`; só a `GradeDeIndicadores` passa `esticar`; cada cartão de uma linha de k mede `(largura − 1 − vão·(k − 1)) / k`). Cartão de largura normal sozinho (3 + 1, 5 + 1) não existe; todos na mesma altura. Medido: 6 colunas a partir de ~1833 px de janela com o menu aberto. A `ui/Grade` desconta 1 px da largura medida antes de dividir: o `onLayout` da web arredonda a largura para cima e uma fração de 0,5 px ou mais jogava o último cartão para baixo (3440 com zoom de 67, 75, 80, 110 ou 125%). As listas do aluno (`colunasDaGradeDoAluno`) mantêm a regra própria. **Avisos não usam faixa lateral (24/11):** o aviso de situação ("Próximo passo" do Início, o aviso do Concluir treino) usa o padrão pintado de `ui/superficiePintada`: fundo em degradê da cor da situação (âmbar; vermelho só no atraso), borda inteira na cor a ~50%, bolinha antes do rótulo, mesmo raio e mesmo recuo horizontal dos blocos de baixo; a borda só num lado, com canto arredondado, forma uma curva fina e cola o texto. Contraste testado em `contrasteDasPecas.test.ts` ("avisos pintados"). O toast `ui/Aviso` e os itens de problema do plano e do questionário seguem o mesmo padrão (24/11): o toast tem degradê sobre `superficie2`, borda inteira a 50% da cor da situação, **sem faixa de 4 px**, ícone na cor (`CircleCheck` sucesso, `TriangleAlert` atenção, `CircleAlert` erro) e texto em `texto`; o neutro continua liso, com borda `borda`. Os itens de problema (`TopoPlano` `ItemProblema`, `EditorQuestionario`) são linhas simples com o selo "Erro"/"Aviso" + texto, sem caixa, faixa nem fio; o item do plano segue link, com fundo de pressionado e alvo de 44 px. Contraste dos três tipos em `ui/contrasteDasPecas.test.ts`; e2e `cores-por-situacao.spec.ts` espera a borda a 50%.
- **Exceção: séries do treino (Gustavo, 25/11).** As séries do treino (montar e executar) usam faixa lateral reta e cartão pintado na cor do tipo. Avisos e outros cartões continuam sem faixa. No executar (`aluno/CartaoDaSerie`, regra pura `pinturaDaSerie` em `aluno/coresDoMarcarSerie.ts`, série simples e série com etapas): fundo e borda do padrão pintado (`ui/superficiePintada`) na cor de identificação do tipo (`corDoTipoDeSerie`, a mesma do selo), faixa de 4 px à esquerda desenhada por dentro do cartão e recortada por ele (`overflow: hidden`; nunca `borderLeft` com canto arredondado), por cima da borda do lado esquerdo. Estados: **ativa** (a da vez) com a borda de ação de 1,5 px (2 com bordas reforçadas) por cima, inclusive da faixa; **feita** continua na cor do tipo (não fica verde: o feito é o ✓ verde cheio, o selo "Feita" e "kg × reps" com Editar); **pendente** com a cor do tipo diluída a 50% no fundo e na borda e a 75% na faixa, texto sem opacidade. Tipo sem cor ("Outro") e cardio ficam como antes (neutro; o cardio feito segue verde). Contraste nas 9 paletas × contraste alto × bordas reforçadas em `aluno/coresDoMarcarSerie.test.ts` (texto, `textoSuave` e `perigo` ≥ 4,5:1; contorno dos campos, ✓, faixa e borda de ação ≥ 3:1 sobre o ponto mais forte do degradê).
- **Tabela de colunas distribuídas:** `Tabela` aceita `flex` com `minimo` por coluna, `vao` (≥ 24 px entre colunas), `alinharLinhas` e `larguraMinima`; abaixo da largura mínima a lista vira cartões, como antes.
- **Mês de competência** aparece sempre como MM/AAAA (`rotuloDoMesNumerico`; `rotuloCurtoDoMes` "11/26" onde falta espaço). O "nov/2026" fica no Início e na Minha conta.
- **Filtro padrão que o usuário não pediu** (Cobranças abre em Ativas + "Mês de vencimento: MM/AAAA"): sempre visível como chips e em "Filtros, N ativos", gravado no endereço, com estado vazio que diz o filtro e leva a "Ver todas…"; tirar tudo grava `filtro=nenhum` e o padrão não volta sozinho.
- **Aba de ajustes** (Lembretes, Recebimento; `treinador/financeiro/AjustesDaAba`): duas colunas a partir de 960 px medidos (ajustes à esquerda, apoio e prévia à direita), uma coluna abaixo; linhas de opção com fio e controle em coluna fixa; **barra de salvar no rodapé do cartão** ("Tudo salvo" / "Alterações não salvas" + Descartar + Salvar), sem botão apagado, e guarda de saída também na troca de aba (`Abas ativacao="manual"`: seta só move o foco, Enter ou Espaço escolhem).
- **Números** (`treinador/numeros`): quatro indicadores no topo só com o que a tela já mostra, duas colunas medidas pela área e "Como contamos" recolhível, fechado.
- **Aviso (toast) por cima de tudo (24/11, lote 7):** o `ui/Aviso` nunca fica atrás de folha, véu, menu, seleção ou confirmação (na web: portal da folha do topo com folha aberta, nó próprio no fim do `body` nos outros casos) e, dentro de uma folha, fica logo acima do rodapé, sem cobrir "Salvar" nem "Excluir". Teste com `document.elementFromPoint`, não com `toBeVisible`. A CSP local libera `https://i.ytimg.com` em `img-src` só para a miniatura do YouTube do editor de exercício.
- **Editar exercício (24/11):** "Vídeo" (`VideoDoExercicioEditor`: prévia 16:9 da miniatura do YouTube com play; "Assistir aqui" monta o `PlayerDeVideo` sem cookie, o da Comunidade; "Abrir no YouTube"; "Remover vídeo" `perigoTexto`; link inválido = erro no campo "Use um link https do YouTube." sem prévia; miniatura bloqueada pela CSP = cartão neutro com play; link do YouTube sem id, como o de canal, = sem prévia e só "Abrir no YouTube") e "Imagem ou GIF" (`ImagemDoExercicioEditor`, três estados: vazio, área tracejada clicável e soltável com "Escolher imagem ou GIF" e a dica "JPEG, PNG ou GIF animado, até 1 MB e 800 px."; fotos do catálogo, prévia + "Fotos do catálogo: o aluno vê estas enquanto não houver imagem própria.", sem Remover; própria, prévia `contain` em `superficie2` até 360 px, "Imagem própria, enviada em dd/mm/aaaa hh:mm", "Trocar" `secundario` + "Remover imagem" `perigoTexto` com confirmação, na mesma linha). Não mostra nome nem tamanho do arquivo: o app não os guarda (a API só tem `imagemPropriaEm`).
- **Fibra:** única exceção ao "só ≥ 4,5:1" dos tokens de categoria, porque nunca é texto (ver "Categoria e macros"). Folha larga do alimento: 800 px (`LARGURA_FOLHA_LARGA`), macros em colunas iguais (`treinador/biblioteca/gradeDoAlimento.ts`).

**Cobrança, planos e permissões em tela larga (23/11; planos `docs/planos/folha-da-cobranca.md`, `financeiro-em-tela-larga.md` e `permissoes-em-matriz.md`):**
- **Item arquivado sem opacidade:** o plano arquivado leva o selo neutro "Arquivado" e o valor em `textoSuave`; texto
  esmaecido por opacidade cai abaixo de 4,5:1 (WCAG 1.4.3), por isso nunca (4.3).
- **Planos em grade** (`dominio/gradeDosPlanos.colunasDosPlanos`: 4 colunas a partir de 1600, 3 a partir de 1024, 2 a partir de
  600, 1 abaixo; sem cartão sozinho na última linha). Cobranças, Planos e Lançamentos não têm teto de largura: o espaço
  extra vira coluna ou painel (4.10).
- **Matriz de permissões** (`treinador/equipe/EditorDePerfil`, folha de 900 px): uma linha por recurso e colunas Ver | Criar
  e editar | Publicar | Outras; resumo vivo, seções "N de M" e dependência travada com o motivo. O selo "Dado sensível" tem
  **uma posição só por arranjo** (`dominio/matrizDePermissoes.arranjoDaMatriz`): ao lado do nome do recurso no PC, abaixo do
  nome em todos os recursos no celular, nunca um de cada jeito na mesma tela; o recurso "Dados sensíveis" não leva o selo.

---

### 4.7 Editor de treino e de plano (reorganizado, 10/11 a 16/11)

Vale para o treino do aluno e para o modelo de treino (`treinador/treino/EditorDeTreino`, com os filhos da pasta).
O cabeçalho é da tela do modelo (`treinador/plano/TopoModelo`) ou da barra do plano do aluno (`treinador/plano/TopoPlano`).
Decisões e passos em `docs/planos/editor-de-treino-reorganizado.md`.

**Estrutura**
- PC, a partir de 960 px de conteúdo: lista de exercícios à esquerda (`ListaDeExercicios`, coluna de no máximo 360 px)
  e inspetor do exercício à direita, até 1800 px (4.3). Abaixo disso, coluna única de 1040 px.
- Item da lista: posição, nome, resumo curto e pendência (`linhaDoExercicio`, selo de `estadoDoExercicio`). "Adicionar
  próximo exercício" fica embaixo da lista, com "Criar grupo" (`AdicionarProximoExercicio emColuna`).
- Cabeçalho da sessão (`CartaoSessao`): faixa com o nome, totais em linha compacta (`ResumoDaSessao`), "Adicionar
  exercício", "Adicionar cardio" e "Criar grupo" (com o motivo quando travado). O ⋯ tem "Salvar como …" (`rotuloSalvarComo`)
  e "Remover sessão" (perigo). "Ver distribuição da sessão" começa recolhida (por tipo e por grupo muscular). "Editar
  sessão" recolhido diz o que já tem dentro, entre parênteses.
- Sessão de treino sem exercício (`SessaoVazia`, `estadoDaSessao`): "Monte esta sessão" com "Adicionar exercício",
  "Usar modelo" (não aparece no dia de treino solto) e "Adicionar cardio". Dia de descanso não ganha convite nem erro: recebe o texto
  de que a sessão não leva exercícios.
- Configuração recolhida (`ConfiguracaoDoPlano`, prop `resumo`): o resumo fica no lugar das ações. Dieta e mobilidade
  não passam a prop e seguem como antes.
- Celular com 3 ou mais exercícios: "Exercício aberto" (`EscolhaDoExercicio`) abre a folha com todos.

**Blocos de séries (`TabelaDeBlocos`; séries no padrão da dieta, 19/11)**
- O painel do exercício aberto tem a faixa de ação à esquerda (`CartaoExercicio`) e, no cabeçalho, "Exercício N de M ·
  grupo", o nome e, à direita, "Trocar exercício" (nome acessível "Trocar exercício: <nome>"; abaixo de 768 px só o ícone, com o mesmo nome), ⋯ (mover) e "Excluir".
- Linha fechada sem borda (hover `superficie2`, chevron →), linhas separadas pelo fio `divisor`. A aberta é um bloco só
  com o editor embaixo (fundo `coresDaEdicao().fundoDoBloco`, cantos 14, chevron ↓ na cor de ação), sem contorno, halo,
  selo "Editando" nem o título repetido; só uma aberta por vez e tocar na aberta (ou "Fechar edição") fecha. Alça de
  arrastar à esquerda e ⋯ (mover) à direita de cada linha, fora do botão dela.
- Quatro sinais que não se confundem: foco é o anel do `:focus-visible`; aberta é o fundo tingido; categoria é só o selo
  na cor do tipo (a faixa lateral da linha saiu); problema é o ícone na cor da gravidade (carga vazia é âmbar, "Falta a
  carga").
- Nome acessível de cada linha começa por "Série N · tipo" e traz quantidade, repetições, descanso e o que varia entre as
  séries do bloco (`textoAcessivelDoBloco`, `textoDaVariacao`). Resumo do exercício: "Este exercício: N blocos · M séries"
  (`textoDeBlocosESeries`).
- A edição completa do bloco aberto fica logo abaixo da linha dele (`EditorSeries`, `EditorDoGrupoDeSeries`), em seções
  separadas por fios: Tipo e técnica, Estrutura, Carga e RIR, Observação. Rodapé: "Para o aluno" à esquerda e "Excluir
  série" e "Fechar edição" à direita. Subir e descer saíram do bloco: ficam no ⋯ de cada linha, fora do botão dela
  (Mover para cima/baixo, a alternativa ao arrastar pela alça, WCAG 2.5.7), como nos alimentos da dieta. O bloco é a
  região "Editando série N, tipo"; "Fechar edição" devolve o foco à linha.

**Opções da refeição (`CartaoRefeicao`; opções em abas, 19/11)**
- Com duas opções ou mais: a comparação dos totais (`ComparacaoDasOpcoes`: Opção | Kcal | P | C | G | Fibras, marcas de
  macro no cabeçalho, números à direita, a linha abre a aba, a aberta em `superficie2` sem cor de ação; na opção em
  tabela os números caem embaixo das colunas dos alimentos), as abas (`AbasDeOpcao`, Tabs da APG, desenho do `Abas`:
  "Opção A · 98 kcal" com a kcal em fonte numérica, "vazia" sem item, selo neutro "Conta no total do dia" na primeira,
  "+ Opção" no fim, fora da rolagem) e a frase de apoio; depois a opção aberta na largura toda. Com uma opção só, sem abas
  nem comparação: o "+ Opção" no lugar do "Excluir opção". O "+ Opção" era `Botao tipo="acao"` (Gustavo, 20/11) e passou a `secundario` em 24/11 pela regra complementar (um por cartão de refeição, várias abertas ao mesmo tempo).
- Opção aberta: "Alimentos (N)" com "Excluir opção" (`perigoTexto`, confirma só com itens), a tabela (abaixo de 656 px de
  opção, o item empilhado; em 1280 com o menu aberto a opção tem 668, 20/11), o total com cada número embaixo da coluna
  dele e "Adicionar alimento" e "Item manual". A alça de arrastar aparece sempre (com um item, apagada e sem gesto) para o
  nome começar no mesmo lugar. Na tabela (20/11): quantidade e unidade num campo só ("50 g ▾", a sigla abre o menu das
  unidades; nomes acessíveis "Quantidade" e "Unidade: g. Escolher."), Kcal, P, C e G em 48 px e Fibras em 56, números à
  direita na fonte numérica e sem o "g" (está no título da coluna, como na comparação), nome do alimento numa linha com
  reticências e o nome inteiro na dica, só a alça e o ⋯ na linha (a lixeira virou "Excluir alimento" no ⋯, com o mesmo
  Desfazer) e os campos do item manual na linha de baixo, com o rótulo à vista. Empilhado, o de antes, com a lixeira.
- "Trocar alimento" (item da biblioteca): compacto (desenho de 32 px, alvo de 44) e secundário neutro (`superficie2`, contorno `borda` / `bordaCampo` ao passar o mouse, rótulo e ícone `texto`), para não multiplicar a cor de ação com "+ Opção"; na tabela, na linha de baixo do nome, antes dos selos; empilhado, junto do ⋯ e da lixeira.

**Salvamento, validação e aplicação (três estados separados)**
- Salvamento (`seloDoEditor`, `dominio/barraDoEditor.ts`): "Alterações não salvas" em neutro com lápis (D12, não é erro),
  "Salvando…", "Falha ao salvar" e "Data inválida: não salvo" em `perigo`.
- Validação (`ContadoresDoTreino`): "Sem pendências" ou "N pendências · Ir à primeira pendência" no modelo; no plano do
  aluno, "Pronto para publicar" ou o mesmo texto de pendências. Só informa: nada trava salvar.
- "Ir à primeira pendência" seleciona sessão, exercício e bloco, abre o recolhido e foca o campo com `aria-invalid="true"`.
  A `TelaDoEditor` leva o campo focado para baixo da barra grudada (`focusin`).
- Aplicação (modelo): "Aplicar ao aluno" fica desabilitado até salvar, com o motivo "Salve o modelo antes.".
- Regras puras em `dominio/editorDeTreino.ts`: `resumoDoBloco`, `blocosESeries`, `textoDeBlocosESeries`,
  `primeiraPendencia`, `estadoDaSessao`, `textoAcessivelDoBloco`, `textoDaVariacao`.

**Cor (conferida no código)**
- Prévia "Para o aluno" (`EditorDoGrupoDeSeries`): ícone ✓ `sucesso` quando não há nada a corrigir; ⚠ âmbar ou ⊗ vermelho
  com aviso ou erro; sem caixa (19/11).
- "Alterações não salvas" é neutro no código. A linha dessa situação na tabela de 4.5 ainda diz `atencao`: a decisão
  está pendente (plano, decisão 4 e passo 4). Não conferido qual vale.

**Não conferido**
- Aparelho nativo (Android e iOS), leitor de tela real, web local em `:8088` com conta de demonstração,
  `prefers-reduced-motion` e mais de 7 exercícios além da fixture de teste.
- Largura da tabela de blocos: o plano diz 480 px; o código usa 390 px (`TabelaDeBlocos.tsx`, linha 34). Este texto segue o código.
- Os ajustes de 11/11 (campo de nome ocupando a largura, "Criar grupo" embaixo de "Modelos prontos", "Editar sessão" na
  largura da sessão) não foram vistos na tela; só o código.

**Editor de mobilidade (no padrão do treino e da dieta, 19/11; plano `docs/planos/editor-de-mobilidade-no-padrao-do-editor.md`)**
- Topo num cartão só: no modelo, "Sobre o modelo" (`treinador/mobilidade/SobreAMobilidade`) com Nome e Descrição lado a
  lado (a descrição maior) e as Orientações recolhidas embaixo (`BotaoDeAbrir` com `aria-expanded`; fechadas mostram
  "(vazio)" ou o começo do texto); no plano do aluno as Orientações ficam dentro da "Configuração do plano".
- Seções: `ItemDaListaDoEditor` com a alça (`ui/ArrasteDaLista`) na lista; empilhado, a alça vai ao cabeçalho do cartão.
  Mover é a alça ou o ⋯ ("Mover para cima/baixo"); o selo "Editando" fica só na lista.
- Painel da seção: faixa de 6 px na cor de ação só no inspetor; cabeçalho `superficie3` com "Seção N de M", o título
  editável ("Título da seção N"), ⋯ e "Excluir seção" (`perigoTexto`; `PainelConfirmacao` só com itens; Desfazer).
- Itens em tabela como os alimentos da dieta: cabeçalho "#", "Nome", "Prescrição", "Vídeo" uma vez (`aria-hidden`),
  faixas `superficie2` de cantos 12 a 6 px, alça e número no começo, ⋯ (mover e "Excluir item") no fim; Nome e
  Prescrição flex 1,2, Vídeo 1. Abaixo de 600 px da lista (painel de ~640), o item empilhado com os rótulos.
- Vídeo: vazio, o campo "Cole o link do YouTube"; válido e fora do foco, "Vídeo adicionado" com Abrir (nova aba) e
  Trocar; inválido, erro em vermelho pela 4.5 (Gustavo, 19/11: trava o salvar): contorno da faixa, borda do campo
  (`aria-invalid`) e o selo `perigo` "Link do YouTube inválido" ligado ao campo; a seção diz "Corrigir".
- Na tabela, a coluna Vídeo tem ~145 px em 1280 com o menu aberto: o placeholder é "Link do YouTube" e o selo
  "Link inválido" (o rótulo oculto do campo já diz YouTube), sem cortar nem quebrar; empilhado, os textos longos.

### 4.8 Seções que abrem e fecham (Gustavo, 18/11/2026; plano `docs/planos/secoes-nascem-fechadas.md`)

Padrão das telas novas e das reformadas. Vale para seção que abre e fecha: `CabecalhoDeGrupo` com `aoAlternar`, cartão
recolhível e "Mostrar mais".

- Nasce **fechada**. Se há uma seção só, nasce **aberta**.
- **Buscar** abre as seções com resultado; **limpar** a busca volta ao estado de antes da busca (não deixa tudo aberto).
- Abrem sozinhos: o item que a pessoa acabou de criar, o que tem erro apontado por "ir ao primeiro problema" e o destino
  de um link (`?secao=`, `?pastaId=`).
- **Não se guarda no aparelho**: cada vez que a tela abre, começa fechada.
- Exceção: telas de uso do aluno (treino do dia, dieta, lista de compras, histórico) ficam como estão.
- O menu lateral do treinador (grupos de navegação) é caso à parte: ver `docs/planos/menu-grupos-recolhiveis.md`.

### 4.9 Cabeçalho da ficha do aluno (Gustavo, 18/11/2026; plano `docs/planos/ficha-do-aluno-cabecalho.md`)

Peça própria da ficha (`treinador/CabecalhoDaFicha`); o `ui/Cabecalho` das outras telas não muda.

- **Linha 1:** seta de voltar sem moldura ("Voltar para Alunos", alvo de 44 px) e a trilha "Alunos › nome", a 8 px,
  centradas na vertical, também no celular. O desenho da seta fica na borda esquerda de tudo.
- **Linha 2, 16 px abaixo:** foto ou iniciais de **56 px em qualquer largura**, 16 px, o nome (`titulo`, o único h1) e, em
  texto suave, só as datas que existem (`dominio/cabecalhoDaFicha.linhaDeDatas`, fuso de Brasília): "Cadastro alterado
  em", "Último acesso ao app em" ou "Último login em" (login nunca é chamado de acesso) e "Último plano publicado em … por
  …". Dado ausente tira a parte; nunca "—" nem data inventada. Cada parte quebra inteira, com o "·" no fim dela.
- **À direita:** o selo da situação (`seloDaSituacao`: Ativo `sucesso`, Inativo e Anonimizado `neutro`, tabela 4.5) e o ⋯.
  Com o cabeçalho abaixo de 600 px (medido nele, não na janela), os dois descem para baixo do nome. O Resumo não repete a
  situação.
- **Linha 3, 20 px abaixo:** as abas. **Uma borda esquerda só** para seta, foto, abas e cartões.
- **Foto (muda a regra de 11/11):** o círculo continua sendo o botão "Trocar foto" (abre a Folha "Foto de perfil"), mas o
  selo da câmera **some no estado normal** e só aparece com o mouse em cima ou com o foco do teclado (anel de foco visível
  no círculo; Enter e Espaço abrem a Folha). No toque não há hover: o selo não aparece, o nome acessível e a ação ficam.
  "Trocar foto" também está no ⋯, para quem não descobre o círculo.
- **Contato nos Dados do aluno:** "Copiar telefone", "Abrir WhatsApp" (`wa.me/55…` fora do app, sem token e sem texto) e
  "Copiar e-mail" como botões de ícone com moldura ao lado do valor, com o nome do aluno no nome acessível; sem valor, não
  aparecem.
- **Editar dados é um passo do histórico** (`ui/historicoDasFolhas.usePassoNoHistorico`, como uma Folha): o voltar do
  navegador, a seta e o voltar do Android saem da edição para a leitura, na mesma aba; com alteração pendente vale o "Sair
  sem salvar?".
- E2e: `app/e2e/ficha-cabecalho.spec.ts` (390 e 1280 px; claro, escuro e Areia nas capturas).

### 4.10 Tela larga (Gustavo, 19/11/2026)

Regras para o treinador no monitor grande. Valores em `tema/tokens.ts`, `ui/useFaixaDeLargura.ts` e
`dominio/larguraDoConteudo.ts`.

- **As 4 faixas** (`faixaDeLargura`), medidas pela largura da **área de conteúdo** (o que sobra ao lado do menu), nunca
  pela da janela: `compacta` (< 1024 px, também antes da primeira medida), `normal` (1024 a < 1600), `larga` (1600 a
  < 2400) e `ultralarga` (≥ 2400; `LARGURA_FAIXA_NORMAL`, `_LARGA` e `_ULTRALARGA`). A mesma tela cai em faixas
  diferentes com o menu aberto, recolhido (trilho) ou minimizado, e isso é o esperado. Na `ultralarga` a `Tela` sobe o
  recuo lateral para 48 px (`respiroLateralDaTela`), sem baixar um `folga` maior que a tela já peça.
- **Código novo mede pela área de conteúdo com `useFaixaDeLargura`.** Devolve `{ largura, faixa, aoMedir }`: o
  `aoMedir` vai no `onLayout` da raiz da tela ou da grade. A janela não sabe quanto o menu ocupa, então
  `useWindowDimensions` não serve para decidir o layout do conteúdo. Os usos antigos dele (cerca de 63 arquivos hoje)
  migram aos poucos, quando a tela for mexida: migra quem decide layout de conteúdo pela largura; modais, teclado e
  detecção de celular podem continuar na janela. A `TelaDoEditor` só usa a janela menos o menu para
  estimar o primeiro quadro, até a medida chegar, e passa a valer a medida.
- **Layout dentro de uma tela: `useFaixaDaTela()`** (`ui/Tela`, 23/11). A `Tela` já mede a faixa da área (antes do recuo
  lateral) e a expõe por contexto; quem decide o layout por dentro dela lê a faixa dali (fora de uma `Tela`, `compacta`).
  O `useFaixaDeLargura` medido por dentro do recuo não chega à `ultralarga` em 2560 px (o recuo de 48 px tira 96). Exemplo:
  o painel fixo das Cobranças (`PainelDaCobranca`, 480 px) é a 3ª coluna da `ultralarga`; com a preferência "Limitada" ele
  abre dentro de 1800 px (a faixa vem da área, o teto só segura o conteúdo). Abaixo da `ultralarga` a cobrança abre na folha.
- **Espaço extra vira colunas, nunca elementos esticados.** Campo, botão, linha de lista e cartão de texto não ganham
  largura só porque ela existe: sobrou espaço, entra outra coluna (o `Grade` mede a si mesmo e escolhe 1, 2 ou 3 colunas;
  o Início escolhe de 1 a 6 por `colunasDaGrade`, com teto por faixa de 3, 4, 5 e 6).
- **Texto corrido em ~72 caracteres por linha** (parágrafo, descrição, resposta): `LARGURA_TEXTO_CORRIDO` em
  `tema/tokens.ts`, `72ch` na web e 660 px no nativo, usada hoje na Ajuda. Quem escrever texto corrido novo numa tela
  larga usa a mesma constante.
- **Formulários curtos em `LARGURA_FORMULARIO`** (640 px, `tema/tokens.ts`): a tela declarada até esse valor não estica,
  em qualquer preferência (telas declaradas abaixo de `LARGURA_MAXIMA` mantêm o teto próprio: formulário curto 640, telas
  do aluno 1120 ou 1688 por faixa (`TelaDoAluno`), editor de uma coluna `LARGURA_EDITOR` 1040).
- **Modais e folhas: sem mudança.** Seguem as larguras da variante (4.6, P1: 480, 600 e `LARGURA_EDITOR`) e não usam a régua.
- **Preferência "Largura do conteúdo"** (Ajustes › Aparência e preferências, `ui/PreferenciasDoApp`): **Automática**
  (padrão) deixa listas, painéis e editores em duas colunas sem teto; **Limitada** os segura em `LARGURA_MAXIMA` (1800 px).
  Fica no aparelho, em `treinos:<usuarioId>:preferencias`, campo `larguraConteudo` (`AUTOMATICA` | `LIMITADA`,
  `dominio/preferencias.ts`). Só decide o teto (`larguraMaximaDoConteudo`); não muda as faixas. As três colunas dos
  editores de treino e de dieta só existem em Automática; as do editor de questionário são medidas no próprio editor e abrem
  também em Limitada (1800 px comportam as três).
- **Preferência "Detalhes abrem"** (24/11, ao lado da "Largura do conteúdo"): **Na lateral** (padrão, como era) ou **No
  centro**; campo `detalhesAbrem` (`LATERAL` | `CENTRO`, `dominio/preferencias.ts`, mesma chave por usuário). Vale na
  `Folha` pela variante `detalhe` (uma prop nas folhas de detalhe, não tela por tela): no PC, "No centro" abre a janela
  centralizada com `LARGURA_FOLHA_LARGA` (800), véu escurecido, o mesmo cabeçalho, rodapé e botões, altura do conteúdo com
  rolagem interna; no celular nada muda. Folhas de detalhe: detalhe da cobrança (`FolhaDaCobranca`; no padrão ela já abria
  centrada em 600, e na faixa ultralarga das Cobranças "No centro" desliga o painel fixo de 480 px e usa a folha), Meu
  perfil, Meus dados, Trocar senha e Aparência da Conta do aluno e "Mostrar votos" da Comunidade. Não mudam: o painel de
  filtros (`LARGURA_PAINEL_LATERAL`, 460), o `PainelDaCobranca` da ultralarga no padrão e os formulários e escolhas que já
  abrem no centro. A preferência é lida na abertura da folha (a de Aparência não pula de lugar ao trocar a opção).
- **Regra: editor de uma coluna de campos não passa de ~1400 px.** Quando o editor tem uma coluna de campos (lista à
  esquerda, painel do item ao lado), limita-se a **largura do painel** a `LARGURA_EDITOR_DE_CAMPOS` (1400 px,
  `tema/tokens.ts`), alinhado à esquerda, junto da lista; nunca se alargam as colunas nem se esticam os campos para
  ocupar a sobra. O que sobra à direita fica vazio. Aplicada no inspetor do treino (`InspetorDoExercicio`), da dieta
  (`EditorDeDieta`, o cartão da refeição com abas, comparação e tabela) e da mobilidade (`SecoesDeMobilidade`, plano e
  modelo). Abaixo de 1400 px de painel nada muda (1280 e 1920 com o menu aberto); o teto só vale com ~1730 px ou mais
  de área de conteúdo (1920 com o menu recolhido, 2400 em diante com o menu aberto, e também em Limitada nessas larguras,
  onde o painel tinha ~1504 px). Na `ultralarga` a 3ª coluna (Total do dia, Resumo da sessão) vem logo depois
  do painel, no mesmo grupo à esquerda; em 2400 (faixa `larga`, duas colunas) o Total do dia fica em faixa cheia acima
  e sobram ~400 px vazios à direita do painel, o que é esperado.
- **Três colunas na `ultralarga`** (exemplos que já existem): editor de treino (lista, inspetor e `ResumoDaSessao` fixo ao
  lado) e editor de dieta (o `TotalDoDia` na coluna), ambos só com "Largura do conteúdo" Automática (`useTresColunas`);
  Resumo do aluno (Atividade recente como 3ª coluna quando cabem três de 640 px, 2560 com o menu aberto em diante) e Ajuda (índice, conteúdo e "Consultar"), que abre as 3 colunas quando o bloco de 1880 px cabe na largura medida (2560 com o menu aberto já abre; vale também para a Ajuda do aluno, mesmo componente).
- **Lista de alunos: selos e tags na mesma linha (25/11).** Primeiro o selo de situação ("Cobrança vencida", "Inativo", "Sem acesso"), depois até 2 tags e o "+N" (`treinador/SelosETagsDaLinha`, `dominio/selosDaLinhaDeAluno`); se não couberem, quebram para a linha seguinte. O "+N" é um botão próprio, irmão do link da linha (desenho dentro do link, botão transparente de 44 px por cima, fora do `<a>`), que abre as outras tags numa caixa ancorada (um chip por linha, mesmas cores) com Enter, Espaço, clique ou toque; Esc, toque fora, nova ativação ou X fecham e devolvem o foco; o anel do teclado fica na pílula do "+N"; o `title` é só reforço do mouse; o nome da linha diz "Tags: A, B e mais N" e o botão diz "Mais N tags: C, D".
- **Biblioteca (25/11).** *Outros:* o título da linha é o nome em negrito e, só se o princípio ativo for outro (comparado sem caixa e sem acento, `dominio/ergogenicos.tituloDoErgogenico`), " / princípio ativo" no mesmo tamanho, peso normal e cor suave; a linha de detalhe vem sem rótulos ("200 mg/ml · 10 ml", `detalheDoErgogenico`): campo vazio some e, sem os dois, não há linha; nunca "—". Editar item: Nome e Princípio ativo primeiro e, embaixo, Categoria na peça compartilhada `treinador/SeletorDeCategoria` (a mesma da Vitrine: `EscolhaSuspensa` com busca sem acento e sem caixa, "Sem categoria" primeiro, as categorias e "Criar categoria “x”" com "Categoria nova" só quando o texto não é uma que já existe; a existente fica com a grafia dela, `dominio/seletorDeCategoria.categoriaDoDigitado`); em Outros criar só usa o texto digitado (limite de 60), sem API; Concentração e Apresentação com placeholder; o cartão Observação não repete o rótulo do campo. *Editar alimento › Lista de compras:* FC e FCc um por linha, na largura toda do cartão; "Sugerir pelo nome" no cabeçalho e a estimativa embaixo. *Copiar do catálogo pronto:* mesma linha de detalhe, legenda (com "Tr = traço" só quando aparece) e filtros com chips das abas Exercícios e Alimentos, filtro "Na biblioteca" (Todos · Ainda não · Já tenho) na API e selo neutro "Já na biblioteca" com a caixa desabilitada.
- **Editor com índice e prévia ao vivo** (questionários de Anamnese, Atualização e Inscrição, 24/11; peça
  `treinador/questionarios/EditorQuestionario`, regras em `dominio/indiceDoQuestionario.ts`; e2e
  `e2e/editor-questionario-tela-larga.spec.ts`). O editor usa o mesmo contêiner das outras telas (`TelaDoEditor` com
  `LARGURA_MAXIMA`: à esquerda, junto do menu, sem teto em Automática e 1800 em Limitada) e a barra fixa tem a largura do
  conteúdo. A medida é a da área do próprio editor (`onLayout`, como o `MuralComLateral`), só na web:
  - **abaixo de 1000 px:** só o editor, com as abas Editar e Prévia (celular e tablet nunca mudam; 1280 de janela com o
    menu aberto mede ~990 px de área e fica aqui);
  - **1000 a < 1440:** índice de 240 px à esquerda, fixo ao rolar (`sticky`, `top` de 80 px, logo abaixo da barra, como o
    resumo do treino), e o editor no resto; as abas continuam (1536 de janela, o notebook a 125%, cai aqui);
  - **1440 em diante:** índice (260, até 320 depois que o editor chega ao máximo; os itens param em 320,
    `LARGURA_MAXIMA_DOS_ITENS`), editor flexível até `LARGURA_EDITOR_DE_CAMPOS` (1400) e a **prévia ao vivo** de 560 px
    encostada à direita (fixa ao rolar, com rolagem própria: um `RolagemComTopo` dentro da coluna, para o "Avançar" e os
    erros rolarem a coluna e não a página); as abas somem. Passados os máximos, a sobra vira vão, dividido igualmente entre
    os dois vãos (índice encostado à esquerda, editor no meio, prévia encostada à direita; `colunasDoEditor().vao`), em vez
    de uma faixa vazia só.
  - **Índice:** `role=navigation` "Seções do questionário", "Nesta página", "Instruções" e cada seção com a contagem
    ("10 perguntas"), selo "Corrigir" quando o último publicar apontou a seção ou uma pergunta dela; o item à vista (lido na
    rolagem da página, `itemVisivel`; no fim da rolagem, o último) tem a seleção neutra da Ajuda (`superficie3`, negrito,
    indicador da marca) e `aria-current="location"`. Tocar abre as perguntas da seção (o acordeão que existe; a seção em si
    não fecha), rola até ela logo abaixo da barra (`TelaDoEditor.mostrarAbaixoDaBarra`, que conta com a barra já
    grudada no topo, mesmo com a página no início), põe o foco no título e leva a prévia junto.
  - **Prévia ao vivo:** o mesmo `PreviaDoQuestionario` da aba, numa moldura com o fundo da tela do aluno; atualiza a cada
    mudança; ao editar uma seção (ou tocar no índice) vai até ela (na anamnese, à página dela). Na Inscrição, os campos
    fixos da página pública (`CamposFixosNaPrevia`, sem os escondidos no link) vêm antes das perguntas.
  - Somente leitura (sem `QUESTIONARIO_ALTERAR` ou arquivado): só a prévia, como antes, em qualquer largura.
- **Colunas independentes** (Ficha › Dados, 24/11): quando os cartões de duas colunas têm alturas diferentes, cada coluna é uma pilha própria com o mesmo vão. Os cartões de uma coluna não se alinham por linha com os da outra; uma proporção vale para a página toda (3:2 na ficha); a sobra fica só no fim da coluna mais curta. Não usar linhas com proporções diferentes (1:1 em cima, 2:1 embaixo), que deixam vão embaixo do cartão mais curto de cada linha.
- **Revisão de 24/11, regras que saíram da varredura** (planos `docs/planos/tela-larga-revisao-*.md`; e2e `e2e/tela-larga-*.spec.ts`):
  - **Início, Alunos, Atualizações, Números:** o Início escolhe de 1 a 6 colunas por `colunasDaGrade`, com teto 3 (`compacta`), 4 (`normal`) e 6 (`larga` e `ultralarga`), limitado pela coluna mínima (6 a partir de ~1916 px de painel; 5 em 1920). Alunos põe os cartões de grupo em duas colunas quando cada metade tem ≥ 1000 px de lista (`dominio/gruposEmDuasColunas`); Atualizações põe as linhas numa `Grade` de colunas iguais (célula ≥ 440 px, até 6; `dominio/colunasDaListaDeAtualizacoes`); Números segura indicadores e colunas no mesmo teto de 1800 px.
  - **Grade de quantidade fixa** (os 12 meses do Ano da Agenda) usa por linha o maior divisor do total que cabe (`mesesPorLinhaDoAno`: 12, 6, 4, 3, 2, 1), nunca 8 + 4. No Dia da Agenda os blocos param em `LARGURA_TEXTO_CORRIDO`. A Vitrine, na faixa larga, põe a grade de itens e a Página pública numa coluna fixa de 380 px ao lado, sem teto; abaixo disso a Página pública fica empilhada, até 640 px.
  - **Vitrine do treinador (24/11; plano `docs/planos/vitrine-categorias.md`):** grade de `CartaoDoProduto` (foto 1:1 ou ícone neutro, nome, "Categoria · Digital/Físico", preço com o especial e o original riscado, selo neutro "Inativo" e "Na página pública", Editar `secundario`); a partir de 600 px de grade, quantas colunas couberem com mínimo de 240 px (os cartões dividem a largura toda; com poucos itens por categoria sobra espaço à direita e o cartão não estica), abaixo uma coluna compacta com foto de 88 px; **agrupada por categoria** com subtítulo ("Sem categoria" por último; sem subtítulo se não há categoria nenhuma); reordenar dentro do grupo por arrastar (`ArrasteDaLista`, `PUT /vitrine/itens/ordem` com a lista completa) e por ⋯ → Mover para cima/baixo; "Organizar categorias" (`secundario`) ao lado de "Novo item"; cabeçalho "N de 30 itens. Os alunos veem só os ativos, nesta ordem.". A `FolhaDoItem` é folha média (`LARGURA_FOLHA_LARGA`) em seções Item (foto à esquerda, ≈ 180 px; Nome, Categoria, Descrição com contador 0/300; Tipo Digital · Físico e, só no Digital, a nota de que no celular o item digital mostra só foto, nome e descrição), Preço (Preço, Preço especial e Até numa linha; especial e Até ficam desabilitados com o motivo "Informe o preço para usar o preço especial." e apagar o preço limpa os dois), Onde comprar (Cupom e Link lado a lado) e Visibilidade; no celular, uma coluna com a foto em cima. A foto é a peça nova **`ui/AreaDeFoto`** (quadrada 1:1, `lado` 180; vazia = quadro tracejado inteiro clicável com "Escolher foto" + dica e aceita soltar arquivo na web, com "Solte para usar" no arraste e anel de foco no teclado; preenchida = prévia montada por quem usa + "Trocar" `secundario` + "Remover" `perigoTexto`; erro sob o quadro com "Tentar de novo"; não lê arquivo nem chama a API). O `CampoCategoria` usa a peça compartilhada `treinador/SeletorDeCategoria` (a mesma de Biblioteca › Outros) e cuida do que é da Vitrine: cria pela API, limite de 40, teto de 30, "Criando a categoria…"; sem categoria nenhuma, sugere por tipo (Físico: Roupas, Calçados, Acessórios, Livros; Digital: E-books, Cursos, Guias, Serviços) e só cria ao clicar. A vitrine do aluno separa por categoria na ordem definida, com subtítulo só quando há categoria (`CartaoDoItem` ganhou a prop `nivel`).
  - **Lista de linhas em colunas** (`treinador/ListaEmColunas`, `dominio/listaEmColunas`): a lista mede a si mesma e, quando cabem duas ou três colunas de pelo menos `minimo` px (560 na Biblioteca, 720 nos modelos do Planejamento), divide as linhas de cima para baixo, cada coluna uma `ListaDeLinhas` com as mesmas divisórias; teto de 3, nunca coluna vazia, com poucos itens a vaga fica vazia à direita. Campos de topo dos editores de modelo param em `LARGURA_EDITOR`; a busca do Planejamento, em 480 px.
  - **Interessados, Financeiro, Importação:** Interessados › Indicadores põe os oito números numa linha a partir de ~1840 px de grade e, a partir de 2448 px, Perdas, Origem, Como contamos e Limites lado a lado (`dominio/colunasDeInteressados`); Financeiro › Visão geral abre uma coluna de apoio (renovações, próximos, líquido e resultado do mês) quando o contêiner passa de 1800 + 16 + 480 px, medido pelo contêiner, então não abre em Limitada (`dominio/colunasDaVisaoGeral`); Planos vai a 5 colunas a partir de 2000 px e 6 a partir de 2400; os assistentes da Importação param em `LARGURA_EDITOR_DE_CAMPOS`, à esquerda, menos o Mapeamento.
  - **Equipe, Configurações, WhatsApp, Ajustes:** hub de Configurações em colunas empilhadas ("alvenaria", 25/11; `treinador/configuracoes/Alvenaria`, `dominio/alvenaria`): grupo de pelo menos 360 px, 1 coluna no celular, 2 na compacta e na normal, 3 na larga e 4 na ultralarga (`dominio/colunasPorCelula.colunasDoHub`, contadas pelos grupos que o perfil vê); cada grupo vai para a coluna mais baixa no momento (estimativa por itens), sem buraco além de 24 px; no DOM os grupos ficam na ordem lógica (a ordem do Tab) e são posicionados por cima; a página usa o container das outras telas (`LARGURA_LISTA`) e respeita "Largura do conteúdo"; Equipe (25/11): Perfis é grade de cartões de pelo menos 360 px na largura toda (4 numa linha em 3440, botões na mesma base) e, da faixa larga em diante, Membros é `Tabela` (Membro com o espaço extra, as outras colunas com largura fixa) com uma coluna de 360 px ao lado (`treinador/equipe/LateralDosMembros`: Convites pendentes, sem duplicar na tabela, e Equipe por perfil, que filtra); a Auditoria e as listas curtas de configuração continuam em `LARGURA_MAXIMA`; WhatsApp oficial: Conexão em `LARGURA_FORMULARIO` com os Modelos ao lado; Ajustes centra em 1464 px.
  - **Ficha do aluno:** Dados em duas colunas 3:2 até a `larga` e, quando a largura medida da aba comporta três colunas de 640 px com os vãos (o limiar do Resumo; abre em 2560 e 3440 com o menu aberto, que em 2560 ainda é a faixa `larga`), em três pilhas independentes 1 : 1,2 : 1 (`colunasDaAbaDados`, `dominio/colunasDaFicha.ts`): Identificação › Contato e endereço › Objetivo e observações; Plano contratado › Histórico de lesões; Configuração do acompanhamento › Acesso ao app › Anamnese, cada coluna até `LARGURA_EDITOR_DE_CAMPOS` (uma das três vazia volta às duas; na edição o formulário fica em `LARGURA_EDITOR_DE_CAMPOS` e a coluna só de seções sai; **com duas colunas e a da esquerda sem nada para mostrar, o que só acontece na edição sem o financeiro, a aba vira UMA coluna com o teto de 3/5 × (min(aba, 1400) − vão), a largura que a da esquerda teria, e o Histórico de lesões acompanha**: `colunaUnica` e `tetoDaColunaUnica`; ~580 px em 1280, ~826 px em 1920) (tabela das lesões a partir de 760 px). **Nas duas colunas (24/11) o Histórico de lesões sai da coluna e vai embaixo delas, na largura das duas somada** (`abaixoDasColunas`; em 1280 ~928 px, tabela; ultralarga e celular não mudam); Resumo com a Atividade recente como 3ª coluna quando cabem três de 640 px; Planos em `ListaEmColunas` (mínimo de 720 px); Acompanhamento e Evolução em duas pilhas independentes 1:1 quando cada uma tem pelo menos 1000 px (2560 e 3440); campo "Medida" até `LARGURA_FORMULARIO`.
  - **Início do aluno (revisão 2, 24/11; `dominio/arranjoDoInicio.ts`):** o "Hoje" é o primeiro bloco em qualquer largura. Uma coluna no celular (Hoje › Dieta › Água › pendências › compromissos › semana › nível › mapa › vitrine); em duas colunas até 1280: (Hoje, Dieta, pendências) | (Água, compromissos, vitrine), depois "Sua semana" e "Seu nível" lado a lado e da mesma altura e o mapa na largura toda (sem o retorno, a semana vai para a pilha da Água). Da faixa `larga` em diante, pilhas independentes sem vão embaixo: com o retorno, uma pilha (Hoje, Dieta, Água, pendências) e outra de duas faixas (semana e nível lado a lado, o mapa do ano em largura de cartão e, embaixo, compromissos e vitrine); sem o retorno, pilhas de uma faixa. Teto 1688 com mapa ou vitrine, 1120 nos outros casos.
  - **Mural, treinador e aluno (revisão 2, 24/11; `comunidade/MuralComLateral`, `dominio/arranjoDoMural`):** feed de 720 px e coluna de 340 px (vão 32) à direita a partir de 1280 px medidos na área do mural, fixa ao rolar na web (altura máxima da janela, rolagem por dentro, `role=complementary`); abaixo disso a coluna vai ao topo do feed e, sem conteúdo, não desenha nem o vão. Treinador: "Fixados" e "Enquetes abertas". Aluno: "Sua posição" e "Suas conquistas" (3 mais recentes, "Ver todas" leva à aba Conquistas); os números do aluno seguem uma regra só (`estadoDosNumeros`) na faixa do topo (abaixo de 1280 px de área, `comunidade/FaixaDosNumeros`) e na coluna ao lado (a partir de 1280; na web a tela do aluno chega a isso com janela de 1920): a posição só conta com treino concluído, e sem números as duas dizem "Treine para entrar no ranking" ou, se a leitura falhou ou não há rede, "Números indisponíveis", sempre com o caminho para a aba Conquistas. A faixa e a coluna existem sempre, com o esqueleto dentro delas enquanto carregam, e o feed nunca espera nem anda. A altura da faixa é `Math.round(56 × escala do texto)` (a do sistema, até 1,5, vezes o "Tamanho do texto" do app; `alturaDaFaixa`), igual em todos os estados; "Ver conquistas ›" fica sempre visível: ao lado do texto (até duas linhas) quando a faixa mede pelo menos 340 × escala, senão na linha de baixo, com o texto numa linha, dentro da mesma altura (`rotuloEmbaixo`); o esqueleto ocupa uma linha do texto e nada anda quando os números chegam. O quadro de 3 colunas do mural do aluno saiu.
  - **Telas do aluno na web:** teto próprio por faixa (`aluno/TelaDoAluno`, `dominio/telaLargaDoAluno`): 1120 (duas faixas de 552) até a `normal` e 1688 (três) da `larga` em diante, nunca quatro; grade de cartões por `colunasDaGradeDoAluno` (célula mínima 360, sem cartão sozinho na última linha), coluna lateral de 400 nas telas de trabalho (sessão do dia, dieta) e duas colunas no Histórico; botão e campo não esticam. Peças reusadas na folha "Ver como o aluno" recebem o arranjo largo só por prop (`largo`), nunca por contexto. A Conta segue a regra de formulário.
- **Decisões de 24/11 (revisão 2)** (`docs/planos/tela-larga-revisao-2.md`):
  - Dados em 1280 px ficam 3:2, com os rótulos empilhados na coluna da direita.
  - Atualização: a situação vence a categoria.
  - Cores (2b): contagens genéricas ficam neutras; cor de categoria só quando o cartão representa uma área do app (ex.: Treinos registrados). Nada a restaurar.
  - Lesões: tabela a partir de 760 px.
  - Histórico da importação, Auditoria e Membros aceitam a sobra na ultralarga (uso raro).
  - Os "antes" sobrescritos das capturas não serão refeitos.

### 4.11 Aba Vídeos da Comunidade (Gustavo, 20/11/2026; plano `docs/planos/comunidade-19-11.md`)

Aba Vídeos do treinador (`treinador/comunidade/ListaDosVideos`, `SecaoDaColecao`; o `CartaoDoVideo` e a `CapaDoCartao` moram em `comunidade/` e são os mesmos no aluno, em `aluno/ColecoesDeAuloes`, sem ⋯ nem alça e com "Abrir no YouTube"/"Abrir vídeo" visível; grade em
`dominio/gradeDosVideos.ts`, `colunasDosVideos`). Só quem modera a comunidade organiza; os demais leem.

- **Uma seção por coleção, sem cartão em volta.** O cabeçalho (`comunidade/CabecalhoDaColecao`, o mesmo no aluno, 23/11; plano `docs/planos/comunidade-cabecalho-de-colecao.md`) tem o sobretítulo "COLEÇÃO N" (pela ordem que o aluno vê, `dominio/cabecalhoDaColecao`), o nome da coleção (h2, 20 px semibold, acima do título dos vídeos), a pílula neutra "N vídeos" (número em fonte numérica), a alça de arrastar, "Adicionar
  vídeo" (que já escolhe a coleção) e o ⋯ (Renomear, Mover para cima, Mover para baixo, Excluir coleção), os três últimos centralizados na altura de sobretítulo + nome; um fio `divisor` de largura total acima de cada seção, menos a primeira, e cerca de 40 px entre seções. No arraste da seção, o cabeçalho inteiro é o que se move. O nome acessível é "Coleção 1: Treinos, 1 vídeo". "Sem coleção" usa
  a mesma seção, com o sobretítulo "SEM COLEÇÃO" e sem o nome, sem ⋯, alça nem "Adicionar vídeo", e fica por último. Fim da aba: "+ Nova coleção", com o campo ali mesmo.
  Coleção vazia mostra "Nenhum vídeo nesta coleção" e "Adicionar vídeo" no corpo, não no cabeçalho.
- **Excluir coleção sempre com texto:** o painel diz que os vídeos passam para "Sem coleção". Nenhum vídeo é apagado. Os
  publicados continuam para o aluno, sem a numeração.
- **Grade pela área de conteúdo** (4.10): 6 colunas a partir de 2400 px (`ultralarga`), 5 de 2000 a 2400 (`LARGURA_CINCO_VIDEOS`), 4 de 1600 a 2000, 3 de 1024 a 1600, 2 abaixo, 1 abaixo de 600 px (24/11).
  Poucos vídeos ficam com a largura de uma coluna, à esquerda.
- **Cartão do vídeo:** capa 16:9 com o play "Assistir: <título>" e a posição num selo no canto; sem capa, fundo
  `superficie2` com ícone e o título. Título até 2 linhas; descrição até 2 linhas em texto suave, omitida se repetir o
  título; linha de dados "Nenhum comentário", "1 comentário" ou "N comentários" em texto comum; ⋯ no fim. "Abrir no YouTube"
  saiu do cartão e vai para o ⋯, que só existe com `COMUNIDADE_MODERAR`. Quem só lê não tem ⋯: no lugar dele o cartão mostra
  o botão visível "Abrir no YouTube" ("Abrir vídeo", se o link não é do YouTube), que abre fora do app, sem token (AGENTS.md).
- **Ordem:** arrastando pela alça ou pelo ⋯ ("Mover para cima/baixo"). Uma linha fixa abaixo das abas diz ao treinador que
  o aluno vê as coleções nessa ordem, com os vídeos numerados, e que coleção sem vídeo publicado não aparece para ele.
- **Folha Novo vídeo / Editar vídeo:** ordem Link do vídeo, capa, Título, Coleção e Descrição. Ações "Publicar" e, na
  edição, "Salvar". Com link do YouTube válido, a capa vem sozinha, com "Trocar capa" e "Remover capa" (depois de
  "Remover capa" o vídeo fica sem capa e o link deixa de acompanhar a capa). Capa trocada à mão nunca é sobrescrita pelo
  link; se o link mudar de vídeo, aparece um aviso. Link inválido: erro em vermelho embaixo do campo, com "Publicar"
  desativado. Link de fora do YouTube não tem prévia. Com "Sair sem salvar?" quando há alteração.

### 4.12 Arrastar com cópia translúcida (Gustavo, 20/11/2026; plano `docs/planos/arrastar-com-copia-translucida.md`)

Uma peça só (`ui/ArrasteDaLista`, núcleo `useArraste`; web em `ui/arrasteNaWeb`) para dieta, treino, mobilidade, Início em edição e Kanban dos Interessados.

- **Começo:** no mouse, pela alça ⋮⋮ depois de 4 px (clicar continua sendo clicar; no Kanban o cartão inteiro arrasta); no aparelho, toque longo de 250 ms.
- **Durante (web):** cópia do item a 0,6 de opacidade, escala 1,02 e sombra seguindo o ponteiro; origem invisível com contorno tracejado em `cores.borda`; linha guia de 2 px em `cores.acao`; rolagem automática a menos de 48 px da borda; Esc cancela. Movimento reduzido: a cópia segue o ponteiro e só some no fim, sem encaixe.
- **Kanban:** a coluna que aceita o cartão ganha borda `acao`, fundo `acaoSuave` e o espaço tracejado "Solte aqui"; colunas vazias dizem "Solte aqui" só durante o arraste. O ⋯ do cartão (canto superior direito, "Mover X para") abre direto os destinos e é a via do teclado; abaixo de 760 px não há arraste ("Use o ⋯ do cartão para mudar de etapa.").
- **Ao soltar:** "Ordem alterada." ou "Movido para …" com Desfazer. No Início em edição não há aviso (tudo é rascunho; Cancelar descarta) e o destino é o bloco sob o ponteiro com borda `acao`.
- **Status:** **Verificado na web** com mouse em 1280 (claro e escuro) e 390; **não conferido** no aparelho nativo, nos temas areia e contraste alto, nem por toque num tablet largo. O tracejado em `cores.borda` fica fraco no tema claro (decisão do D1; pendente com o Gustavo).

### 4.13 Textos do topo da tela (Gustavo, 25/11/2026; plano `docs/planos/ajustes-de-layout-25-11.md`)

- **Descrição do cabeçalho vira ⓘ.** `ui/Cabecalho` guarda a explicação da tela em `descricao`: um ⓘ "Sobre esta tela" logo depois do título (`ui/AjudaDoCabecalho`) abre um balão com o texto e o link "Saiba mais" para a seção da Ajuda da tela (`dominio/ajudaDaTela`, `?secao=`; tela sem artigo mostra só o texto). Abre com o mouse em cima (250 ms), no foco do teclado e no toque; Esc, tocar fora e sair fecham; o mouse pode entrar no balão; sem animação. `subtitulo` fica só para dado (nome, contagem, data), nunca para explicação. Verificado na web; **não conferido** no aparelho nativo (`Modal` ancorado e `accessibilityHint`).
- **Financeiro sem frase solta no topo.** As abas não explicam mais o que fazem em texto corrido; a ação principal ("Nova cobrança avulsa", "Novo lançamento") vai para a linha da busca (`AcaoDaBusca`, `BarraDeFiltros depois`). O aviso de histórico parcial só existe no Início do treinador e na exportação CSV.
- **Biblioteca sem link no topo.** "Importar da sua planilha" saiu; com a biblioteca vazia, o estado vazio traz o link secundário "Importar de planilha".

## 5. Os problemas de design que estamos resolvendo

Origem principal: a reunião gravada de 29/10, com o treinador usando o sistema por 40 minutos. Ele elogiou a
fluidez, mas **dependeu de explicação para se achar**. O diagnóstico é de **orientação**, não de cor.

### 5.1 "Tudo parece uma coisa só, sem início e fim"

- **Sintoma:** em telas densas (editor de treino, ficha do aluno, pasta), não dava para ver onde um bloco terminava
  e o outro começava.
- **Causa no código:** o cartão do exercício e o grupo de séries usavam a mesma superfície e bordas muito parecidas;
  bordas e faixas eram claras demais.
- **O que já fizemos (30/10):**
  - faixa de cabeçalho em todo cartão com título e no topo de toda Folha;
  - bordas mais fortes nos temas;
  - exercício como bloco principal e grupo de séries como região interna diferente;
  - pasta com Treino, Dieta e Mobilidade em blocos próprios;
  - tema "Claro areia".
- **O que ainda pede atenção:** não cair no extremo oposto. Cartão dentro de cartão dentro de cartão deixa a tela
  pesada. Regra: **contorno forte só no grupo principal; nos níveis de dentro, divisor ou recuo.**

### 5.2 Confusão entre "pasta", "plano" e "o que o aluno vê"

- **Sintoma:** com duas pastas "ativas", o treinador não sabia qual o aluno estava usando, e achava que finalizar
  a pasta antiga trocava o aluno para a nova.
- **Realidade do sistema:** são três coisas diferentes:
  - **pasta aberta/concluída** é organização;
  - **plano rascunho/publicado** é disponibilidade;
  - **plano em uso pelo aluno** é o último publicado de cada tipo.
- **O que já fizemos:**
  - o filtro passou de "Ativas" para "Abertas";
  - cada plano mostra o selo "Em uso pelo aluno";
  - finalizar explica que não troca o que o aluno vê;
  - aplicar modelo e copiar plano pedem o destino e dizem que entra como rascunho.

### 5.3 Ação que não faz o que parece

- **Sintoma:** na importação, "Escolher Alunos" parecia enviar o arquivo e o botão de modelo parecia importar.
  O lugar de enviar o arquivo ficava escondido lá embaixo.
- **O que já fizemos:**
  - assistente em etapas: destino e arquivo, configuração, mapeamento, validação, resultado;
  - baixar modelo virou ação secundária;
  - "Voltar" em vez de "Cancelar";
  - a planilha aparece inteira e dá para corrigir células na própria tabela.
- **Princípio:** o rótulo do botão diz **o resultado** ("Enviar planilha", "Publicar para o aluno"), não a mecânica.

### 5.4 Linguagem que mistura conceitos

- "Porção da embalagem" era lida como "dose prescrita"; agora o campo se chama **Dose prescrita** e a porção aparece
  só como referência.
- Quantidade sem fator de cocção era lida como "compra em cru"; agora o item mostra "Sem fator" / "(como na dieta)".
  Na pendência: separar escrito "Conforme a dieta" de "Estimativa para compra".
- O gráfico de peso "sumia" com um registro só; hoje (13/11) ele aparece com um registro, mostrando só o ponto, e a linha vem a partir de dois. O cartão Peso começa por um resumo acima de Lista e Gráfico ("Último registro" e "Desde o registro anterior"); a Lista tem Data, Peso, Variação e Ações, com a observação (só da equipe) como detalhe do registro e a meta escrita abaixo do resumo. A legenda das setas saiu: seta e sinal já dizem a direção. A Avaliação física abre pela Evolução (abas Evolução e Comparar com 2 ou mais avaliações; plano `docs/planos/avaliacao-fisica-visual.md`).
- **Princípio:** linguagem do treinador, não do banco. Se dois conceitos podem ser confundidos, os nomes têm de ser
  visivelmente diferentes.

### 5.5 Excesso de informação ao mesmo tempo

- **Sintoma:** formulários longos (série com técnica, carga e esforço; dieta com opções e complementos) mostram
  tudo de uma vez.
- **Caminho:** revelar aos poucos (abrir o detalhe quando precisa), com um resumo fiel do que já foi preenchido, e
  levar direto ao erro escondido ("N problemas · ir ao primeiro").

### 5.6 O que ainda está em aberto

| Tema | Situação |
| --- | --- |
| Painel do treinador em blocos (Próximo passo → Acompanhamento → Planejamento), inspirado na referência | Não começou; é a próxima frente grande. |
| Orientação no primeiro uso, além do passeio pelo menu | Não começou. |
| Categorias de suplementos do catálogo ("Suplementos / Whey" → "Whey") | Feito na V047: tira o prefixo só do item com nome e categoria ainda iguais aos do catálogo padrão (o que o treinador editou fica); o `heavysuppz.json` e o do importador já vêm sem prefixo. |
| Textos de modelo × plano do aluno e dos complementos da dieta | Ajuste pequeno, pendente. |
| Escolher a linha do cabeçalho na importação | Pendente; muda a API e a tela. |
| A planilha que falhou na reunião | Só dá para reproduzir com os nomes das abas e das colunas, sem dados. |

---

## 6. A questão principal: funcionalidade, simplicidade e rapidez

Toda mudança de design passa por estas três perguntas, nesta ordem. Quando uma melhora visual piora uma delas,
**a melhora visual perde.**

### 6.1 Funcionalidade: não quebrar o que funciona

O app tem regras que não aparecem na tela mas sustentam tudo. Um ajuste visual **nunca** mexe em:

- **Plano publicado:** é imutável. Editar mexe só no rascunho; publicar cria versão nova.
- **Registro do aluno:** carga, repetições e séries têm a fila offline e o reenvio idempotente.
- **Metodologia:** tipos de série, técnicas, grupos, etapas de Cluster/Rest-pause e carga sugerida têm contrato
  próprio com a API.
- **Isolamento e permissões:** um treinador nunca vê dado de outra consultoria; a tela só esconde, quem barra é a API.
- **Ausência de dado:** é "—" (nos pares dos Dados do aluno, "Não informado"), nunca zero, e nada de opinar sobre saúde.

Como garantimos:
- testes de regra pura (Jest) e testes de tela em 390 e 1280 px (Playwright) antes de subir;
- mudança visual vem **separada** de mudança de comportamento, para cada uma ser revisada pelo que é.

### 6.2 Simplicidade: menos coisas, mais claras

- **Um botão principal por área.** Se tudo é destaque, nada é.
- **Peças que já existem antes de peças novas.** Hoje são cerca de 100 peças compartilhadas; outro jeito de fazer
  cartão, lista ou escolha só entra se nenhuma servir, e então vira peça compartilhada.
- **Nada de framework visual novo** nem segunda versão de uma função que já existe: melhorar a descoberta e a
  apresentação do que já está lá.
- **Esconder o avançado, não o essencial.** O dia a dia (registrar série, revisar atualização, publicar plano) tem
  de estar a um ou dois toques.
- **Cor não é decoração.** Não pintar cada cartão de uma cor; a cor diz status ou marca, e só.
- **Texto curto e concreto.** Ajuda de campo só onde evita erro, em uma linha.

### 6.3 Rapidez: para o treinador no PC e para o aluno no celular

**O que já ajuda:**
- React Compiler (memoização automática).
- Peças leves: sem sombras, gradientes ou bibliotecas de gráfico.
- Listas grandes paginadas na API (alunos, interessados, auditoria).
- O aluno abre e registra **sem internet**: o plano fica salvo no aparelho e a série gravada aparece na hora.
- Fontes carregadas só nos pesos usados.

**Pontos de atenção medidos (30/10):**
- **O pacote da web é um arquivo só de 7,3 MB (≈ 1,6 MB comprimido).** Não há divisão por rota: o aluno no celular
  pela web baixa também o código do editor de treino, da importação, da agenda etc. É o maior ganho de rapidez
  disponível. Ideias:
  - carregar sob demanda as telas pesadas do treinador;
  - conferir o que mais pesa (ícones, fontes decorativas, PDFs).

  Precisa ser medido antes e depois.
- **Listas renderizadas inteiras** (`map` dentro de rolagem, sem virtualização). Funciona com o volume de hoje,
  mas a planilha da importação já precisou de páginas de 50 linhas. Lista que pode passar de algumas centenas de
  itens deve paginar ou virtualizar.
- **Telas muito grandes num arquivo** (importação, editores de treino e dieta, folha do interessado: 500 a 750 linhas)
  são mais difíceis de manter rápidas e corretas. Dividir quando uma mudança tocar nelas.
- **Mais faixas e bordas = mais elementos na tela.** Na hierarquia visual, preferir resolver com cor de superfície
  e divisor (barato) a acrescentar camadas de `View`.

### 6.4 Lista de conferência para qualquer mudança visual

- [ ] Em 390 px e em 1280 px dá para dizer onde cada bloco começa e termina, sem depender da cor?
- [ ] Funciona no claro, no escuro, no claro areia e no contraste alto (contraste conferido)?
- [ ] O botão diz o resultado da ação? Há só um botão principal na área?
- [ ] Reaproveitou uma peça de `ui/` em vez de criar outra?
- [ ] Nenhuma regra de negócio, contrato da API, fila offline ou publicação mudou por causa do visual?
- [ ] Teclado, foco, leitor de tela e toque de 44 px continuam funcionando?
- [ ] A tela não ficou mais pesada (mais camadas, lista inteira sem página, import grande numa tela do aluno)?
- [ ] Jest, lint, typecheck e o e2e da tela passaram?

**Composição (4.6; vale para tela com modal, formulário, filtro, opções, prévia ou mensagens):**

- [ ] Qual padrão da 4.6 a tela usa (P1 a P5)? Foi reutilizada a peça dele, e a exceção, se houver, está justificada?
- [ ] **Alinhamento:** rótulos, campos, botões e legendas compartilham a mesma borda esquerda; campos de uma linha têm a
  mesma altura e a base alinhada, também quando só um deles mostra erro.
- [ ] **Espaços vazios:** nenhum vão entre blocos que não seja o espaçamento da grade de 8 px; nenhum bloco com sobra
  esticada ao lado (linha de opções, grade de cartões, par de campos).
- [ ] **Posição das ações:** a ação principal fica no mesmo lugar que nas telas equivalentes (rodapé fixo, à direita no
  PC, em coluna e `cheia` no celular); só uma ação principal por área.
- [ ] **Rolagem:** o cabeçalho e o rodapé do modal não rolam, só o corpo; o rodapé está visível sem rolar em 390 e em
  1280 px (e com o teclado aberto no celular).
- [ ] **Mensagens:** cada motivo ou aviso aparece uma vez, junto do elemento a que se refere, com ícone ou texto além da cor.
- [ ] **Consistência:** a tela foi comparada com pelo menos uma tela equivalente (mesmo padrão) em 390 e 1280 px e a
  diferença que sobrou é uma variante nomeada na 4.6.
- [ ] A captura de cada largura e tema conferido está citada no plano da frente; o que não foi conferido está dito.

---

## 7. Glossário rápido

| Termo | Significado |
| --- | --- |
| Consultoria | O "espaço" de um treinador e sua equipe. Isolado dos outros. |
| Pasta | Período de acompanhamento do aluno; agrupa treino, dieta e mobilidade. Aberta ou concluída. |
| Plano | Treino, dieta ou mobilidade dentro da pasta. Rascunho → publicado (versão imutável). |
| Em uso pelo aluno | O último plano publicado de cada tipo; é o que o aluno vê. |
| Modelo | Molde no Planejamento; aplicar cria uma cópia independente no aluno. |
| Metodologia | Tipos de série (Aquecimento, FS, WS, Top set, Back off), técnicas e combinações da consultoria. |
| Atualização | O questionário que o aluno responde no fim de cada pasta. |
| Folha | Painel por cima da tela (formulário, escolha, detalhe). |
| Faixa | O topo destacado de um cartão ou folha, onde ficam título e ações. |

---

## 8. Onde ler mais

- `AGENTS.md` (raiz) e `app/AGENTS.md`: todas as regras do projeto, inclusive design (seções "Design", "Níveis",
  "Tipografia", "Botões" e "Seleção").
- `app/src/tema/tokens.ts`: as cores e medidas, com o porquê de cada uma.
- `docs/planos/clareza-do-treinador.md`: decisões e entregas da frente de clareza (reunião de 29/10).
- `docs/planos/README.md`: índice das frentes e pendências.
