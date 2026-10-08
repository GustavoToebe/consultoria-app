# Plano: hierarquia visual e personalização (web e app)

> Para o Sonnet ou o Codex executar **hoje**, as três partes. Vale para o **app inteiro, em todas as telas** (lista
> completa na seção 6.1), na **web e no celular**, para o **treinador e o aluno**: os componentes são os mesmos (`app/src/ui/`), então a mudança aparece nos dois.
> Leia o `AGENTS.md` antes de começar. Nada aqui muda regra de negócio, API de planos, offline ou segurança.

## 0. Como trabalhar

1. **Ponto seguro:**
   - `git switch main && git pull --ff-only origin main && git tag antes-hierarquia`.
   - Depois, `git switch -c visual/hierarquia`.
2. **Commits:** um commit por item numerado (ex.: "App: tokens com três níveis de superfície (H1.1)"), em português.
   - Rodar `cd app && npm run typecheck && npm run lint && npm test` antes de cada commit.
   - Na Parte P2 também `cd api && mvn verify`.
3. **Ordem:**
   - Parte H1 (base) → H2 (estrutura) → H3 (app do aluno) → P (personalização).
   - Se o tempo acabar, o que foi feito em ordem entra e o resto fica para depois. Nada pela metade dentro de um item.
4. **Fim:**
   - Mandar ao Gustavo as tiradas de tela da seção 9 (antes e depois) e a lista de verificação.
   - **Quem decide se junta na `main` é o Gustavo.** Se ele não aprovar, a `main` fica como está e a etiqueta
     `antes-hierarquia` continua lá.
5. **Contexto:** a demonstração para o Saraiva é no domingo, 11/10/2026, às 16:30. Não faça nada que arrisque o
   roteiro do README ("Roteiro da demonstração"). Na dúvida entre bonito e seguro, fique com o seguro e anote.

## 1. Diagnóstico (o que o Gustavo sentiu: "parece tudo uma coisa só")

Comparação com o Servirea, que ele acha mais claro. Medido no código atual:

| Problema | Onde | Efeito |
|---|---|---|
| Fundo, cartão e campo quase iguais | `tokens.ts`: fundo `#0E0E10`, cartão `#17171A`, campo `#1F1F23`, borda `#2A2A2F` (contraste cartão/fundo 1,08; borda/cartão 1,25; campo/cartão 1,09) | O olho não vê onde o bloco começa |
| Título do bloco é o texto mais fraco | `Cartao` usa a variante `secao` (12 px, cinza, caixa alta) | "PLANO", "METODOLOGIA" somem; rótulo de campo tem o mesmo peso |
| Largura ignorada | `Tela`: qualquer `largura` acima de 640 vira 1800 | Editor de 960 px abre com 1.440 px, campos enormes |
| Botões iguais | `Botao` estica na coluna (`alignItems: stretch`); "Vincular metodologia" parece campo; 4 botões iguais lado a lado; "Salvar como modelo" duas vezes | Não se sabe o que é principal |
| Vermelho em tudo | `Escolha` pinta o selecionado com a cor da marca (Seg, Treino, Escuro, Metal) | Fere a regra dos tokens ("marca só em ação principal, menu ativo e título da marca") e tira o peso do "Publicar" |
| Níveis invisíveis | `CartaoSessao` é igual ao `Cartao` do plano; as 7 sessões abertas uma embaixo da outra | Não dá para ver que a sessão está dentro do plano |
| Espaço igual | `Tela` com `gap` 16 entre blocos e 12–16 dentro | Proximidade não agrupa nada |

O Servirea funciona por **poucos contrastes fortes**:
- fundo cinza e cartão branco;
- cabeçalho da tabela em faixa escura;
- título da página grande;
- um só botão preenchido por área;
- selos com cor.

É isso que vamos copiar, não as cores.

## 2. Regras da hierarquia (valem para todas as telas)

**Níveis de superfície** (do fundo para a frente):

| Nível | Uso | Token |
|---|---|---|
| 0 | Fundo da página | `fundo` |
| 1 | Bloco (`Cartao`) | `superficie` + `borda` |
| 2 | Faixa de cabeçalho de grupo (sessão, refeição, pasta) | `superficie2` |
| 3 | Item dentro do bloco (exercício, plano da pasta, linha de lista) | `superficie2` + `borda` |
| — | Campo de digitar | `campo` + `bordaCampo` (mais escuro que o cartão: um "buraco" onde se escreve) |
| — | Pressionado ou hover | `superficie3` |

**Tipografia (de cima para baixo):**
- título da página 24/30 negrito;
- título de bloco 16/22 seminegrito na cor do texto;
- faixa de grupo 17/22 seminegrito;
- corpo 15/21;
- rótulo de campo 13/18 seminegrito em `textoSuave`;
- `secao` (12, caixa alta) só para **sub**título dentro de um bloco, como "Exercícios".

**Botões:**
- **No máximo 1 `primario` por área** (topo da tela, rodapé de folha, rodapé de bloco).
- `secundario` (contorno) para o resto e `fantasma` (só texto) para ação rara ou de baixo risco.
- **Destrutiva** = `fantasma` com texto vermelho + `PainelConfirmacao`.
- Botão nunca estica sozinho: só com `cheio`.

