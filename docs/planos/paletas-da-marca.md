# Paletas da marca (a consultoria escolhe a cor de fundo do app dos alunos)

Situação: Em andamento (passos 2 a 5 feitos; falta a conferência e a revisão, passos 6 e 7) · Onde: branch `paletas-da-marca` · Atualizado: 03/11/2026 (10 paletas: a Brisa saiu no teste de contraste)

## Objetivo
Hoje a consultoria escolhe só "Tema padrão dos alunos": Escuro ou Claro. A ideia é oferecer, na tela Marca, uma lista
**fechada e já testada** de paletas (fundo, cartão, faixas e bordas em tons de azul, ameixa, oliva, lavanda etc.), para o
app ter a cara da consultoria sem perder a leitura. Ninguém digita cor de fundo: só escolhe uma da lista.

## De onde vieram as paletas
Seis posts do Instagram (@uiuxaadi, marcados como "Conteúdo de IA") com 25 paletas. Medi o contraste WCAG de cada uma
contra as cores do app em 03/11 (script fora do repositório; fórmula da luminância relativa, a mesma de `contraste()` em
`tema/tokens.ts`):

- **Tema escuro** (tom mais escuro = fundo, o seguinte = cartão; contra texto, texto suave, verde, âmbar e vermelho do
  ESCURO, régua 4,5:1): 10 passam inteiras, 3 passam com ajuste (Forest Glow, Ocean Teal, Sunset Fusion), o resto não
  serve de fundo.
- **Tema claro** (tom mais claro = fundo; contra as cores do CLARO): 7 passam.

Só entram as que passaram sem ajuste. Os tons do meio das paletas (rosa, laranja, ciano) **não** entram: são cor de
detalhe e brigam com as cores de status.

## Como fica (proposta)

**Regra de ouro:** a paleta muda só o "chão" do app (fundo, cartão, faixa do título, item, divisor, bordas e campo). Texto,
verde (ok), âmbar (pendente), vermelho (erro), fases do ciclo, foco e a cor da marca continuam os do tema Escuro ou Claro
de hoje. É o mesmo desenho do "Claro areia" (`AREIA = { ...CLARO, fundo, superficie2, ... }`), que já existe e já é testado.

**Cada paleta tem um modo fixo** (escura ou clara). Por isso não existe campo novo: o `temaPadrao` da consultoria passa a
aceitar os códigos das paletas, e o app deduz o modo (`modoDaPaleta`). Não há combinação inválida (paleta clara em modo
escuro).

| Código | Nome na tela | Modo | Fundo | Cartão / faixa | Origem |
| --- | --- | --- | --- | --- | --- |
| `ESCURO` | Escuro | escuro | #0A0A0C | #18181B | já existe |
| `CLARO` | Claro | claro | #F7F7F8 | #FFFFFF | já existe |
| `AREIA` | Areia | claro | #FAF9F6 | #FFFFFF | já existe (hoje só nas Preferências) |
| `MEIA_NOITE` | Meia-noite | escuro | #06141B | #11212D | Midnight |
| `AMEIXA` | Ameixa | escuro | #190019 | #2B124C | Plum |
| `VIOLETA` | Violeta | escuro | #0E0B1D | #2A1E4D | Purple Haze (fora: corte de 03/11) |
| `OCEANO` | Oceano | escuro | #0B132B | #1C2541 | Arctic Blue |
| `OLIVA` | Oliva | escuro | #0B0F0D | #1F2A1F | Olive Luxe (fora: corte de 03/11) |
| `CAFE` | Café | escuro | #1A120E | #3A2418 | Mocha Earth |
| `PETROLEO` | Petróleo | escuro | #05161A | #072E33 | Teal (fora: corte de 03/11) |
| `LAVANDA` | Lavanda | claro | #F7F8FF | #E6E0FF (faixa) | Lavender |
| `CEU` | Céu | claro | #F0F7FF | #DBEAFE (faixa) | Ocean Blue |
| `MENTA` | Menta | claro | #F8FFFE | #E6FFFB (faixa) | Mint (fora: corte de 03/11) |
| `ROSA` | Rosa | claro | #FFF9FB | #FCE7F3 (faixa) | Rose |
| `BRISA` | Brisa | claro | #F1F7F7 | #D5E5E5 (faixa) | Pastel Breeze (fora: teste de contraste de 03/11, ver a decisão 6) |

