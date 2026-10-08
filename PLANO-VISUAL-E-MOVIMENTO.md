# Plano — visual e movimento do app (Reusables, micro-animações e acabamento)

Documento de trabalho para quem for implementar (pessoa ou agente de IA, por exemplo Sonnet 5.5). Escrito em
08/10/2026 e revisado no mesmo dia depois de uma revisão crítica (seção 8). Leia **inteiro** antes de começar e siga as
partes na ordem; cada fase termina com verificação e commit.

- Repositório: `GustavoToebe/Saraiva-api`, pasta `app/` (Expo SDK 57, Expo Router, React Native 0.86, Reanimated 4.5 +
  Worklets 0.10, Gesture Handler, react-native-svg, Inter + Metal Mania, **React Compiler ligado** em `app.json`
  → `experiments.reactCompiler`). Branch: `claude/saraiva-api-direcionamento-treinos-dv10io` (nunca commitar na `main`).
- Antes de tudo: `git pull` (o catálogo público já foi concluído e mexeu em `AbaCatalogo.tsx`, `AGENTS.md` e outros;
  partir do estado atual), ler `AGENTS.md` (seção "App: convenções") e a seção 10.3 do `PLANO-IMPLEMENTACAO.md`.
- Idioma de código, comentários, interface e commits: **português**.

---

## 0. Ordem, prazo e quem decide

Hoje é 08/10; a demonstração ao Saraiva é **domingo, 11/10, 16:30**. O Gustavo decidiu fazer a Parte B (React Native
Reusables) **antes** de domingo, sabendo do risco. Para isso caber sem pôr a demonstração em risco:

| Ordem | Parte | Limite | Regra |
|---|---|---|---|
| 1 | **A** — acabamento e 3 micro-animações | **sexta 09/10, 20h** | Prioridade absoluta. A B **só começa** depois da A pronta, verificada, enviada e com a etiqueta `demo-parte-a`. |
| 2 | **B1** — teste de compatibilidade da base de estilo | **3 horas de trabalho** a partir do início da B | Reprovou ou estourou o tempo → **para a B**, registra o motivo no README, avisa o Gustavo. Não tentar "só mais um ajuste". |
| 3 | **B2–B5** — tema e troca dos componentes | **até sábado 10/10, 18h** | Branch separada `visual/rnr`. |
| 4 | **C** — movimentos restantes | depois da demonstração | — |

**A e B nunca competem:** se a A atrasar, a B simplesmente não acontece antes de domingo.

**Sábado, 18h — decisão de juntar a B:**
- O Sonnet entrega ao Gustavo um relatório curto: cada item do B5 com ✅/❌ e o que falta.
- **Quem decide é o Gustavo.** Regra objetiva: **qualquer ❌ = não junta**. "Quase pronto" não junta. A `visual/rnr`
  fica enviada para continuar depois, e a demonstração sai da branch de trabalho (Parte A).
- Se o Gustavo não responder até domingo 10h, vale o padrão: **não junta**.

**Ponto seguro:** ao terminar a A, `git tag demo-parte-a && git push origin demo-parte-a`. Se qualquer coisa der errado
depois, a demonstração sai dessa etiqueta.

---

## 1. Princípios (valem para todas as partes)

1. **Animação com função, não enfeite.** Todo movimento responde a uma ação (feedback), mostra continuidade ou mudança
   de estado. Nada de animação decorativa em loop.
2. **Continua flat utilitário.** Cores sólidas, **sem sombra, sem gradiente, sem 3D**, cantos de 8 px, grade de 8 px.
3. **60 quadros por segundo.** Animar só `transform` e `opacity`; cor só com `interpolateColor`. Nunca animar
   largura/altura/margem. Animações na thread de UI (worklets).
4. **Curtas:** 150–300 ms; molas firmes. **A ação acontece na hora e a animação acompanha** (nunca esperar a animação
   para gravar, navegar ou responder ao toque).
5. **Reduzir movimento:** `useReducedMotion()` do Reanimated e `.reduceMotion(ReduceMotion.System)` nas entradas. Com
   movimento reduzido, troca instantânea; a vibração continua.
