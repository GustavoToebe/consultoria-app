# Plano — visual e movimento do app (Reusables, micro-animações e acabamento)

Documento de trabalho para quem for implementar (pessoa ou agente de IA, por exemplo Sonnet 5.5). Escrito em
08/10/2026. Leia **inteiro** antes de começar e siga as partes na ordem; cada fase termina com verificação e commit.

- Repositório: `GustavoToebe/Saraiva-api`, pasta `app/` (Expo SDK 57, Expo Router, React Native 0.86, Reanimated 4.5,
  Gesture Handler, react-native-svg, Inter + Metal Mania). Branch: `claude/saraiva-api-direcionamento-treinos-dv10io`
  (nunca commitar na `main`).
- Antes de tudo: ler `AGENTS.md` (regras do projeto; seção "App: convenções") e a seção 10.3 do
  `PLANO-IMPLEMENTACAO.md` (design flat utilitário).
- Idioma de código, comentários, interface e commits: **português**.

---

## 0. O que muda e em que ordem

| Parte | Quando | O quê | Risco |
|---|---|---|---|
| **A** | **Antes da demonstração de domingo (11/10)** | Acabamento visual sem trocar a base de estilo + 3 micro-animações (marcar série, lista em cascata, selo de sincronização) + vibração | Baixo |
| **B** | **Depois da demonstração** | Teste de compatibilidade e adoção do **React Native Reusables** (shadcn/ui para React Native) com NativeWind, de forma gradual | Médio |
| **C** | Depois da B | Movimentos restantes: cronômetro de descanso, transição do "Treino de hoje", números que rolam, esqueleto, folha com arraste, anel da semana | Médio |

**Regra de ouro: nada da Parte B entra na branch antes da demonstração.** Trocar a base de estilo do app inteiro
dois dias antes de mostrar ao Saraiva é o tipo de risco que não compensa. A Parte A já dá a cara "fluida" que se quer.

---

## 1. Princípios (valem para todas as partes)

1. **Animação com função, não enfeite.** Todo movimento responde a uma ação (feedback), mostra continuidade
   (de onde veio, para onde foi) ou mudança de estado. Nada de animação decorativa em loop.
2. **Continua flat utilitário.** Cores sólidas, **sem sombra, sem gradiente, sem 3D**, cantos de 8 px, grade de 8 px.
   O "fluido" vem do movimento, não de efeito visual.
3. **60 quadros por segundo.** Animar só `transform` (escala, posição) e `opacity`; cor só com `interpolateColor` do
   Reanimated. Nunca animar largura/altura/margem de lista inteira. Animações rodam na thread de UI (worklets).
4. **Curtas:** 150–300 ms; molas firmes (sem quicar várias vezes). Nada atrasa o toque: a ação acontece na hora,
   a animação acompanha.
5. **Reduzir movimento:** respeitar a opção do sistema. Reanimated: `useReducedMotion()` e
   `.reduceMotion(ReduceMotion.System)` nas animações de entrada. Com movimento reduzido, troca de estado instantânea
   (sem mola, sem cascata, sem número rolando); a vibração continua.
6. **Web, Android e iOS iguais.** Reanimated roda nas três. Vibração (`expo-haptics`) só no celular: na web não chamar.
7. **Marca não diz status** (regra do ecossistema): verde = feito/sincronizado; âmbar = pendente; vermelho = erro;
   cinza = inativo. A cor da marca só em ação principal, menu ativo e título da marca.
8. **Nada de dependência que não rode no React Native.** Unlumen, Bklit, Aceternity, Magic UI, Framer Motion/Motion
   (web) estão fora. **Moti também está fora**: é baseado no Reanimated 3, que não convive com o
   `react-native-worklets` que o Reanimated 4 exige.
9. Dependência nova só com `npx expo install <pacote>` (versão compatível com o SDK 57). Depois:
   `npx expo install --check` e `npx expo-doctor`.

---

## 2. Estado atual (para não reinventar)

- Tema: `app/src/tema/tokens.ts` (cores ESCURO/CLARO, `espaco(n)`, `RAIO = 8`, `ALVO_TOQUE = 44`, fontes Inter e Metal
  Mania, `contraste()`), `tema/TemaProvider.tsx` (`useTema()` → `cores`, marca, tema claro/escuro por usuário).
- Componentes: `app/src/ui/` — `Texto` (variantes titulo, subtitulo, corpo, suave, secao, pequeno), `Botao`, `Cartao`,
  `Campo`/`CampoNumero`, `Campos` (`CampoData`, `CampoNumerico`, `CampoNumericoGrande`, `Interruptor`), `Selo`, `Abas`,
  `Escolha`, `Folha`, `PainelConfirmacao`, `Estados` (`Carregando`, `Vazio`, `MensagemErro`), `BarraProgresso`,
  `Cabecalho`, `Navegacao`, `Tela`, `MarcaTitulo`, `IconeBotao`, `Aviso` (`useAviso()`).