**Cor:**
- Marca só em ação principal, menu e aba ativos, "Treino de hoje" e título da marca.
- Selecionado em `Escolha` e chips = **invertido**: fundo `texto`, letra `fundo`.
- Status continua no `Selo`, com texto.

**Espaço:**
- 24 px entre blocos, 16 px entre grupos dentro do bloco e 8–12 px entre campos do mesmo grupo.
- Padding do cartão: 20 px no PC e 16 px no celular.

**Largura:**
- formulários e editores com até 1.040 px;
- listas e painéis com até 1.280 px;
- dois campos curtos lado a lado a partir de 900 px de largura.

## 3. Parte H1: base visual (muda o app todo de uma vez)

### H1.1 Tokens (`app/src/tema/tokens.ts`)

Acrescentar `campo` e `bordaCampo` à interface `Cores` e trocar os valores abaixo. Os contrastes já foram calculados.

| Token | Escuro (atual → novo) | Claro (atual → novo) |
|---|---|---|
| fundo | `#0E0E10` → `#0A0A0C` | `#F4F4F5` → `#EAEAED` |
| superficie | `#17171A` → `#18181B` | `#FFFFFF` (igual) |
| superficie2 | `#1F1F23` → `#222226` | `#F0F0F2` → `#F4F4F5` |
| superficie3 | `#27272C` → `#2C2C31` | `#E7E7EA` (igual) |
| divisor | `#2A2A2F` (igual) | `#E4E4E7` (igual) |
| borda | `#2A2A2F` → `#3A3A41` | `#DCDCE0` → `#D4D4D8` |
| campo (novo) | `#0F0F12` | `#FFFFFF` |
| bordaCampo (novo) | `#63636B` | `#8A8A93` |
| texto | `#F2F2F3` → `#F4F4F5` | `#111114` (igual) |
| textoSuave | `#9A9AA2` → `#A1A1AA` | `#5F5F67` → `#52525B` |

Status (`sucesso`, `atencao`, `perigo`, `neutro`) não mudam.

Resultado: cartão/fundo sobe de 1,08 para 1,12 no escuro e de 1,10 para 1,20 no claro; borda/cartão de 1,25 para
1,57. A borda do campo fica com ≥ 3:1 sobre o campo nos dois temas (WCAG 1.4.11), e `textoSuave` sobre `superficie3`
fica com ≥ 5:1.

**Também:**
- `global.css`: espelhar os valores novos (o `variaveis.test.ts` cobra).
- `variaveis.ts`: `--color-input` passa a ser `bordaCampo` e `--color-border` continua `borda`.
- `tokens.test.ts`: acrescentar estes testes:
  - `contraste(bordaCampo, campo) >= 3` nos dois temas;
  - `contraste(borda, superficie) >= 1.4` nos dois temas;
  - `contraste(fundo, superficie) >= 1.1` nos dois temas;
  - o teste atual de `textoSuave` continua valendo.

### H1.2 Largura da tela (`ui/Tela.tsx`)

- Bug: `largura <= LARGURA_FORMULARIO ? largura : LARGURA_MAXIMA` faz 960 e 1.100 virarem 1.800. Trocar por
  `Math.min(largura, LARGURA_MAXIMA)`.
- Criar `LARGURA_EDITOR = 1040` e `LARGURA_LISTA = 1280` em `tokens.ts` e usar assim:
  - **editores** de treino, dieta e modelo, marca e perfil: `LARGURA_EDITOR`;
  - **ficha do aluno, início, alunos, biblioteca, receitas e planejamento:** `LARGURA_LISTA`;
  - **telas do aluno:** continuam com 720.
- `gap` do conteúdo: `espaco(3)` (24 px).

### H1.3 Tipografia (`ui/tipografia.ts`)

- `titulo`: 22/28 → **24/30**.
- Nova variante `bloco`: 16/22, `fontes.semi`, cor `texto`. É o título de `Cartao` e de folha.
- Nova variante `rotulo`: 13/18, `fontes.semi`, cor `textoSuave`. É o rótulo de `Campo`, `CampoNumerico`, `Escolha`
  e `Interruptor`.
- `secao` continua (12/16, caixa alta) para subtítulo dentro de bloco.
- Atualizar `tipografia.test.ts` (a escala passa a ser 12, 13, 14, 15, 16, 24, 28) e o trecho do `AGENTS.md` que diz
  "escala original".

### H1.4 Cartão (`ui/Cartao.tsx`)

- Título com a variante `bloco`. O título recolhível continua igual, com a seta.
- Padding `espaco(2.5)` a partir de 900 px de largura e `espaco(2)` abaixo. `gap` interno `espaco(2)`.
- Nova prop opcional `descricao` (uma linha `suave` abaixo do título) para trocar os textos soltos de explicação.

### H1.5 Campos (`ui/Campo.tsx`, `ui/Campos.tsx`)