6. **Web, Android e iOS iguais.** Vibração (`expo-haptics`) só no celular; na web não chamar.
7. **Marca não diz status:** verde = feito/sincronizado; âmbar = pendente; vermelho = erro; cinza = inativo.
8. **Só bibliotecas que rodam no React Native.** Fora: Unlumen, Bklit, Aceternity, Magic UI, Motion/Framer Motion (web)
   e **Moti** (baseado no Reanimated 3, que não convive com o `react-native-worklets` do Reanimated 4).
9. Dependência nova só com `npx expo install <pacote>`. Depois: `npx expo install --check` e `npx expo-doctor`.

### 1.1 Reanimated com o React Compiler (obrigatório)

O React Compiler está ligado. Com ele, **não** se escreve `sv.value = x` nem se lê `sv.value` no corpo do componente:
o lint recusa a mutação e o compilador pode memoizar errado. Usar a API compatível do Reanimated 4:
- Leitura: `sv.get()`; escrita: `sv.set(x)` ou `sv.set(withSpring(1))` (também dentro de `useAnimatedStyle`,
  `useDerivedValue` e handlers de gesto).
- Não desestruturar shared values; não passá-los para `useMemo`/`useCallback` como se fossem estado.
- O plugin de worklets do Babel hoje é ligado **automaticamente** pelo `babel-preset-expo` (não há `babel.config.js`).
  Qualquer `babel.config.js` criado depois (Parte B) **tem de manter** `babel-preset-expo` como preset.

---

## 2. Estado atual (conferido no código em 08/10)

- Tema: `app/src/tema/tokens.ts` (ESCURO/CLARO, `espaco(n)`, `RAIO = 8`, `ALVO_TOQUE = 44`, fontes, `contraste()`),
  `tema/TemaProvider.tsx` (`useTema()`; tema claro/escuro por usuário; cor da marca).
- `ui/Texto.tsx`: variantes `titulo` 22/28 Bold, `subtitulo` 16/22 SemiBold, `corpo` 15/21, `suave` 14/20,
  `secao` 12/16 SemiBold caixa alta, `pequeno` 12/16. **Já são 5 tamanhos** (22, 16, 15, 14, 12): a escala fica como está.
- Outros `ui/`: `Botao`, `Cartao`, `Campo`/`CampoNumero`, `Campos` (`CampoData`, `CampoNumerico`, `CampoNumericoGrande`,
  `Interruptor`), `Selo` (**só texto**, cor por tipo), `Abas`, `Escolha`, `Folha`, `PainelConfirmacao`, `Estados`
  (`Carregando`, `Vazio`, `MensagemErro`), `BarraProgresso`, `Cabecalho`, `Navegacao`, `Tela`, `MarcaTitulo`,
  `IconeBotao`, `Aviso`.
- Aluno: `aluno/ExercicioAluno.tsx` (o ✓ de cada série é um `Pressable` que chama
  `aoRegistrar({..., concluida: !feita})`), `aluno/SeloSincronizacao.tsx` (devolve um `Selo` de texto conforme
  `falhas`, `online`, `envio`, `pendentes`; "Enviando…" só aparece quando há pendentes, então na prática o selo quase
  sempre vai direto de "N aguardando envio" para "Sincronizado").
- **Reanimated instalado mas nunca usado** (nenhum import em `app/src`). A Parte A é o primeiro uso.
- Sem `babel.config.js`/`metro.config.js`; sem NativeWind/Tailwind; sem `@testing-library/react-native`; **sem
  Playwright** no repositório. Jest com preset `jest-expo`. `node_modules/react-native-reanimated/mock.js` existe.
- `app/Dockerfile` roda `npm ci`: o `package-lock.json` precisa estar coerente com o `package.json`.

---

## 3. Parte A — até sexta 09/10, 20h

### A0. Prova pequena do Reanimated (antes de qualquer animação nas telas)

1. Criar `ui/BotaoMarcar.tsx` (seção A5) usando Reanimated com `sv.get()/sv.set()` (1.1).
2. Jest: arquivo de setup (`jest.setup.ts`, referenciado em `"setupFiles"` no `package.json`) com o mock do Reanimated
   conforme a documentação **da versão instalada** (o pacote traz `react-native-reanimated/mock`; conferir se a 4.5
   pede também algo do `react-native-worklets`). Um teste que importa `BotaoMarcar` precisa passar.
