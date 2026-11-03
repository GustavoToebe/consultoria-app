# Paletas da marca (a consultoria escolhe a cor de fundo do app dos alunos)

Situação: Planejando · Onde: — · Atualizado: 03/11/2026

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
| `VIOLETA` | Violeta | escuro | #0E0B1D | #2A1E4D | Purple Haze |
| `OCEANO` | Oceano | escuro | #0B132B | #1C2541 | Arctic Blue |
| `OLIVA` | Oliva | escuro | #0B0F0D | #1F2A1F | Olive Luxe |
| `CAFE` | Café | escuro | #1A120E | #3A2418 | Mocha Earth |
| `PETROLEO` | Petróleo | escuro | #05161A | #072E33 | Teal |
| `LAVANDA` | Lavanda | claro | #F7F8FF | #E6E0FF (faixa) | Lavender |
| `CEU` | Céu | claro | #F0F7FF | #DBEAFE (faixa) | Ocean Blue |
| `MENTA` | Menta | claro | #F8FFFE | #E6FFFB (faixa) | Mint |
| `ROSA` | Rosa | claro | #FFF9FB | #FCE7F3 (faixa) | Rose |
| `BRISA` | Brisa | claro | #F1F7F7 | #D5E5E5 (faixa) | Pastel Breeze |

Nas claras o cartão continua branco (como no CLARO e no AREIA) e o segundo tom vira a faixa do título (`superficie3`).
Nas escuras, os tons que a paleta não traz (`superficie2`, `superficie3`, `faixaForte`, `divisor`, `borda`, `campo`,
`bordaCampo`) são calculados **uma vez**, clareando o cartão em passos fixos, e gravados como valores literais no
`tokens.ts`: nada de cálculo em tempo de execução. Cada valor passa pelos mesmos testes de contraste de hoje.

## Decisões
| # | Decisão | Valor | Quem decidiu |
| --- | --- | --- | --- |
| 1 | Lista final de paletas (a tabela acima) | Começar com as 15 da tabela e cortar no passo 1, olhando a prévia (meta: umas 10; Café e Oliva, por exemplo, podem ficar parecidas demais) | Gustavo, 03/11/2026 |
| 2 | O aluno também escolhe paleta nas Preferências? | Não: a paleta é a identidade da consultoria. O aluno continua com Escuro / Claro / Areia / Sistema / "Da consultoria"; a paleta chega por "Da consultoria" (o padrão), e quem prefere o neutro troca | Gustavo, 03/11/2026 |
| 3 | O treinador vê o app dele na paleta escolhida? | Sim, pelo mesmo "Da consultoria" de hoje, para ver o que o aluno vê; pode trocar nas Preferências | Gustavo, 03/11/2026 |
| 4 | Cor da marca personalizada × paleta | A checagem da cor (`avaliacao.bloqueia` no `FormMarca`, `dominio/paletas.ts`) passa a medir contra o fundo e o cartão da paleta escolhida, não só ESCURO/CLARO (uma cor que passa no Escuro pode sumir no Petróleo) | Gustavo, 03/11/2026 |
| 5 | App antigo no celular que recebe um código novo | Aceito: o `TemaProvider` antigo cai no ESCURO para valor que não conhece; some com o APK novo (sem compatibilidade com o legado, regra do AGENTS.md; ninguém fica sem usar o app) | Gustavo, 03/11/2026 |

## Passos
- [ ] 0. Esperar a frente de cores da auditoria (vermelho da marca separado do erro, desabilitado cinza), que mexe no
  `tokens.ts`. Conferido em 03/11 com `git branch -r`: `editor-de-treino-visual` e `atualizacao-visual-app-full` não
  estão mais no remoto, então não travam este passo. Começar a partir da `main` atualizada. — commit/run: —
- [ ] 1. **Prévia** em `docs/prototipos/paletas-da-marca.html`: a mesma tela (Início do aluno, lista e um cartão com
  selos verde/âmbar/vermelho e botão da marca) nas 15 paletas, com o contraste medido ao lado. O Gustavo corta a lista
  aqui (decisão 1). **executor-front** — commit/run: —
- [ ] 2. **Tokens** (`app/src/tema/tokens.ts`): as paletas como objetos `Cores` literais (`{ ...ESCURO, fundo, ... }` /
  `{ ...CLARO, ... }`), um mapa único `PALETAS` (código → cores e modo) e `modoDaPaleta`. Os testes que hoje listam
  `[CLARO, ESCURO, AREIA]` à mão passam a percorrer `PALETAS`: `tema/tokens.test.ts` (linhas 3, 9, 38, 134, 145),
  `ui/contrasteDasPecas.test.ts:9`, `treinador/agenda/contrasteDaAgenda.test.ts:13`, `dominio/preferencias.test.ts:40`
  e `:121`. Paleta que falhar em qualquer teste sai da lista (não se ajusta status por paleta). **executor** — commit/run: —
- [ ] 3. **API**: migration `a próxima migration livre na hora (hoje seria V054)` troca o `consultoria_tema_padrao_check` (V001:198) pela lista nova e alarga
  `tema_padrao` para `varchar(20)`; `Consultoria.Tema` (Consultoria.java:29) ganha os códigos; `MarcaRequest`
  (MarcaService.java:32) não muda de forma (já é o enum, valor fora = 400). Testes: `MarcaELogoIntegrationTest` grava e
  lê uma paleta nova e recusa código inexistente; subir o total em 1 a partir do que estiver na main em `FlywayMigrationIntegrationTest` e
  `PapeisBancoIntegrationTest` (**executor-rapido** só para os totais). **executor** — commit/run: —
- [ ] 4. **App, tema**: `api/tipos.ts:7` (`Tema` com os códigos), `TemaProvider.tsx:91-104` (o modo sai de
  `modoDaPaleta`, a base de `PALETAS[codigo]`; preferência Escuro/Claro/Areia/Sistema da pessoa continua vencendo),
  `ui/PreferenciasDoApp.tsx:36` (o ternário vira `PALETAS[temaPadrao]`), e os `modo === 'ESCURO'` de `app/_layout.tsx:67`
  e `:81` e `treinador/agenda/itemDaAgenda.tsx:107` conferidos (devem seguir o modo, não o código). Teste em
  `tema/TemaProvider.test.tsx` (uma escura e uma clara). **executor** — commit/run: —
- [ ] 5. **Tela Marca** (`treinador/marca/FormMarca.tsx:234-243`): "Tema padrão dos alunos" vira duas linhas de
  miniaturas (Escuras / Claras) no `GradeDeOpcoes` com `MiniaturaDoTema`, e a `Previa` (:159) mostra a paleta escolhida.
  A checagem da cor personalizada mede contra a paleta (decisão 4). **executor-front** — commit/run: —
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
- (nada ainda)