- Fundo `campo`, borda `bordaCampo` de 1 px; com foco, borda de 2 px na cor da marca (sem mudar a altura: compensar o
  padding); com erro, `perigo`.
- Rótulo com a variante `rotulo`.
- `CampoNumerico` e os campos de peso e repetição do aluno usam o mesmo padrão. Hoje um deles usa `cores.fundo` como
  fundo: trocar para `campo`.

### H1.6 Botão (`ui/Botao.tsx`)

- `alignSelf: 'flex-start'` por padrão; com `cheio`, `alignSelf: 'stretch'`.
- **Auditar** os 14 usos de `cheio` e todos os `<Botao` dentro de coluna. Os que precisam ocupar a largura no celular
  (entrar, "Começar treino", "Voltar para o dia", rodapé de folha no celular) recebem `cheio`.
- `fantasma` sem borda, só texto, com `superficie3` quando pressionado ou com hover.
- Novo `tipo="perigoTexto"`: fantasma com texto `perigo`. Usar em "Remover sessão", "Remover refeição", "Tirar da
  biblioteca" e "Inativar aluno".
- Varrer as telas e deixar **um `primario` por área**. Exemplos:
  - editor: só "Publicar";
  - ficha: só "Abrir" do plano ativo;
  - marca: só "Salvar marca".

### H1.7 Seleção (`ui/Escolha.tsx`, chips de dia em `aluno/CartaoDivisao.tsx` não)

- `Escolha` selecionada: fundo `cores.texto`, texto `cores.fundo`, borda `cores.texto`. Não selecionada: fundo
  `superficie2`, borda `borda`.
- **Exceção, que fica como está:** o chip de data "hoje" do aluno e o cartão "Treino de hoje" continuam na cor da
  marca (está no `AGENTS.md`).
- Atualizar o comentário de `tokens.ts` e o `AGENTS.md` ("seleção = invertido; marca só em ação principal").

### H1.8 Conferência da H1

- Abrir as telas do treinador e do aluno nos dois temas (seção 9).
- Nada pode ficar com texto sem contraste ou botão sumido.

## 4. Parte H2: estrutura das telas do treinador

### H2.1 Faixa de grupo (`ui/CabecalhoDeGrupo.tsx`, novo)

- Fundo `superficie2`, cantos de cima 8 px e divisor embaixo, ocupando a largura do cartão (o cartão perde o padding
  em cima).
- **Esquerda:**
  - ícone opcional (lucide, 18 px, `textoSuave`);
  - título com 17/22 seminegrito;
  - linha `suave` com o resumo;
  - `Selo` opcional.
- **Direita:** ações (ícones) que não quebram em duas linhas; no celular, viram uma linha abaixo do título.
- Clicável para recolher e abrir quando receber `aoAlternar` (seta à direita e `accessibilityState.expanded`).

### H2.2 Topo com trilha (`ui/Cabecalho.tsx`)

- Nova prop `trilha?: { rotulo: string; href: Href }[]`, mostrada acima do título **só a partir de 900 px**:
  "Alunos › Aluno Demonstração › Plano de treino". O último item não é link. No celular continua só a seta de voltar.
- O nome do aluno vem do que a tela já tem. Se o editor não tiver o nome (o `PlanoResumo` não traz), use
  "Ficha do aluno". **Não crie rota na API para isso.**
- Usar em ficha do aluno, editores de treino e dieta, modelo de planejamento e editor de modelo.

### H2.3 Editor de treino (`treinador/treino/EditorDeTreino.tsx`, `CartaoSessao.tsx`, `CartaoExercicio.tsx`, `plano/TopoPlano.tsx`)

**Ordem nova da tela:**

1. **Topo do plano (`TopoPlano`):**
   - um cartão com o título do plano em `bloco`, os selos (Rascunho salvo, Rascunho, Publicado vN) e o período, numa
     linha `suave`;
   - à direita, "PDF (rascunho)" e "Validar" (`secundario`) e **"Publicar" (único `primario` da tela)**;
   - o campo "Título" fica dentro de "Configuração do plano" (item 2).
2. **"Configuração do plano":**
   - `Cartao recolhivel` com Título, Metodologia, Objetivo e Orientações gerais;
   - começa **recolhido quando o plano já tem sessões** e aberto quando não tem;
   - **metodologia:** linha "Metodologia: Nome" (ou "Nenhuma vinculada") + botão `secundario` "Trocar"/"Vincular",
     **sem esticar**;
   - o texto explicativo vai para a `descricao` do cartão.
3. **Barra das sessões (`treinador/treino/SeletorDeSessoes.tsx`, novo):**
   - linha de chips com rolagem horizontal, um por sessão, por exemplo "Seg · Costas" com ícone do tipo:
     - `Dumbbell` = Treino;
     - `Footprints` = Descanso ativo;
     - `BedDouble` = Descanso;
     - `Plus` = Acessórios;
   - selecionado invertido (H1.7); sessão com erro de validação ganha um ponto vermelho + `accessibilityLabel` com
     "precisa corrigir";
   - no fim, chip "+ Sessão" (chama o `adicionarSessao` atual e seleciona a nova);
   - à direita da barra, botão `secundario` **"Modelos"**, que abre uma `Folha` com três opções:
     - "Usar modelo de semana" (troca as sessões);
     - "Adicionar treino de um modelo";
     - "Salvar a semana como modelo".