3. Verificar: `npm run typecheck && npm run lint && npm test`, `npx expo export --platform web` e `--platform android`.
4. Conferir que o React Compiler continua ativo: o bundle exportado da web contém o runtime do compilador (procurar
   `react/compiler-runtime` ou `useMemoCache` nos `.js` de `dist/`) **antes e depois** da mudança.
5. Pedir ao Gustavo para abrir no celular (Expo Go) e tocar no ✓: a animação roda e não trava.
Só depois disso seguir para A1–A7. Commit: "App: primeiro uso do Reanimated no botão de marcar série".

### A1. Números alinhados (tabular)

- Nova variante `numero` no `Texto` (mesmo tamanho do `corpo`, com `fontVariant: ['tabular-nums']`) e opção
  `numerico` nos campos de carga/repetições.
- Aplicar em: carga, repetições, metas ("3 a 6"), percentuais, totais da dieta, contadores do Início do treinador,
  cargas por divisão e o PDF de cargas (CSS `font-variant-numeric: tabular-nums`).
- Conferir na web e no Android (a Inter tem o recurso `tnum`).

### A2. Tipografia: só o que falta (sem mexer nos 69 usos de `suave`)

- A escala atual fica **como está** (seção 2). Nada de renomear ou mudar tamanho de variante existente.
- Acrescentar só a variante `destaque` (Inter Bold 28/34, tabular) para números de destaque: carga de trabalho do dia,
  total de alunos ativos no Início, kcal do dia. Usar em no máximo esses três lugares.
- Contraste título × detalhe: onde um título e um detalhe vizinhos estiverem com o mesmo tamanho e cor, trocar o detalhe
  para `suave`/`pequeno`. Só nas telas da A8.

### A3. Superfícies: estado pressionado, **mantendo as bordas**

- Os cartões **continuam com borda** nos dois temas. Sem borda, o cartão escuro (`#17171A` sobre `#0E0E10`, contraste
  ~1,1:1) praticamente some.
- Token novo `superficie3` (escuro `#27272C`, claro `#E7E7EA`) usado **só** como fundo de item/cartão pressionado ou
  selecionado (no lugar de opacidade).
- Cartão clicável continua indicando que é clicável pelo ícone de seta/ação, não só pela borda.
- Teste em `tema/tokens.test.ts`: `textoSuave` sobre `superficie3` com contraste ≥ 4,5 nos dois temas.

### A4. Estados vazios

- `Vazio` ganha `Icone` (lucide), `titulo`, `texto` e `acao` opcional; ícone 32 px em `textoSuave`. Props antigas
  continuam funcionando (compatível com os usos atuais).
- Trocar "Nenhum."/"Nada aqui" por frase com ação, nos lugares listados por `grep -rn "Vazio\|Nenhum" app/src`.
  Mínimo: alunos ("Cadastrar aluno"), planos do aluno ("Criar plano"), histórico do aluno, biblioteca, registros da ficha,
  cartões vazios do Início, dieta do aluno ("Seu treinador ainda não publicou a dieta").

### A5. Marcar série ✓ (mola + cor + vibração)

- `ui/BotaoMarcar.tsx` (props `feito`, `aoTocar`, `ultimaDoExercicio`, `rotulo`). Substitui o `Pressable` do ✓ em
  `ExercicioAluno`.
- **Ordem no toque, separada numa função pura testável** (`ui/marcar.ts`, `aoPressionarMarcar({aoTocar, animar,
  vibrar})`): chama `aoTocar()` **primeiro e sem `await`**, depois dispara `animar()` e `vibrar()`. Teste unitário:
  `aoTocar` é chamado antes de `animar`, e uma `animar` que nunca termina não impede `aoTocar`.
- Animação: escala `1 → 0.88 → 1` (`withSequence(withTiming(0.88, {duration: 80}), withSpring(1, {damping: 14,
  stiffness: 260}))`); fundo da linha da série de `superficie` para verde translúcido (`sucesso` ~16%) em 200 ms com
  `interpolateColor`; ícone ✓ entra com `FadeIn`. Desmarcar: volta em 150 ms, sem vibração.