- Aluno: `app/src/aluno/` — `CartaoHoje`, `CartaoDivisao`, `CartaoExercicioDoDia`, `ExercicioAluno` (o botão ✓ de cada
  série é um `Pressable` que chama `aoRegistrar({... concluida: !feita})`), `SeloSincronizacao`, `useSessaoDoDia`.
  Rotas em `app/src/app/aluno/` (`index`, `sessao/[uid]/index`, `sessao/[uid]/[exercicio]`, `dieta`, `historico`, `conta`).
- Offline: `offline/AlunoProvider` expõe `envio` (`ocioso | enviando | semConexao | erro`), `pendentes`, `online`.
- `ConteudoTreino` já tem `descansoSegundos` por série (pode ser `null`).
- Sem NativeWind/Tailwind hoje: estilo por `StyleSheet` + tokens. Sem `babel.config.js`/`metro.config.js` próprios.
- Verificar sempre: `cd app && npm run typecheck && npm run lint && npm test`; bundle nativo
  `npx expo export --platform android`; web `npx expo export --platform web`.

---

## 3. Parte A — antes de domingo

### A1. Números alinhados (tabular)

- Nova variante `numero` no `Texto` (e opção `numerico` nos campos de carga/repetições): `fontVariant: ['tabular-nums']`.
- Aplicar em: carga, repetições, metas ("3 a 6"), percentuais, datas curtas, totais da dieta, contadores do início
  do treinador, cargas por divisão e o PDF de cargas (CSS `font-variant-numeric: tabular-nums`).
- Conferir na web e no Android (a Inter tem o recurso `tnum`).

### A2. Escala tipográfica fixa

Substituir as variantes do `Texto` por **5 tamanhos** (o resto é cor ou peso):

| Variante | Fonte | Tamanho / altura | Uso |
|---|---|---|---|
| `destaque` | Inter Bold | 28 / 34 | número grande (carga do dia, total de alunos, kcal do dia) |
| `titulo` | Inter Bold | 22 / 28 | título de tela |
| `subtitulo` | Inter SemiBold | 17 / 22 | título de cartão, nome do exercício |
| `corpo` | Inter Regular | 15 / 21 | texto e campos |
| `pequeno` | Inter Regular | 12 / 16 | detalhe, legenda; `secao` = pequeno SemiBold caixa alta, espaçamento 0.6 |

- `suave` deixa de ser tamanho: vira `cor="suave"` (ou prop `suave`) sobre `corpo`/`pequeno`. Atualizar os usos
  (`grep -rn "variante=\"suave\"" app/src`).
- Mais contraste entre título e detalhe: título em `texto`, detalhe em `textoSuave`, nunca dois textos vizinhos do
  mesmo tamanho e cor.

### A3. Profundidade por superfície (sem borda em tudo)

- Tokens novos em `tokens.ts`: `superficie3` (estado pressionado/selecionado) e `divisor` (linha fina dentro de
  cartão). Valores iniciais:
  - Escuro: `fundo #0E0E10`, `superficie #17171A`, `superficie2 #1F1F23`, `superficie3 #27272C`, `divisor #2A2A2F`.
  - Claro: `fundo #F4F4F5`, `superficie #FFFFFF`, `superficie2 #F0F0F2`, `superficie3 #E7E7EA`, `divisor #E4E4E7`.
- **Tema escuro**: `Cartao` sem borda (a diferença de tom separa); borda só em campo de texto, botão secundário e
  divisor interno. **Tema claro**: mantém borda fina (fundo branco sobre cinza claro precisa).
- Pressionar item de lista/cartão: fundo vai para `superficie3` (em vez de opacidade).
- Teste em `tema/tokens.test.ts`: `textoSuave` sobre `superficie2` e `superficie3` com contraste ≥ 4,5 (AA), nos
  dois temas.

### A4. Estados vazios