4. **Só a sessão selecionada aparece**, num `Cartao` com `CabecalhoDeGrupo`:
   - **cabeçalho:** nome, "Segunda · Treino · 5 exercícios", setas "Mover para antes/depois" e a ordem atual;
   - **corpo:**
     - a partir de 900 px, em duas colunas: "Nome da sessão" e "Cardio (opcional)";
     - abaixo, "Dia da semana" e "Tipo" (`Escolha`) e a observação;
   - subtítulo `secao` "Exercícios (5)" e a lista;
   - **rodapé do cartão:**
     - à esquerda, "Adicionar exercício" (`secundario` com `Plus`);
     - à direita, "Salvar esta sessão como modelo" (`fantasma`) e "Remover sessão" (`perigoTexto`).
5. **Exercícios** (nível 3, em `CartaoExercicio`):
   - linha com número (ex.: "1"), nome em 16 seminegrito e resumo `suave` com o agrupamento já existente
     ("3x3 - FS · 1 WS");
   - aberto, mostra o editor de séries como hoje, dentro do mesmo item.

**Estado de seleção:**
- `useState<string | null>` com o uid da sessão; começa na primeira.
- Ao validar com erro, seleciona a primeira sessão com problema.
- Ao remover a selecionada, seleciona a vizinha.
- Ao desfazer, mantém a seleção se o uid ainda existir.

**Regras:**
- Não mexer em `usePlanoEditor`, `BarraDesfazer`, folhas de modelo/biblioteca nem na lógica de `comDesfazer`, `mover`
  e `remover`. É só reorganização visual.
- Testes:
  - função pura `sessaoSelecionadaDepois(sessoes, selecionada, acao)` em `dominio/editorTreino.ts`, cobrindo remover,
    desfazer e validar com erro;
  - função de resumo do chip, também com teste.

### H2.4 Editor de dieta (`treinador/dieta/EditorDeDieta.tsx`, `CartaoRefeicao.tsx`)

- **Mesmo topo** e mesma "Configuração do plano" recolhível (objetivo, início etc.).
- **Totais do dia** num cartão logo abaixo do topo (`TotaisAnimados`), sempre visível.
- **Refeições** continuam em lista, porque o treinador precisa ver o dia inteiro. Cada uma num `Cartao` com
  `CabecalhoDeGrupo`:
  - "07:00 · Café da manhã" + resumo "306 kcal · 3 itens";
  - **recolhidas por padrão**, com a recém-criada aberta e um botão "Abrir todas/Fechar todas" no topo da lista;
  - itens no nível 3.
- **"Modelos"** numa `Folha`, como no treino: usar modelo de refeição, usar modelo de dieta, salvar como modelo.
- **Orientações, Observações e Suplementação** dentro de um bloco "Complementos" com três `Cartao recolhivel`.
- Remoções com `perigoTexto`.

### H2.5 Ficha do aluno (`app/treinador/alunos/[id].tsx` e `treinador/Cartao*.tsx`)

- **A partir de 1.100 px:** duas colunas no topo, Dados (esquerda) e Acesso ao app + Lesões (direita). Abaixo, em
  largura cheia: Pastas, Registros e cargas, e Peso.
- **Pastas (`CartaoPastas`):**
  - cada pasta com `CabecalhoDeGrupo` (período, selo de status);
  - os planos (`CartaoPlanos`) em nível 3;
  - por pasta, um único `primario` ("Abrir" do plano ativo) e o resto `secundario`/`fantasma`.
- **"Inativar aluno"** vira `perigoTexto` no rodapé do cartão Dados.

### H2.6 Listas (alunos, biblioteca, receitas, planejamento, início)

- Linhas no nível 3 com altura mínima de 56 px, hover/pressionado `superficie3` e ações de ícone à direita (como já
  são).
- **Início do treinador:** os números (Alunos ativos etc.) em `destaque`; cartões com `bloco`.
- **Planejamento e receitas:** um `Cartao` por tipo de modelo, com `descricao`.

## 5. Parte H3: app do aluno (celular e web)

A H1 já muda o aluno inteiro. Conferir e ajustar estas telas no celular (390 px) e na web:

1. **Início (`app/aluno/index.tsx`):**
   - ordem: Cabeçalho (marca + selo) → cartão "Treino de hoje" (marca) → cartão "Sua semana" (o anel
     `ProgressoSemana`, num `Cartao` com título `bloco`) → "Divisões da semana" como título `bloco`, não `secao` →
     divisões;
   - 24 px entre os blocos.
2. **Sessão (`sessao/[uid]/index.tsx`):**
   - resumo em `Cartao` (data, "0 de 23 séries", barra);
   - "Começar treino" `cheio` e único `primario`;
   - exercícios em nível 3 com número.