- Vibração (só celular), em `ui/vibrar.ts` (não faz nada na web): `vibrar.leve()` =
  `Haptics.impactAsync(ImpactFeedbackStyle.Light)` ao marcar; `vibrar.sucesso()` =
  `Haptics.notificationAsync(NotificationFeedbackType.Success)` quando é a última série do exercício. Instalar com
  `npx expo install expo-haptics`. Teste: na web, `vibrar` não chama o módulo.

### A6. Listas em cascata

- `ui/EntradaEmCascata.tsx` (wrapper com `Animated.View`): `entering={FadeInDown.delay(min(i, 8) * 30).duration(220)}`,
  sem atraso do 9º item em diante, sem `entering` com movimento reduzido.
- **Só na primeira montagem da lista** (não ao filtrar, nem ao voltar de outra tela): `useRef` por tela.
- Aplicar em: exercícios da sessão, divisões da semana do aluno, lista de alunos, planos da ficha.

### A7. Selo de sincronização animado (o que o selo realmente tem)

O selo é só texto colorido; não inventar ícone nem ponto. Fazer:
- **Troca de estado suave:** quando muda o texto/tipo (ex.: "2 aguardando envio" → "Sincronizado"), o selo antigo sai
  com `FadeOut` (120 ms) e o novo entra com `FadeIn` (180 ms) — `Animated.View` com `key` = estado.
- **Pulso enquanto envia:** se `envio === 'enviando'` (com ou sem pendentes visíveis), o selo inteiro pulsa a opacidade
  1 ↔ 0.55 (700 ms, `withRepeat`); para ao sair desse estado. Como o envio costuma ser rápido, o pulso pode durar
  menos de um segundo: tudo bem, **não segurar o estado artificialmente**.
- Ao chegar em "Sincronizado", leve escala 0.94 → 1 com mola (sem vibração).

### A8. Verificação da Parte A

- `npm run typecheck && npm run lint && npm test`; `npx expo export --platform web` e `--platform android`; React Compiler
  ativo (A0, passo 4).
- **Prints (opcional, fora do repositório):** se o ambiente permitir, instalar o Playwright numa pasta temporária **fora**
  de `app/` (nunca como dependência do projeto) e tirar prints da web exportada (Início do treinador, ficha do aluno,
  treino do aluno, exercício do dia, dieta) nos dois temas, em 390 px e 1280 px. Se não der, pular e pedir ao Gustavo.
- **Gustavo no celular (Expo Go)**: marcar séries (mola, verde, vibração; última série vibra diferente), modo avião e
  volta (selo troca suave), listas em cascata, estados vazios (aluno novo sem plano).
- Commits: "App: números alinhados, destaque e estado pressionado", "App: estados vazios com ação",
  "App: marcar série com mola e vibração", "App: listas em cascata e selo de sincronização animado".
- Ao fim: `git tag demo-parte-a && git push origin demo-parte-a`.

---

## 4. Parte B — React Native Reusables (só depois da etiqueta `demo-parte-a`; prazos da seção 0)

React Native Reusables (RNR, `founded-labs/react-native-reusables`, documentação em reactnativereusables.com) é o
shadcn/ui para React Native: componentes **copiados para dentro do repositório**, sobre **RN Primitives**
(acessibilidade) e estilizados com **NativeWind** ou **Uniwind** (Tailwind no React Native).

### B1. Teste de compatibilidade (no máximo 3 horas)

Situação em 08/10/2026: NativeWind **v4** é a estável (`latest`, Tailwind **3**); NativeWind **v5** é release candidate
(feita para Expo 57 / RN 0.86.3 / React 19.2.3 / Reanimated 4.5.1 / Worklets 0.10.1; Tailwind **4**); **Uniwind** usa
Tailwind **4** e **não precisa de preset do Babel**; o RNR suporta NativeWind e Uniwind. Tailwind 3 e 4 são
incompatíveis entre si: escolher **uma** base e não misturar.