Nas claras o cartão continua branco (como no CLARO e no AREIA) e o segundo tom vira a faixa do título (`superficie3`).
Nas escuras, os tons que a paleta não traz (`superficie2`, `superficie3`, `faixaForte`, `divisor`, `borda`, `campo`,
`bordaCampo`) são calculados **uma vez**, clareando o cartão em passos fixos, e gravados como valores literais no
`tokens.ts`: nada de cálculo em tempo de execução. Cada valor passa pelos mesmos testes de contraste de hoje.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Lista final de paletas (a tabela acima) | 11 paletas, cortadas olhando a prévia: escuras Escuro, Meia-noite, Ameixa, Oceano e Café; claras Claro, Areia, Lavanda, Céu, Rosa e Brisa. Saem Menta (a faixa do título some, 1,05:1 contra o cartão), Oliva, Petróleo e Violeta (parecidas com as que ficam). Oceano e Café usam o cartão ajustado da prévia (`#1A223C` e `#301E14`), e a faixa e os tons derivados das escuras saem da prévia, não do passo fixo | Gustavo, 03/11/2026 |
| 2 | O aluno também escolhe paleta nas Preferências? | Não: a paleta é a identidade da consultoria. O aluno continua com Escuro / Claro / Areia / Sistema / "Da consultoria"; a paleta chega por "Da consultoria" (o padrão), e quem prefere o neutro troca | Gustavo, 03/11/2026 |
| 3 | O treinador vê o app dele na paleta escolhida? | Sim, pelo mesmo "Da consultoria" de hoje, para ver o que o aluno vê; pode trocar nas Preferências | Gustavo, 03/11/2026 |
| 4 | Cor da marca personalizada × paleta | A checagem da cor (`avaliacao.bloqueia` no `FormMarca`, `dominio/paletas.ts`) passa a medir contra o fundo e o cartão da paleta escolhida, não só ESCURO/CLARO (uma cor que passa no Escuro pode sumir no Petróleo) | Gustavo, 03/11/2026 |
| 5 | App antigo no celular que recebe um código novo | Aceito: o `TemaProvider` antigo cai no ESCURO para valor que não conhece; some com o APK novo (sem compatibilidade com o legado, regra do AGENTS.md; ninguém fica sem usar o app) | Gustavo, 03/11/2026 |
| 6 | Brisa fora da lista (passo 2) | A faixa `#D5E5E5` reprovou no teste da agenda (`contrasteDaAgenda.test.ts`): o item da agenda em cima da faixa Brisa não chega a tingir os 6% mínimos de 30/10 com a cor OLIVA, porque o fundo tingido já está em 3,03:1 com a própria cor (limite de 3:1); falha nos quatro cenários (padrão, contraste alto, bordas reforçadas e os dois). Regra do plano: paleta que falha sai, não se ajusta cor por paleta. Ficam 10 paletas. **A conferir pelo Gustavo** | Claude (regra do passo 2), 03/11/2026 |
| 7 | `faixaForte` das escuras | A prévia não calcula esse tom; o passo 2 usou a faixa + 0,03 de mistura com branco (Meia-noite `#263540`, Ameixa `#3E275C`, Oceano `#2A314A`, Café `#3E2E24`), a mesma ideia do Escuro (faixa 0,09 → forte 0,12). Passa os testes (forte mais claro que a faixa; barra de identificação 3:1). **A conferir pelo Gustavo na tela** | Claude, 03/11/2026 |
| 8 | Cartão das paletas na tela Marca (passo 5) | "Tema padrão dos alunos" virou "Paleta padrão dos alunos", com dois grupos "Escuras" e "Claras" de `OpcaoCartao` (o mesmo cartão da Cor e da Fonte: borda de 2 px e ✓ na escolhida, alvo ≥ 44 px, 1 coluna no celular e 2 no PC) e a miniatura de 40 px com fundo, faixa do título, cartão, uma linha de texto e o botão na cor da marca de cada paleta. A prévia virou uma só, na paleta escolhida ("Paleta Ameixa"), com a faixa do título e o nome na cor legível sobre a faixa. O aviso da cor também aparece embaixo das paletas (no celular quem troca a paleta não vê o cartão Cor). **Decidido pelo Claude em 03/11, conferir com o Gustavo** | Claude, 03/11/2026 |
| 9 | Checagem da cor (decisão 4) | Mede o fundo **e o cartão** da paleta escolhida (≥ 3:1), mais o fundo do Escuro e do Claro, que o aluno ainda pode escolher nas Preferências; texto "Na paleta Oceano, ícones e o menu ativo ficam apagados." (com "e no tema escuro/claro" quando também some lá). Só avisa, nunca trava o Salvar. Efeito: contando o cartão, Índigo e Magenta das Cores prontas passam a avisar já no Escuro (cartão `#18181B`), e nas escuras 8 das 12 prontas avisam (no Oceano: Vermelho intenso, Esmeralda, Turquesa, Ciano, Índigo, Roxo, Magenta e Bronze); nas claras nenhuma. Se ficar ruidoso, medir só o fundo. **Decidido pelo Claude em 03/11, conferir com o Gustavo** | Claude, 03/11/2026 |