3. **Exercício (`aluno/ExercicioAluno.tsx`):**
   - **cabeçalho do exercício:** nome, selos de sincronização e modalidade, e a linha "exercício 1 de 4";
   - **ações secundárias lado a lado,** cada uma com metade da largura e mínimo de 44 px: "Vídeo" e "Descanso". Hoje
     são dois botões cheios empilhados;
   - **orientação** do exercício em `Cartao` com a borda âmbar atual;
   - **carga de trabalho** em `Cartao` (campo grande no padrão `campo`);
   - **"Séries do plano":** cada série em nível 3. A série feita fica com borda `sucesso`, como hoje;
   - **tirar a linha "Carga sugerida: X kg"** embaixo da série: ela repete o valor que já está no campo. Quando o campo
     mostra a sugestão (sem registro e sem valor digitado), use a `ajuda` do campo: "Sugerida pelo plano".
4. **Dieta (`app/aluno/dieta.tsx`):**
   - totais do dia num cartão no topo;
   - cada refeição em `Cartao` com `CabecalhoDeGrupo` ("07:00 · Café da manhã", total em kcal à direita);
   - itens separados por divisor; ausente = "—".
5. **Histórico:** mesmo padrão (dia → `CabecalhoDeGrupo`, sessões em nível 3).
6. **Conta:** vira "Conta e preferências" (Parte P2).
7. **`BarraDescanso`:** fundo `superficie` com borda em cima `bordaCampo` (fica destacada do conteúdo). Os
   botões ±15 s são `secundario`.

Não mexer em: `AlunoProvider`, `RepositorioLocal`, sincronização, `BotaoMarcar` (só herda cores) e regras de
`podeRegistrarEm`.

## 6. Parte P: personalização (web e app)

São duas coisas diferentes. Não misturar:
- **P1, marca da consultoria:** o treinador escolhe uma vez, no servidor, e vale para todos os alunos dele.
- **P2, preferências pessoais:** cada pessoa escolhe para si, só naquele aparelho ou navegador, por usuário. Igual ao
  "Ajustes visuais" do Servirea.

### P0 Componente de opção em cartão (`ui/OpcaoCartao.tsx`, `ui/GradeDeOpcoes.tsx`, novos)

- `OpcaoCartao`: cartão nível 3 clicável com, à esquerda, uma "amostra" opcional (quadrado de 40 px com a cor ou uma
  letra), título 15 seminegrito e descrição `suave`.
  - Selecionado: borda 2 px na cor `texto` (não da marca, regra H1.7) e ícone `Check` à direita.
  - `accessibilityRole="radio"` com `accessibilityState.checked`.
- `GradeDeOpcoes`: grupo `radiogroup` com rótulo; 1 coluna abaixo de 700 px e 2 colunas acima; setas do teclado na web.

### P1 Marca da consultoria (`app/treinador/marca.tsx`, `treinador/marca/FormMarca.tsx`)

1. **Paletas prontas** (`dominio/paletas.ts`, novo).
   - Lista fixa com nome e descrição curtos. Todas já conferidas:
     - texto branco por cima com contraste ≥ 4,5;
     - contraste ≥ 3 contra os fundos novos dos dois temas, para ícone e menu ativo.

| id | Nome | Cor | Descrição |
|---|---|---|---|
| vermelho | Vermelho intenso | `#C62828` | Força e energia |
| laranja | Laranja | `#C2410C` | Calor e explosão |
| ambar | Âmbar | `#A16207` | Ouro e conquista |
| verde | Verde | `#15803D` | Saúde e equilíbrio |
| esmeralda | Esmeralda | `#047857` | Profundo e sóbrio |
| turquesa | Turquesa | `#0F766E` | Leve e moderno |
| ciano | Ciano | `#0E7490` | Água e foco |
| azul | Azul | `#2563EB` | Confiança |
| indigo | Índigo | `#4F46E5` | Concentração |
| roxo | Roxo | `#7C3AED` | Ousado |
| magenta | Magenta | `#BE185D` | Vibrante |
| bronze | Bronze | `#9A5B13` | Terroso, clássico |

   - Mostrar com `GradeDeOpcoes`/`OpcaoCartao` (amostra = quadrado na cor com a inicial em branco).
   - Último cartão: **"Cor personalizada"**, que abre o campo `#RRGGBB` atual.
   - A paleta é só um atalho: o servidor continua recebendo `corPrimaria` (hex), **sem mudança na API**. Ao abrir a
     tela, a paleta com o mesmo hex aparece selecionada; senão, "Cor personalizada".
2. **Aviso de contraste** para a cor personalizada.
   - Função `avaliarMarca(hex)` em `dominio/paletas.ts`, com teste. Ela devolve:
     - `bloqueia` quando o texto sobre a marca (`textoSobre`) tem contraste < 4,5. Nesse caso "Salvar marca" fica
       desabilitado e aparece a mensagem "Esta cor deixa o texto dos botões difícil de ler.";
     - `aviso` quando o contraste contra o fundo de um dos temas é < 3: "No tema escuro (ou claro), ícones e o menu
       ativo ficam apagados." Não bloqueia.
   - Teste: todas as paletas passam sem aviso.