1. `git checkout -b visual/rnr` a partir da etiqueta `demo-parte-a`.
2. Conferir no npm e na documentação do RNR qual base ele recomenda **hoje** para Expo 57 (`npm view nativewind
   dist-tags`, `npm view uniwind dist-tags`).
3. Ordem de tentativa: (a) a base **estável** recomendada pelo RNR que **não exija mexer no Babel** (Uniwind, se
   estável); (b) NativeWind estável, se suportar Reanimated 4 + RN 0.86; (c) NativeWind v5 RC fixado na versão exata,
   só se (a) e (b) falharem, com o risco anotado no README.
4. Instalação manual do RNR para projeto existente (o `init` do CLI é para projeto novo): `global.css`, configuração do
   Tailwind, `metro.config.js` **estendendo `getDefaultConfig` de `expo/metro-config`**, `babel.config.js` **só se a base
   exigir** e sempre com `babel-preset-expo`, tipos (`*-env.d.ts`), `PortalHost` na raiz (`app/src/app/_layout.tsx`).
5. Adicionar **um** componente (`Button`) com o CLI `@react-native-reusables/cli` e usá-lo numa tela.
6. **Critério de aprovação — todos:**
   - `typecheck`, `lint`, `test`, export web e Android passam;
   - React Compiler **continua ativo** (mesma checagem da A0, passo 4) e as animações da A continuam rodando
     (o plugin de worklets segue ligado);
   - `package-lock.json` coerente: `rm -rf node_modules && npm ci` numa cópia limpa funciona; o Gustavo roda
     `docker compose up -d --build` no PC e a web abre (o build do `app/Dockerfile` usa `npm ci`);
   - a web exportada roda atrás do Caddy com a CSP atual (`style-src 'self' 'unsafe-inline'`), sem erro no console;
   - o Expo Go abre no celular do Gustavo;
   - tema claro/escuro e a cor da marca mudam em tempo de execução (B2).
   Qualquer item falhou, ou passaram 3 horas: registrar o motivo no README, **parar a Parte B** e avisar o Gustavo.

### B2. Tema: tokens continuam a fonte da verdade

- Variáveis CSS do RNR a partir dos tokens: `--background` ← fundo, `--foreground` ← texto, `--card` ← superficie,
  `--muted` ← superficie2, `--accent` ← superficie3, `--muted-foreground` ← textoSuave, `--border`/`--input` ← borda,
  `--primary` ← **cor da marca**, `--primary-foreground` ← `textoSobre(marca)`, `--destructive` ← perigo,
  `--radius` ← 8 px. Status próprios: `--sucesso`, `--atencao`, `--perigo`, `--neutro` (status **nunca** usa `--primary`).
- **Marca em tempo de execução** (white label): `--primary`/`--primary-foreground` definidos no `TemaProvider` a partir
  de `consultoria.corPrimaria` (`vars()` no NativeWind v4, `VariableContextProvider` na v5, `updateCSSVariables` no
  Uniwind). Claro/escuro pela classe `dark` controlada pelo `TemaProvider` (escolha do usuário).
- `global.css` tem os valores padrão (marca neutra `#52525B`). Teste Jest: os valores do `global.css` batem com
  `tokens.ts`. Mudou um, muda o outro.
- Fontes no `fontFamily` da configuração do Tailwind com os mesmos nomes de `tokens.fontes`.

### B3. Ajustes obrigatórios nos componentes do RNR

Remover sombras (`shadow-*`) e gradientes; cantos 8 px; alvo de toque ≥ 44 px (`min-h-11`); foco visível na web; textos
em português; nada de `Alert`; overlays via `PortalHost`; animações curtas e com movimento reduzido.

### B4. Migração gradual (padrão "estrangulador")

Trocar **por dentro** os componentes de `app/src/ui/`, mantendo as **mesmas props** (as telas não mudam):

| Ordem | Nosso componente | Base RNR |
|---|---|---|
| 1 | `Botao` | Button |
| 2 | `Cartao` | Card (com borda, A3) |
| 3 | `Selo` | Badge (cores de status, não as do shadcn) |
| 4 | `Campo`, `CampoNumero` | Input + Label |
| 5 | `Interruptor` | Switch |
| 6 | `Abas` | Tabs |
| 7 | `PainelConfirmacao` | AlertDialog |
| 8 | `Escolha` | Select ou ToggleGroup |
| 9 | `Texto` | Text (mesmas variantes) |
| — | `Folha` | continua própria (Parte C, C5) |