- `Vazio` ganha `Icone` (lucide), `titulo` e `texto` + `acao` opcional, centralizado, ícone 32 px em `textoSuave`.
- Trocar todo "Nenhum."/"Nada aqui" por frase com ação. Mínimo: alunos ("Nenhum aluno ainda" → "Cadastrar aluno"),
  planos do aluno ("Sem plano de treino" → "Criar plano"), histórico do aluno ("Os treinos registrados aparecem aqui"),
  biblioteca, registros da ficha, início do treinador (cartões vazios), dieta do aluno ("Seu treinador ainda não
  publicou a dieta"). Listar os lugares com `grep -rn "Vazio\|Nenhum" app/src`.

### A5. Marcar série ✓ (mola + cor + vibração)

No botão ✓ de `ExercicioAluno`:
- Ao tocar: a ação (`aoRegistrar`) roda **na hora**; em paralelo, escala do botão `1 → 0.88 → 1` com
  `withSequence(withTiming(0.88, {duration: 80}), withSpring(1, {damping: 14, stiffness: 260}))`.
- Fundo da linha da série: `interpolateColor` de `superficie` para um verde translúcido (`sucesso` com ~16% de opacidade)
  em 200 ms; o ícone ✓ entra com `FadeIn` + escala 0.6 → 1.
- Desmarcar: volta em 150 ms, sem vibração.
- Vibração (só celular): `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` ao marcar;
  `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` quando a **última** série do exercício é marcada.
  Instalar com `npx expo install expo-haptics`. Envolver num `ui/vibrar.ts` (`vibrar.leve()`, `vibrar.sucesso()`) que
  não faz nada na web.
- Componente reutilizável `ui/BotaoMarcar.tsx` (props `feito`, `aoTocar`, `rotulo` de acessibilidade).

### A6. Listas em cascata

- Itens das listas principais entram com `entering={FadeInDown.delay(min(i, 8) * 30).duration(220)}`: exercícios da
  sessão, divisões da semana, alunos, planos da ficha, registros. **Só na primeira montagem da lista** (não ao filtrar
  nem ao voltar de outra tela): guardar "já animou" num `useRef` por tela.
- Até 8 itens com atraso; do 9º em diante, sem atraso (lista longa não pode demorar).
- Com movimento reduzido: sem `entering`.
- Usar `Animated.View` do Reanimated como wrapper (`ui/EntradaEmCascata.tsx`), sem mexer na lógica das listas.

### A7. Selo de sincronização animado

`aluno/SeloSincronizacao.tsx`:
- `enviando`: o ponto/ícone do selo pulsa (opacidade 1 ↔ 0.4, 700 ms, `withRepeat`), texto "Enviando…".
- Ao virar `Sincronizado`: cor e texto trocam com transição de 200 ms (`interpolateColor` + `FadeIn` no texto) e o
  ícone ✓ dá a mesma mola do A5 (sem vibração).
- `semConexao` (cinza) e `erro` (vermelho): sem pulso; texto atual do componente se mantém.

### A8. Verificação da Parte A

- `npm run typecheck && npm run lint && npm test`, `npx expo export --platform android` e `--platform web`.
- Testes de unidade: variantes do `Texto` (estilos esperados), `vibrar` não chama nada na web, contraste dos tokens novos.
- Conferência visual na web com Playwright (já usado no projeto para prints): telas Início do treinador, ficha do
  aluno, treino do aluno, exercício do dia, dieta, nos **dois temas**, em 390 px e 1280 px de largura. Anexar os prints
  na descrição do commit ou numa pasta temporária fora do git.
- Pedir ao Gustavo para testar no celular (Expo Go): marcar séries (vibração e mola), modo avião (selo).
- Commits: "App: tipografia, números alinhados e superfícies", "App: estados vazios com ação",
  "App: marcar série com mola e vibração, listas em cascata e selo animado".

---

## 4. Parte B — React Native Reusables (depois da demonstração)

React Native Reusables (RNR, `founded-labs/react-native-reusables`, documentação em reactnativereusables.com) é o
shadcn/ui para React Native: componentes **copiados para dentro do repositório** (não é dependência fechada), sobre
**RN Primitives** (acessibilidade) e estilizados com **NativeWind** ou **Uniwind** (Tailwind no React Native).

### B1. Teste de compatibilidade (obrigatório, numa branch temporária)

A base de estilo está em transição (verificado em 08/10/2026): NativeWind **v4** é a estável (`latest` no npm, com
Tailwind 3); NativeWind **v5** está em release candidate, feita para exatamente o nosso conjunto (Expo 57, RN 0.86.3,
React 19.2.3, Reanimated 4.5.1, Worklets 0.10.1) e exige Tailwind 4; **Uniwind** (Tailwind 4, sem preset do Babel)
também é suportado pelo RNR. Não presumir: testar.

1. Criar branch temporária `teste/rnr-nativewind` a partir da branch de trabalho.
2. Conferir no npm e na documentação do RNR qual base ele recomenda **hoje** para Expo 57 e qual a versão estável de
   cada uma (`npm view nativewind dist-tags`, `npm view uniwind dist-tags`).
3. Ordem de tentativa: (a) **NativeWind estável** (se suportar Reanimated 4 + RN 0.86); (b) **Uniwind** estável;
   (c) **NativeWind v5 RC** fixado na versão exata, só se (a) e (b) falharem, e anotar o risco no README.
4. Instalar seguindo a **instalação manual** do RNR para projeto existente (o `init` do CLI é para projeto novo):
   `global.css`, `tailwind.config.js` (ou `@theme` no Tailwind 4), `metro.config.js` com o plugin da base escolhida,
   `babel.config.js` se a base pedir, `nativewind-env.d.ts`, `PortalHost` na raiz (`app/src/app/_layout.tsx`).
5. Adicionar **um** componente (`Button`) com o CLI `@react-native-reusables/cli` e usá-lo numa tela.
6. Critério de aprovação — **todos**: `typecheck`, `lint`, `test`, export web e Android passam; a web exportada roda
   atrás do Caddy com a CSP atual (`style-src 'self' 'unsafe-inline'`), sem erro no console; o Expo Go abre no celular;
   o tema claro/escuro e a cor da marca mudam em tempo de execução (B2). Se falhar: registrar o motivo no README e
   **parar** a Parte B (o app continua com os componentes próprios).

### B2. Tema: tokens continuam a fonte da verdade

- Mapear os tokens para as variáveis CSS que o RNR usa: `--background` ← fundo, `--foreground` ← texto,
  `--card` ← superficie, `--muted` ← superficie2, `--accent` ← superficie3, `--muted-foreground` ← textoSuave,
  `--border` / `--input` ← borda, `--primary` ← **cor da marca**, `--primary-foreground` ← `textoSobre(marca)`,
  `--destructive` ← perigo, `--radius` ← 8 px. Variáveis próprias para status: `--sucesso`, `--atencao`, `--perigo`,
  `--neutro` (status **nunca** usa `--primary`).
- **Marca em tempo de execução** (white label: cada treinador tem a sua cor): definir `--primary` e
  `--primary-foreground` no `TemaProvider` com `vars()` (ou `VariableContextProvider` na v5; `updateCSSVariables` no
  Uniwind) a partir de `consultoria.corPrimaria`. Claro/escuro pela classe `dark` controlada pelo `TemaProvider`
  (escolha do usuário), não só pelo sistema.
- `global.css` tem os valores padrão (marca neutra `#52525B`). Teste: os valores do `global.css` batem com `tokens.ts`
  (ler o arquivo no Jest e comparar). Mudou um, muda o outro.
- Fontes: Inter (400/600/700) e Metal Mania no `fontFamily` da configuração do Tailwind, com os mesmos nomes de
  `tokens.fontes`.

### B3. Ajustes obrigatórios nos componentes do RNR

Os componentes vêm com o visual padrão do shadcn. Ao copiar cada um:
- **Remover sombras** (`shadow-*`) e gradientes; cantos com `rounded-md` = 8 px.
- Alvo de toque mínimo 44 px (`min-h-11`), foco visível na web.
- Textos em português; nada de `Alert`; overlays via `PortalHost`.
- Animações dos componentes (abrir/fechar) curtas e respeitando movimento reduzido.

### B4. Migração gradual (padrão "estrangulador")

Não reescrever telas. Trocar **por dentro** os componentes de `app/src/ui/`, mantendo as **mesmas props**, para as telas
não mudarem:

| Nosso componente | Base RNR |
|---|---|
| `Botao` | Button |
| `Cartao` | Card |
| `Campo`, `CampoNumero` | Input + Label |
| `Interruptor` | Switch |
| `Escolha` | Select ou ToggleGroup (lista curta) |
| `Abas` | Tabs |
| `Selo` | Badge (com as cores de status, não as do shadcn) |
| `PainelConfirmacao` | AlertDialog |
| `Texto` | Text (com as 5 variantes da A2) |
| `Folha` | continua própria (Parte C, C5) |

Uma troca por commit, com verificação completa e prints antes/depois (Playwright, dois temas). Só depois que todos os
`ui/` estiverem sobre o RNR, telas novas podem usar classes do Tailwind direto.

### B5. Pronto quando

Todos os `ui/` da tabela trocados; nenhuma tela mudou de comportamento; testes, lint, typecheck, exports e CSP ok;
marca e tema mudam em tempo de execução; `AGENTS.md` atualizado (base de estilo escolhida, onde ficam os componentes do
RNR, regra "tokens.ts é a fonte; global.css espelha").

---

## 5. Parte C — movimentos restantes

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
esqueleto aparece com rede lenta (Playwright com throttling na web); anel bate com a regra em 3 casos de teste.

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