3. **Fonte do nome:** de 2 para 4 opções, em `OpcaoCartao` com o **nome da consultoria escrito na própria fonte**.
   - **Opções:** Padrão (Inter), Metal (Metal Mania, já existe), **Esportiva** (Bebas Neue 400) e **Condensada**
     (Oswald 700).
   - **App:** `npx expo install @expo-google-fonts/bebas-neue @expo-google-fonts/oswald`, importando **por
     subcaminho**, só o peso usado (como já se faz com a Inter). Também:
     - carregar no `_layout.tsx`;
     - acrescentar a `fontes` em `tokens.ts` e ao `global.css` (o teste cobra);
     - ajustar `MarcaTitulo`.
   - **API:**
     - acrescentar `ESPORTIVA` e `CONDENSADA` ao `enum Fonte` (`Consultoria.java`);
     - migration nova **`V013__fontes_da_marca.sql`** trocando o `check` de `fonte_titulo` para
       `('PADRAO','METAL','ESPORTIVA','CONDENSADA')`;
     - total do `FlywayMigrationIntegrationTest` para **13**;
     - teste de integração: salvar a marca com cada fonte nova e ler de volta; valor desconhecido → 400.
   - **PDF:** conferir como o PDF trata `METAL` hoje (`pdf/`) e fazer igual para as novas. Se não der para embutir a
     fonte, usar Inter no PDF.
   - `tipos.ts`: `Fonte` com os 4 valores.
4. **Tema padrão dos alunos:** dois `OpcaoCartao` com uma **miniatura** do topo do app em cada tema. Reaproveitar a
   `Previa` em escala menor.
5. **A prévia do topo** continua no alto da tela e acompanha as escolhas na hora.
6. **Ordem da tela:**
   - Prévia;
   - Identidade (nome, lema, logo);
   - Cor;
   - Fonte do nome;
   - Tema padrão dos alunos;
   - rodapé com "Salvar marca" (único `primario`).

### P2 Preferências pessoais (Perfil do treinador e Conta do aluno; web e celular)

**Dados** (`dominio/preferencias.ts`, novo, com teste):

```ts
export interface Preferencias {
  tema: 'CONSULTORIA' | 'ESCURO' | 'CLARO' | 'SISTEMA';
  contraste: 'PADRAO' | 'ALTO';
  tamanhoTexto: 'PADRAO' | 'MEDIO' | 'GRANDE' | 'EXTRA'; // 1,00 · 1,12 · 1,25 · 1,40
  movimento: 'SISTEMA' | 'REDUZIDO';
  vibracao: boolean; // só aparece no celular
}
```

- `normalizarPreferencias(qualquer)`: valor desconhecido ou faltando → padrão. Padrão = `CONSULTORIA`, `PADRAO`,
  `PADRAO`, `SISTEMA`, `true`.
- `fatorDoTexto(tamanho)` e `coresComContraste(cores, contraste)`. No `ALTO`:
  - `borda` = `bordaCampo`;
  - `divisor` = `borda` antiga;
  - `textoSuave` mais forte (escuro `#C4C4CC`, claro `#3F3F46`).
  - Teste: contraste de `textoSuave` sobre todas as superfícies ≥ 7 no `ALTO`.
- **Guardar:** um JSON em `AsyncStorage` com a chave `treinos:<usuarioId>:preferencias`. Preferência visual não é dado
  sensível, mas fica separada por usuário, como o tema hoje.
- **Migrar a chave antiga do tema** do `TemaProvider`:
  - `ESCURO`/`CLARO` → `tema`;
  - ausente → `CONSULTORIA`;
  - apagar a antiga depois de gravar a nova.
- Não vai para a API nem para log.

**Onde aplicar:**
- **`TemaProvider`** (renomear o contexto para expor também as preferências, mantendo `useTema()` igual):
  - `SISTEMA` usa `useColorScheme()` do React Native;
  - `CONSULTORIA` usa o `temaPadrao` da marca;
  - as cores passam por `coresComContraste`;
  - o `Uniwind.updateCSSVariables` recebe as cores finais;
  - expor `escolherPreferencia(parcial)`, que grava e aplica na hora.
- **Tamanho do texto:**
  - o `Texto` multiplica `fontSize` e `lineHeight` pelo fator (arredondar).
  - os 34 usos de `fontSize` fixo em 25 arquivos (`grep -rn fontSize app/src --include=*.tsx`) passam a usar
    `ESTILOS_TEXTO` + `Texto` ou um `useEscalaTexto()` que aplica o fator. Prioridade: `Botao`, `Campo`, `Campos`,
    `Escolha`, `Abas`, `Selo`, `Navegacao` e `BotaoMarcar`;
  - para a escala do sistema e a do app não somarem demais, usar `maxFontSizeMultiplier={1.5}` no `Text` base;
  - alvos de toque continuam com no mínimo 44 px. Textos de botões e chips podem quebrar linha; nunca cortar.
- **Movimento:** `useMovimentoReduzido` devolve `true` se a preferência for `REDUZIDO`; senão, segue o sistema como
  hoje.