Uma troca por commit, com typecheck/lint/test/exports. A ordem vai do mais visível e simples ao mais arriscado: **se o
sábado 18h chegar no meio da tabela, o que estiver feito e verificado pode ser juntado** desde que o B5 passe para os
componentes já trocados (os demais seguem como estão; nenhum componente pela metade).

### B5. Pronto para juntar (relatório ✅/❌ ao Gustavo no sábado 18h)

1. B1 aprovado (todos os itens).
2. Componentes trocados sem mudar comportamento de nenhuma tela; typecheck, lint, test, exports e CSP ok.
3. React Compiler ativo e animações da A funcionando.
4. Marca e tema mudam em tempo de execução, nas duas consultorias da demonstração.
5. **Roteiro da demonstração do `README.md` ensaiado do zero** (`docker compose down -v && docker compose up -d
   --build`) pelo Gustavo, na web (dois temas, duas consultorias) e no celular pelo Expo Go.
6. `AGENTS.md` atualizado: base de estilo escolhida, onde ficam os componentes do RNR, "tokens.ts é a fonte;
   global.css espelha", regra do React Compiler com Reanimated (1.1).

Qualquer ❌ → não junta (seção 0).

---

## 5. Parte C — movimentos restantes (depois da demonstração)

Todas as animações seguem a seção 1.1 (`sv.get()`/`sv.set()` com o React Compiler).

### C1. Cronômetro de descanso (funcionalidade nova)

- Depois de marcar uma série que tem `descansoSegundos` no plano, abre automaticamente uma barra/folha fixa embaixo
  com **anel que esvazia** (círculo do `react-native-svg`, `strokeDashoffset` animado pelo Reanimated), tempo restante
  em `destaque` tabular, botões **−15 s**, **+15 s** e **Pular**.
- Série sem `descansoSegundos`: **não** abre sozinho (não inventar descanso). Um botão "Descanso" na tela do exercício
  permite iniciar manualmente com 60, 90, 120 ou 180 s.
- O tempo é guardado como **instante de término** (`Date.now() + ms`), no `AlunoProvider`: sobrevive a trocar de tela e
  a ir para segundo plano; ao voltar, mostra o que falta (ou "Descanso terminado").
- Fim: vibração `Haptics.notificationAsync(Success)` se o app estiver aberto. Notificação com o app fechado
  (`expo-notifications`) fica **fora** desta parte.
- Função pura `dominio/descanso.ts` (restante, terminado, ajuste ±15 s com mínimo 0) com testes.

### C2. "Treino de hoje" → tela da sessão

- Tentar `sharedTransitionTag` do Reanimated **só se** a documentação da versão instalada o marcar como suportado com
  Expo Router (em várias versões é experimental). Se não: cartão com escala 0.98 ao pressionar e a tela da sessão com
  o cabeçalho entrando por `FadeInUp` + o primeiro cartão crescendo de 0.96 para 1 (sensação de continuidade sem API
  experimental).

### C3. Números que rolam

- Hook `ui/useNumeroAnimado(valor, {duracao: 300})`: conta do valor anterior até o novo com `requestAnimationFrame`
  (funciona igual em web e celular), respeitando casas decimais e `tabular-nums`. Usar na carga sugerida, no total de
  kcal/macros da dieta (aluno e editor) e nos números do Início do treinador. Movimento reduzido → valor final direto.
- Testes da função de interpolação (passo, arredondamento, valores nulos mostram "—" sem animar).

### C4. Esqueleto no carregamento

- `ui/Esqueleto.tsx`: blocos com o formato do conteúdo (linhas, cartões) em `superficie2`, **pulsando** opacidade
  0.5 ↔ 1 (900 ms). **Sem gradiente "shimmer"** (o design é flat). Usar no lugar de `Carregando` nas listas e cartões;
  `Carregando` continua para ações curtas.

### C5. Folha inferior com mola e arraste