## Passos
- [x] 0. Esperar a frente de cores da auditoria (vermelho da marca separado do erro, desabilitado cinza), que mexe no
  `tokens.ts`. Conferido em 03/11 com `git branch -r`: `editor-de-treino-visual` e `atualizacao-visual-app-full` não
  estão mais no remoto, então não travam este passo. Começar a partir da `main` atualizada. — commit/run: `77263a77` (#70, já na branch)
- [x] 1. **Prévia** em `docs/prototipos/paletas-da-marca.html`: a mesma tela (Início do aluno, lista e um cartão com
  selos verde/âmbar/vermelho e botão da marca) nas 15 paletas, com o contraste medido ao lado. O Gustavo corta a lista
  aqui (decisão 1). Prévia feita e lista cortada em 03/11 (11 paletas, decisão 1). **executor-front** — commit/run: f7f5e087 (#57), 64da6020 (#58)
- [x] 2. **Tokens** (`app/src/tema/tokens.ts`): as paletas como objetos `Cores` literais (`{ ...ESCURO, fundo, ... }` /
  `{ ...CLARO, ... }`), um mapa único `PALETAS` (código → cores e modo) e `modoDaPaleta`. Os testes que hoje listam
  `[CLARO, ESCURO, AREIA]` à mão passam a percorrer `PALETAS`: `tema/tokens.test.ts` (linhas 3, 9, 38, 134, 145),
  `ui/contrasteDasPecas.test.ts:9`, `treinador/agenda/contrasteDaAgenda.test.ts:13`, `dominio/preferencias.test.ts:40`
  e `:121`. Paleta que falhar em qualquer teste sai da lista (não se ajusta status por paleta). Feito: os testes percorrem `PALETAS` (inclusive os de contraste alto e bordas reforçadas e os da identificação) e a Brisa saiu (decisão 6). **executor** — commit/run: `2dfa6c50`
- [x] 3. **API**: migration `V055__paletas_da_marca.sql` troca o `consultoria_tema_padrao_check` (V001:198) pela lista nova e alarga
  `tema_padrao` para `varchar(20)`; `Consultoria.Tema` (Consultoria.java:29) ganha os códigos; `MarcaRequest`
  (MarcaService.java:32) não muda de forma (já é o enum, valor fora = 400). Testes: `MarcaELogoIntegrationTest` grava e
  lê uma paleta nova e recusa código inexistente; subir o total em 1 a partir do que estiver na main em `FlywayMigrationIntegrationTest` e
  `PapeisBancoIntegrationTest` (**executor-rapido** só para os totais). Feito, com a lista de 10 códigos (sem a Brisa); `AGENTS.md` cita a V055. **executor** — commit/run: `8621d098`
- [x] 4. **App, tema**: `api/tipos.ts:7` (`Tema` com os códigos), `TemaProvider.tsx:91-104` (o modo sai de
  `modoDaPaleta`, a base de `PALETAS[codigo]`; preferência Escuro/Claro/Areia/Sistema da pessoa continua vencendo),
  `ui/PreferenciasDoApp.tsx:36` (o ternário vira `PALETAS[temaPadrao]`), e os `modo === 'ESCURO'` de `app/_layout.tsx:67`
  e `:81` e `treinador/agenda/itemDaAgenda.tsx:107` conferidos (devem seguir o modo, não o código). Teste em
  `tema/TemaProvider.test.tsx` (uma escura, uma clara e a escolha da pessoa vencendo). `app/_layout.tsx` e `itemDaAgenda.tsx` já seguem `modo` (não o código): sem mudança. **executor** — commit/run: `2dfa6c50`
- [x] 5. **Tela Marca** (`treinador/marca/FormMarca.tsx:234-243`): "Tema padrão dos alunos" vira duas linhas de
  miniaturas (Escuras / Claras) no `GradeDeOpcoes` com `MiniaturaDoTema`, e a `Previa` (:159) mostra a paleta escolhida.
  A checagem da cor personalizada mede contra a paleta (decisão 4). Feito (decisões 8 e 9); sem o perfil Administrador a Marca já não abre ("Sem acesso a esta tela"), então não há estado só leitura a fazer. E2e `e2e/marca-paletas.spec.ts` (390 e 1280, claro e escuro). **executor-front** — commit/run: `1bf7668e`
- [ ] 6. **Conferência**: `npm run typecheck && npm run lint && npm test`, `mvn verify`, e2e da Marca (escolher uma
  paleta, salvar, recarregar, o Início do aluno abre nela) e passada no local com Playwright em 390 e 1280 px nas
  paletas aprovadas (capturas fora de `docs/`). **executor-rapido** devolve só as falhas — commit/run: —
- [ ] 7. **Revisão** pelo advisor (contrato da marca, migration, contraste) e um push só. — commit/run: —

## Fora do escopo
- Paleta livre (a consultoria digitar a cor de fundo): não, porque não dá para garantir contraste nem testar.
- Usar os tons de destaque das paletas (rosa, laranja, ciano) em botões ou selos.
- PDFs: continuam com fundo branco e a cor da marca, como hoje.
- Montador de telas (`dominio/montador.ts`): tem os próprios temas; só se o Gustavo pedir.
- As paletas que passaram com ajuste (Forest Glow, Ocean Teal, Sunset Fusion) e a Neon Pop (é quase o Escuro de hoje,
  e o rosa dela briga com o vermelho de erro).

## O que ficou para trás
- Passo 6: o e2e da tela (`marca-paletas.spec.ts`) confere o PUT; falta o caminho inteiro (salvar, recarregar e o Início do aluno abrir na paleta) e a passada no local.