- **Vibração:**
  - `ui/vibrar.ts` ganha `definirVibracaoLigada(valor)`, chamado pelo provedor, e não vibra quando desligada;
  - teste em `vibrar.test.ts`;
  - na web, a opção nem aparece.

**Tela** (`ui/PainelConta.tsx`, que já é usado pelos dois). Título "Preferências", com a frase "Valem só neste aparelho
e para a sua conta". Cartões nesta ordem, cada um com título `bloco` e descrição:
1. **Tema:** `GradeDeOpcoes` com "Padrão da consultoria", "Escuro", "Claro" e "Igual ao aparelho". Cada uma com
   amostra (meio quadrado claro/escuro).
2. **Contraste das bordas:** `Escolha` Padrão / Alto, com a descrição "Deixa bordas de cartões, campos e divisões mais
   nítidas, e textos secundários mais fortes."
3. **Tamanho do texto:**
   - `GradeDeOpcoes` com 4 opções (Padrão, Médio, Grande, Extra), cada uma escrita no próprio tamanho;
   - abaixo, uma **prévia em tempo real**: um cartão-exemplo com o nome da consultoria, "Segunda - Costas", uma linha
     `suave` e um botão de mentira (sem ação, `accessibilityElementsHidden`).
4. **Animações:** `Escolha` "Igual ao aparelho" / "Reduzir".
5. **Vibração** (só no celular): `Interruptor` "Vibrar ao marcar série e no fim do descanso".
6. Botão `fantasma` "Restaurar padrão", com `PainelConfirmacao`.
7. Depois das preferências seguem as seções de hoje (senha, sair e, no aluno, sincronização).

**Fora de propósito:** não há cor pessoal. A cor é a marca do treinador, e o aluno vê a marca dele. Também não
aparece aqui nada que o app não faz (por exemplo, notificações).

## 6.1 Inventário: **todas** as telas (web e celular)

O padrão vale para o app inteiro. A H1 muda tudo sozinha, mas **cada tela abaixo precisa ser aberta, ajustada e
marcada** na verificação: um primário por área, títulos com `bloco`, faixas de grupo onde houver grupos, níveis certos
e largura certa. Nenhuma tela fica de fora. Folhas (`ui/Folha`) e painéis de confirmação também seguem o padrão:
título `bloco` e rodapé com Cancelar à esquerda e a ação principal à direita.

| # | Tela (rota) | Largura | O que conferir além da H1 |
|---|---|---|---|
| 1 | `/entrar` | 440 | Marca neutra, "Entrar" `cheio` e único primário, links com `LinkTexto` |
| 2 | `/cadastro` (treinador novo) | 640 | Campos com `rotulo`, um primário |
| 3 | `/convite` (aluno aceita) | 640 | Igual ao cadastro |
| 4 | `/treinador` (início) | lista | Números em `destaque`, cartões com `bloco`, "+ Novo aluno" único primário (H2.6) |
| 5 | `/treinador/alunos` | lista | Busca + linhas nível 3 + hover (H2.6), trilha |
| 6 | `/treinador/alunos/novo` | editor | Seções em `Cartao`, rodapé Cancelar/Salvar, trilha |
| 7 | `/treinador/alunos/[id]` (ficha) | lista | H2.5 (duas colunas, pastas com faixa, lesões, registros, peso) |
| 8 | `/treinador/treinos/[id]` | editor | H2.3 |
| 9 | `/treinador/dietas/[id]` | editor | H2.4 |
| 10 | `/treinador/planejamento` | lista | Um cartão por tipo de modelo, linhas nível 3, "Aplicar ao aluno" (H2.6) |
| 11 | `/treinador/planejamento/modelo/[id]` | editor | Mesmo editor de treino/dieta (H2.3/H2.4) com `TopoModelo` |
| 12 | `/treinador/biblioteca` (Exercícios, Alimentos, Catálogo, Importar CSV) | lista | Abas com sublinhado, linhas nível 3, "Tirar da biblioteca" com `perigoTexto`, créditos das fontes legíveis |
| 13 | `/treinador/receitas` | lista | Igual ao planejamento |
| 14 | `/treinador/marca` | editor | P1 |
| 15 | `/treinador/perfil` | editor | P2 + senha + sair |
| 16 | `/aluno` (início) | 720 | H3.1 |
| 17 | `/aluno/sessao/[uid]` | 720 | H3.2 |
| 18 | `/aluno/sessao/[uid]/[exercicio]` | 720 | H3.3 + `BarraDescanso` (H3.7) |
| 19 | `/aluno/dieta` | 720 | H3.4 |
| 20 | `/aluno/historico` | 720 | H3.5 |
| 21 | `/aluno/conta` | 720 | P2 + sincronização + senha + sair |
| 22 | Menu lateral (PC) e barra inferior (celular) | — | Item ativo com fundo `superficie2` + ícone da marca; rótulos legíveis no texto grande |
| 23 | Folhas: biblioteca, modelos, salvar modelo, metodologia, alimentos, descanso, aplicar ao aluno | — | Título `bloco`, rodapé padrão, campos `campo` |
| 24 | Estados: carregando (`Esqueleto`), vazio (`Vazio`), erro (`MensagemErro`), aviso (`useAviso`), sem conexão | — | Cores novas, um primário ("Tentar de novo") |