- `ui/Folha.tsx`: abre com `withSpring` (damping ~18); no celular, fecha arrastando para baixo (`Gesture.Pan` do Gesture
  Handler: passou de 30% da altura ou velocidade alta → fecha; senão volta com mola). Na web: continua fechando com Esc
  e clique fora. Foco e leitor de tela preservados. Avaliar `@gorhom/bottom-sheet` só se a versão instalada declarar
  suporte ao Reanimated 4 e passar no teste no celular; senão, implementação própria.

### C6. Anel de progresso da semana (aluno)

- No topo de `app/aluno/index.tsx`: anel "**3 de 5 treinos**" da semana corrente (segunda a domingo).
- Regra (função pura `dominio/progressoSemana.ts`, com testes): total = sessões do plano ativo com `tipo = TREINO` e
  `diaSemana` na semana (dentro do período do plano); feitas = dessas, as que têm pelo menos uma série `concluida` na
  data correspondente (registros locais + histórico). Descanso e acessórios não contam. Sem plano → anel não aparece.
- Anel em `sucesso` (status), trilho em `superficie2`; ao abrir a tela, preenche do zero até o valor (400 ms).

### C7. Verificação da Parte C

Mesma da A8, mais: cronômetro sobrevive a trocar de tela e a pôr o app em segundo plano (testar no celular);
esqueleto aparece com rede lenta (na web, ferramentas do navegador com rede lenta); anel bate com a regra em 3 casos de teste.

---

## 6. Fora do escopo

Lottie/Rive, gráficos novos (progresso de carga com biblioteca de gráficos), notificações push/locais, sons, temas
além de claro/escuro, ilustrações, mudanças de layout das telas além do descrito, mudanças na API.

## 7. Referências (para consulta, não para copiar código de web)

- 60fps.design (vídeos de animações de apps reais) — inspiração de movimento.
- Mobbin (telas de apps de treino: Hevy, Strong, Fitbod) — inspiração de layout.
- "Can it be done in React Native" (William Candillon) — animações recriadas em Reanimated, com código.
- Documentação do Reanimated 4 (layout animations, `useReducedMotion`, compatibilidade), Gesture Handler e expo-haptics
  da versão instalada.
- React Native Reusables (reactnativereusables.com) e a documentação da base de estilo escolhida na B1.

## 8. Revisão de 08/10 (o que mudou nesta versão e por quê)

| # | Apontamento | Como ficou |
|---|---|---|
| 1 | B antes de domingo é o maior risco; A e B podem competir | Prazos e ordem na seção 0: A até sexta 20h com prioridade absoluta; B1 com limite de 3 h; B só depois da etiqueta |
| 2 | B muda a base de build (Babel/Metro, Tailwind 3 × 4, `npm ci`) | B1 passo 3–6: preferir base sem Babel; manter `babel-preset-expo` e `getDefaultConfig`; checar React Compiler e worklets; `npm ci` limpo e `docker compose` no PC |
| 3 | Reanimated nunca usado; sem setup do Jest | A0: prova pequena com mock do Jest antes de espalhar animação |
| 4 | React Compiler exige `sv.get()/sv.set()` | Seção 1.1 |
| 5 | A7 descrevia ícone/ponto que o selo não tem; "Enviando…" raro | A7 reescrita: troca suave do selo de texto e pulso só durante o envio, sem segurar estado |
| 6 | Playwright não existe no projeto | A8: prints opcionais, Playwright só em pasta temporária fora do `app/` |
| 7 | A2 mexia em 69 usos de `suave` | A escala atual já tem 5 tamanhos e fica; só entra `destaque` em 3 lugares |
| 8 | Cartão sem borda some no escuro (~1,1:1) | A3: bordas mantidas; `superficie3` só para estado pressionado |
| 9 | Plano não sabia que o catálogo terminou | Cabeçalho: `git pull` e partir do estado atual |
| 10 | "Ação na hora" sem teste | A5: função pura `aoPressionarMarcar` com teste de ordem |
| 11 | Quem decide no sábado 18h | Seção 0: o Gustavo, com relatório ✅/❌; qualquer ❌ não junta; sem resposta até domingo 10h = não junta |

