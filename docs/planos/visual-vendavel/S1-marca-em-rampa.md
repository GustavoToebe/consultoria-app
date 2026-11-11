# S1. Marca em rampa: a cor do treinador harmoniosa em qualquer paleta

Prévia: `docs/prototipos/visual-vendavel/index.html` (grade "marca × paleta") e todas as telas · Plano: [visual-vendavel.md](../visual-vendavel.md)

## O problema
Hoje a marca tem dois usos: preenchimento chapado (botão principal, cartão "Hoje") e `marcaTexto` (menu e aba ativos).
Resultado:
- Com cor escura em paleta escura (8 das 12 prontas avisam contraste baixo, ver `paletas-da-marca.md`), o botão e o
  cartão quase somem no fundo.
- Como só existe "tudo ou nada", a marca aparece pouco e a tela fica cinza; quando aparece, é um bloco pesado.
- A seleção invertida (fundo `texto`) é mais forte que a ação principal no escuro.
- A marca padrão `#C62828` é o mesmo vermelho do `perigoFundo`: marca e erro se confundem.

## A proposta
Da cor escolhida saem cinco papéis, calculados uma vez no tema. A paleta continua mudando só o chão.

| Papel | Como se calcula | Onde usar |
| --- | --- | --- |
| `marca` | a cor escolhida | preenchimento da **ação principal** da área e do cartão "Hoje"; nada mais |
| `sobreMarca` | `textoSobre(marca)` (já existe) | texto e ícone sobre o preenchimento |
| `marcaTexto` | `marcaParaTexto(marca, superficie3)` (já existe) | texto, ícone, sublinhado da aba, barra de progresso, anel de foco, link |
| `marcaSuave` (novo) | `tingido(marcaTexto, superficie)` | fundo do item ativo do menu, do chip escolhido, da linha escolhida |
| `marcaBorda` (novo) | mistura de ~45% de `marcaTexto` na superfície | contorno do escolhido e do cartão em foco |

Regras:
1. **Sólido só uma vez por área.** O resto da presença da marca vem de `marcaTexto`, `marcaSuave` e `marcaBorda`.
2. **Linha e texto nunca usam a cor crua**, sempre `marcaTexto` (que clareia no escuro e escurece no claro até 4,5:1).
   É isso que deixa Bronze no Café ou Azul no Meia-noite legíveis.
3. **Botão principal em paleta escura com marca escura:** quando `contraste(marca, superficie) < 3`, o botão ganha
   contorno de 2 px em `marcaTexto`. O preenchimento continua sendo a cor que o treinador escolheu.
4. **Marca nunca é status.** Erro leva ícone e texto; nunca só o vermelho.
5. **Seleção (decisão D3):** escolhido = fundo `marcaSuave`, contorno `marcaBorda`, letra `marcaTexto` em semibold, com
   ✓ onde couber. A invertida sai. Se o Gustavo preferir manter a invertida, os itens 1 a 4 valem do mesmo jeito.

## Onde mexer
| Arquivo | O que muda |
| --- | --- |
| `app/src/tema/tokens.ts:394` (`tingido`) e `:403` (`marcaParaTexto`) | nada; só reutilizar. Acrescentar a função de mistura para `marcaBorda` se `tingido` não aceitar proporção |
| `app/src/tema/TemaProvider.tsx:45-58` e `:118-128` | `ValorTema` ganha `marcaSuave` e `marcaBorda`, calculados no mesmo `useMemo` |
| `app/src/ui/Escolha.tsx:56-75` | opção ativa: hoje `cores.texto`/`cores.fundo`; passa a `marcaSuave`/`marcaBorda`/`marcaTexto` |
| `app/src/ui/Abas.tsx:116` (variante `invertida`) | mesma troca; a variante `sublinhado` (`:117`) já usa a marca: trocar `marca` por `marcaTexto` na linha |
| `app/src/ui/Navegacao.tsx:170-178` | item ativo ganha fundo `marcaSuave` (hoje só a letra muda) |
| `app/src/ui/Botao.tsx:47-57` | contorno `marcaTexto` quando o contraste do preenchimento com a superfície é menor que 3 |
| `app/src/ui/Calendario.tsx:73-93`, `Interruptor`, `FaixaDeChips` | conferir: usam a seleção invertida e seguem a mesma regra |
| `app/src/aluno/CartaoHoje.tsx:80` | continua sólido; ganha o contorno do item 3 |
| `app/src/treinador/marca/` (tela Marca) | a prévia da tela Marca mostra botão, item ativo e chip escolhido lado a lado, na paleta escolhida, e o aviso de contraste passa a olhar `marcaTexto` |

## Testes
- `app/src/tema/tokens.test.ts`: laço 12 cores × 10 paletas conferindo `contraste(marcaTexto, superficie) ≥ 4,5`,
  `contraste(marcaTexto, marcaSuave) ≥ 4,5`, `contraste(sobreMarca, marca) ≥ 4,5` e contorno do botão ≥ 3.
- `app/src/ui/contrasteDasPecas.test.ts`: caso novo para a opção escolhida e o item ativo.
- E2e das telas que usam `Escolha` continuam passando sem mudança (o papel acessível não muda).

## Telas afetadas
Todas as que usam `Escolha`, `Abas` invertida, `FaixaDeChips`, `Calendario` e o menu. É mudança de peça compartilhada:
vai num PR só, com captura de pelo menos Alunos, ficha, editor de treino, Planejamento, Agenda e as telas do aluno, em
Escuro e Claro.

## Documento de design
Atualizar `docs/design-e-front.md`: linhas 114 e 159 (seleção invertida), tabela da 4.5 (linha "Seleção") e a lista
fechada da marca (acrescentar item ativo tingido, escolhido, progresso e foco), e o P3 da 4.6.

## Dois pontos para o Gustavo decidir junto
- **Anel de foco.** A prévia usa `marcaTexto` no anel de foco; o `anelFoco` de `tokens.ts` hoje é neutro e o comentário
  diz "nunca a marca". Manter neutro é o mais seguro (o foco fica igual em qualquer marca); a prévia mostra a outra opção.
- **Número informativo.** Testado na prévia e descartado: KPI informativo na cor da marca, com a marca vermelha, parece
  "perigo". Número informativo fica em `texto` (S3).

## Risco
A marca vermelha padrão com seleção tingida pode lembrar erro num formulário com campo inválido ao lado. Na prévia,
conferir a tela com um erro visível antes de aprovar.