Se surgir uma tela nova que não está aqui (o código muda rápido), ela entra na mesma regra e na lista do relatório.

## 7. O que não fazer

- Não mexer em API de planos, sincronização, offline, segurança, CSP ou PDFs, fora o ajuste de fonte do P1.3.
- Não usar sombra nem gradiente, e não mudar o raio de 8 px nem os alvos de 44 px.
- Não usar a cor da marca para status nem para seleção (exceções: H1.7).
- Não instalar biblioteca de UI nova. Fontes novas só as duas do P1.3, com `npx expo install`.
- Não editar `V001`–`V012`: fonte nova = `V013`.
- Não apagar `backend/` nem `mobile/`.
- Não usar `alert()`, `confirm()` nem `Alert.alert`.
- Nenhum dado real em tela de exemplo, prévia ou teste.

## 8. AGENTS.md (atualizar junto, curto)

Trocar ou acrescentar em "App: convenções":
- **Níveis:** fundo → `Cartao` (superfície + borda) → faixa `CabecalhoDeGrupo` (`superficie2`) → item (`superficie2` +
  borda); campo = `campo` + `bordaCampo`. 24 px entre blocos. `Tela` respeita `largura` (`LARGURA_EDITOR` 1040,
  `LARGURA_LISTA` 1280).
- **Tipografia:** `titulo` 24/30, `bloco` (título de cartão), `rotulo` (campo); `secao` só subtítulo dentro de bloco.
- **Botões:** um `primario` por área; botão não estica sem `cheio`; destrutivo = `perigoTexto` + `PainelConfirmacao`.
- **Seleção** invertida (`texto`/`fundo`); a marca só em ação principal, menu/aba ativos, "Treino de hoje" e título.
- **Preferências pessoais** em `dominio/preferencias.ts` (AsyncStorage `treinos:<usuarioId>:preferencias`): tema
  (consultoria/escuro/claro/sistema), contraste, tamanho do texto, movimento e vibração. A marca da consultoria tem
  as paletas de `dominio/paletas.ts` e `avaliarMarca`. Fontes do nome: PADRAO, METAL, ESPORTIVA, CONDENSADA (V013).
- **Editor de treino:** uma sessão por vez (`SeletorDeSessoes`); modelos numa `Folha` "Modelos".

## 9. Verificação (obrigatória antes de pedir para juntar)

1. **App:** `cd app && npm run typecheck && npm run lint && npm test`. Depois `npx expo export --platform web` e
   `npx expo export --platform android` sem erro.
2. **API (por causa da V013):** `cd api && mvn verify` (testes, ArchUnit, JaCoCo ≥ 70%).
3. **Docker:** `docker compose up -d --build` e abrir `http://localhost:8088`.
4. **Tiradas de tela antes** (etiqueta `antes-hierarquia`) **e depois**, em 1280 e 390 px, tema escuro e claro:
   - **treinador:** editor de treino, editor de dieta, ficha do aluno, marca, perfil (preferências) e biblioteca;
   - **aluno:** início, sessão, exercício, dieta, histórico e conta (preferências).
   - O Playwright é opcional (pasta temporária fora de `app/`); se não houver, tirar à mão no navegador.
5. **Conferir na mão:**
   - [ ] No editor de treino dá para dizer, sem ler, onde estão o plano, a sessão e o exercício.
   - [ ] Só "Publicar" é vermelho no editor; dia e tipo selecionados aparecem invertidos.
   - [ ] Trocar de sessão pelos chips; validar com erro leva à sessão certa; remover e desfazer mantêm uma sessão
     selecionada.
   - [ ] "Modelos" abre a folha com as 3 opções e cada uma faz o que fazia antes.
   - [ ] O editor em 1280 px fica com no máximo 1040 px de conteúdo.
   - [ ] Paleta: escolher "Azul" e salvar faz o aluno ver azul; "Cor personalizada" com `#FFFF00` bloqueia o salvar
     com a mensagem; voltar para Vermelho intenso.
   - [ ] Fonte Esportiva e Condensada aparecem na prévia, no menu e no app do aluno.
   - [ ] Preferências: Tema "Igual ao aparelho" segue o sistema; Contraste Alto deixa bordas nítidas; Texto "Extra"
     não corta botão nem chip em 390 px; Animações "Reduzir" tira as animações; Vibração desligada não vibra (no
     celular).
   - [ ] Sair e entrar com outra conta: as preferências são as da outra conta.
   - [ ] O roteiro da demonstração do README continua funcionando do começo ao fim.
   - [ ] As 24 linhas do inventário (seção 6.1) foram abertas e conferidas nos dois temas, em 1280 e 390 px.
6. **No celular** (Expo Go): os itens 5 que dependem de aparelho (vibração, texto grande, movimento) e o fluxo de
   marcar séries offline.

**Relatório ao Gustavo:** a lista acima com ✅/❌, as tiradas de tela antes e depois e o que ficou de fora. Qualquer ❌
no roteiro da demonstração = não juntar na `main`.
