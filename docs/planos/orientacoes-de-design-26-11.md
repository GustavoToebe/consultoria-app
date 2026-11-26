# Orientações de design para os três planos de 26/11 (tamanhos de tela, colunas e medidas)

Situação: Orientação (nada implementado) · Vale para: [aluno-web-layout.md](aluno-web-layout.md),
[atualizacao-pasta-e-questionarios.md](atualizacao-pasta-e-questionarios.md) e
[documentos-pdf-motor.md](documentos-pdf-motor.md) · Atualizado: 26/11/2026

Este documento complementa os três planos com as **medidas e o comportamento por largura**. Ele não substitui a 4.10 de
`docs/design-e-front.md` nem o item "Tela larga" do `AGENTS.md`: parte deles e os aplica a estas telas. Quando um número
daqui for uma **proposta nova** (constante que ainda não existe), está marcado **(proposta)**. Confirme com o Gustavo na
mesma rodada de perguntas que os planos já pedem, com a recomendação primeiro.

---

## 0. Regras de base que valem para as três frentes

### 0.1 Medir a área, não a janela

- Layout dentro da tela: `useFaixaDaTela()`. Fora de uma `Tela`, `useFaixaDeLargura` no `onLayout` da raiz do bloco.
- Faixas da área: `compacta` < 1024 · `normal` 1024 a < 1600 · `larga` 1600 a < 2400 · `ultralarga` ≥ 2400.
- **Armadilha:** janela de 1280 com o menu aberto mede ~990 a 1040 px de área, ou seja, ainda `compacta` ou no limite.
  Janela de 1536 (notebook a 125%) cai na `normal`. Nunca escreva "duas colunas a partir de 1280" pensando na janela:
  escreva o limiar em **px de área** e confira nas larguras da matriz (0.5).
- Exceção só onde já está registrada (Configurações). Não crie outra sem registrar na 4.10.

### 0.2 Peça nova recomendada: "coluna principal + coluna de apoio"

Os três planos pedem a mesma composição: Dieta, Exercício e Treino do aluno, revisão da atualização (bloco D) e editor
do PDF. Faça **uma peça só em `ui/`** (nome sugerido `ui/ColunaComApoio`) com a regra pura em
`dominio/colunaComApoio.ts`, testada, e use nas três frentes. O `MuralComLateral` e a `ColunaDasEtapas` da importação
são o modelo de comportamento.

> Implementada nesta frente como `ui/PrincipalComApoio.tsx` + `dominio/arranjoPrincipalComApoio.ts` (mesmo papel; o nome
> ficou o da primeira versão, já em uso pelas telas).

| Medida | Valor |
| --- | --- |
| Coluna de apoio | 360 na `normal`, 400 na `larga`, 440 na `ultralarga` **(proposta**; casa com os 400/460 do Total do dia e os 360 da importação) |
| Vão entre as colunas | 32 |
| Coluna principal | mínimo 560; máximo por tela (tabela 0.3); a sobra vira margem, nunca esticamento |
| Abre lado a lado quando | área ≥ principal mínima + vão + apoio (560 + 32 + 360 = **952**); abaixo disso, empilha |
| Empilhado | a tela escolhe se o apoio vai **antes** (pendências, ações) ou **depois** (resumos) da principal; prop explícita, sem regra escondida |
| Fixa ao rolar (web) | `position: sticky`, `top` = altura da barra + 16 (hoje ~80), `maxHeight` = janela − top − 16, rolagem própria por dentro |
| Semântica | apoio com `role="complementary"` e `aria-label`; no DOM, **principal primeiro** (o leitor de tela e o Tab leem o conteúdo antes do resumo), mesmo quando o apoio aparece à esquerda |
| Nativo | sem `sticky`; empilha sempre |

O apoio **nunca** tem o conteúdo principal da tela. Só resumos, totais, ações e atalhos. Se o apoio passar da altura
da janela com frequência, ele está levando conteúdo demais.

### 0.3 Larguras máximas por tipo de conteúdo

| Conteúdo | Largura | Origem |
| --- | --- | --- |
| Texto corrido (parágrafo, resposta longa, orientação) | `LARGURA_TEXTO_CORRIDO` (72ch / 660) | existe |
| Formulário curto | `LARGURA_FORMULARIO` (640) | existe |
| Lista sequencial (refeições, séries, exercícios do dia, divisões, perguntas e respostas) | **880** (proposta) | — |
| Feed do mural | 720 | existe |
| Editor de uma coluna de campos | `LARGURA_EDITOR_DE_CAMPOS` (1400) | existe |
| Folha do editor | `LARGURA_EDITOR` (1040) | existe |
| Folha de detalhe | `LARGURA_FOLHA_LARGA` (800) | existe |

Os 880 da lista sequencial existem porque um cartão de refeição ou de série acima disso fica com o nome do item longe
do número (macros, carga) e o olho perde a linha. Com 880 + 32 + 400, o bloco do aluno fecha em **1312**, que é o teto
proposto no item 1.0.

### 0.4 Grades de quantidade fixa

Use a regra do Ano da Agenda (`mesesPorLinhaDoAno`): **por linha, o maior divisor do total que cabe**. Seis modelos de
PDF ficam em 6, 3, 2 ou 1 por linha, nunca 4 + 2. Indicadores (semana, nível) seguem a `GradeDeIndicadores`.

### 0.5 Matriz de conferência (capturas e e2e)

| Janela | Menu | O que confere |
| --- | --- | --- |
| 390 × 844 | — | celular igual ao de hoje |
| 1024 × 768 | aberto e minimizado | limite compacta/normal; o apoio empilha ou abre |
| 1280 × 720 | aberto | o caso real mais comum do treinador (área ~1000) |
| 1536 × 864 | aberto | notebook a 125% |
| 1920 × 1080 | aberto | faixa `normal` alta / `larga` |
| 2560 × 1440 | aberto | `larga` → `ultralarga` (com o recuo de 48) |
| 3440 × 1440 | aberto | ultrawide: nada esticado, sobra vira margem ou vão |

Tema escuro **e** claro em 1280 e 1920. Areia ao menos uma vez por tela nova. A altura também importa: confira os
fixos ao rolar (apoio, rodapés) com **720 de altura**, porque o teste da dieta já quebrou por isso em 26/11.

### 0.6 Alturas e alvos

- Alvo de toque e clique ≥ `ALVO_TOQUE` (44) em tudo, inclusive células de tabela editáveis (há campos de 42 hoje em
  Complementos: não repita).
- Cartões da mesma **linha** podem ter a mesma altura (`alignItems: stretch`), como "Sua semana" e "Seu nível". Cartões de
  **colunas independentes** não se alinham por linha (regra das "Colunas independentes" da 4.10).
- Nenhum cartão mais alto que o conteúdo pede só para "fechar a linha". Se sobra altura, o arranjo está errado, não o
  cartão.

---

## 1. App do aluno na web (`aluno-web-layout.md`)

### 1.0 Teto e posição da composição (recomendação)

O que o Gustavo achou feio (D1 a D7) vem de **três faixas de 552 em 1688** distribuindo cartões por "cabe na coluna".
Recomendação:

- **Teto único das telas do aluno: 1312 px, centralizado** (proposta; 880 de principal + 32 + 400 de apoio), em todas
  as faixas a partir de `normal`. Abaixo de 1312 de área, o bloco ocupa a área com o recuo de sempre.
- A `ultralarga` **não ganha colunas novas** no aluno. A sobra vira margem dos dois lados. O aluno lê uma coisa por vez,
  e um monitor de 2560 não muda isso.
- Título da tela e ações principais alinhados à borda **do bloco**, não da área (senão em 2560 o título fica longe do
  conteúdo).
- **Decisão do Gustavo, 26/11 (vale para todas as telas do aluno, inclusive Início, Conta e Comunidade):** todas usam o
  MESMO contêiner de 1312 px centralizado, com o título na borda ESQUERDA dele. Conteúdo mais estreito (Conta 984,
  Comunidade 1092) começa NESSA borda esquerda e termina antes; ele não é centralizado dentro do contêiner. O título e o
  início do conteúdo caem na mesma posição x em todas as telas do aluno.

O Início pode subir para 1688 depois, se ficar vazio no monitor grande (alternativa registrada, não implementada: teto de
1688 só no Início, por causa do mapa e da vitrine, mantendo 1312 nas outras). Decisão do Gustavo, 26/11: por ora, 1312
em todas.

### 1.1 Início

Linhas, não pilhas. A regra em `dominio/arranjoDoInicio.ts` recebe a lista dos blocos presentes e devolve linhas.

| Linha | `normal` em diante (bloco de 1312) | Proporção | Compacta e 390 |
| --- | --- | --- | --- |
| 1 | Hoje · Suas pendências | 3 : 2 (≈ 768 + 512) | Hoje, Pendências |
| 2 | Dieta (resumo) · Água de hoje | 1 : 1 | Dieta, Água |
| 3 | Sua semana · Seu nível (indicadores baixos, `GradeDeIndicadores`) | 1 : 1, altura ~96 a 120 | igual a hoje |
| 4 | Seu ano de treinos | largura toda | rolagem horizontal como hoje |
| 5 | Vitrine, "Ver tudo" no cabeçalho do cartão | grade de produtos, célula mínima 240 | igual a hoje |

- **Bloco ausente:** o par vira um cartão sozinho **na largura da metade maior**, alinhado à esquerda, sem esticar até
  1312. Exceção: sem pendências, o Hoje **não** cresce. A Água sobe para o lado dele (Hoje · Água) e a Dieta fica
  sozinha na linha 2. Escreva isso como regra testada ("pares por prioridade"), não como caso especial na tela.
- **Mapa do ano:** 53 semanas × célula máxima 22 + vão 2 ≈ 1270 px mais a coluna dos dias. Em 1312 menos o padding do
  cartão fica no limite, então a célula **encolhe para caber** (mínimo 12) e nunca passa de 22. A altura do cartão é a
  grade mais a legenda, nada além.
- **Pendências** com cobrança vencida: o selo vermelho existente, no topo da lista dela. Nada de cor nova no cartão.

### 1.2 Treino

- `ColunaComApoio`. Principal (880): **lista vertical das divisões**, uma linha por dia na ordem da semana.
  - Linha de treino: 64 a 72 px, nome da divisão + resumo ("6 exercícios · ~55 min") + seta.
  - **Hoje:** o mesmo tratamento do cartão "Hoje" do Início (superfície 2, a barrinha da marca à esquerda e o selo
    "Hoje"), sem cor nova.
  - Descanso: 48 a 56 px, texto suave "Descanso ativo", sem seta e sem área clicável de linha inteira.
- Apoio (antes da principal quando empilhado): Orientações do treinador **abertas** (em `LARGURA_TEXTO_CORRIDO` dentro
  do apoio, ou seja, o apoio limita), "Baixar PDF do treino" (`secundario`, largura do conteúdo do botão, não do apoio)
  e Mobilidade.

### 1.3 Treino do dia

- Apoio à **esquerda** como hoje (resumo, "Continuar", Outras datas). Lembrete: no DOM a principal vem primeiro (0.2).
- Principal: exercícios **numa coluna só**, na ordem. Cada linha tem nome, "Última carga" e "N/3 séries" na **mesma
  linha** a partir de 640 px de cartão; abaixo disso, a segunda linha.
- Uma frase só para a data, por exemplo "Registrando o treino de 30/11 · pode concluir a partir de 30/11". Mostre a
  redação ao Gustavo, porque é texto.

### 1.4 Exercício

- Duas colunas: **exercício à esquerda, fixo ao rolar** (apoio de 400 a 440, com vídeo embutido em 16:9 na largura da
  coluna, "Como fazer" aberto, cronômetro e Histórico) e **séries à direita**, numa coluna só, até 720 (a série é mais
  estreita que uma refeição).
- "Carga de trabalho de hoje" no topo da coluna das séries, em `LARGURA_FORMULARIO` ou menos (é um campo, não uma
  faixa).
- Rodapé "Anterior / Próximo": fixo embaixo, **na largura da coluna das séries**. Anterior como `secundario` à
  esquerda, Próximo como `secundario` à direita (decisão do Gustavo, 26/11: um primário por área; o botão primário da tela é o
  de concluir a série e, no fim, "Revisar e concluir"; Próximo fica secundário enquanto o exercício não está feito e também
  quando o destaque é "Revisar e concluir").
- Vídeo, Como fazer e Descanso deixam de parecer abas: são três **seções** da coluna, com título, empilhadas.

### 1.5 Dieta

- Principal (880): refeições **numa coluna só**, horário no cabeçalho ("12:00 · Almoço"), opções A/B como hoje.
- Apoio (400, fixo): Total do dia, Água, Suplementação, Medicação e ergogênicos (quando existir), Lista de compras,
  Baixar PDF e Observações. Com 720 de altura, o apoio vai rolar por dentro. Conferir que o Total do dia é o primeiro e
  fica visível sem rolar.
- **Pergunta 2 do plano, recomendação de design: uma coluna sempre**, inclusive na `ultralarga`. Duas colunas de
  refeições obrigam o olho a voltar para cima no meio do dia, e o ganho em 2560 é pequeno com o teto de 1312.
- Macros por refeição e no total:
  - kcal em destaque: 20 px semibold, `fontVariant: tabular-nums`;
  - P · C · G · Fibra numa linha menor embaixo (13 a 14 px, cor suave, números tabulares, separados por " · ");
  - em cartão estreito (< 360) os quatro quebram em 2 × 2, nunca reticências.

### 1.6 Comunidade

- Bloco **720 + 32 + 340 = 1092, centralizado** no mesmo eixo das outras telas (não colado à esquerda).
- Uma linha de controles acima do feed, com a largura do feed (720): seletor Avisos/Alunos, busca flexível (mínimo 200)
  e Filtros. Abaixo de 600 de feed, a busca desce para a linha de baixo.
- "Nova publicação" (`primario`): no topo do feed, à direita da linha de controles, ou como primeiro item do apoio acima
  de "Seus números". Recomendo **no feed**, porque a ação fica perto do que ela cria.
- Abas Vídeos, Conquistas e Colegas usam o mesmo bloco de 1092.

### 1.7 Histórico

- **Pergunta 1 do plano, recomendação: abas**, com `?aba=`.
- Treinos: Registros e cargas na principal (880) e Progresso por exercício no apoio (400). Abaixo de 952, empilha.
- Corpo: gráficos de Peso e Avaliação física na **largura do bloco** (1312), altura fixa ~280 a 320 (gráfico mais alto
  não mostra mais informação). Fotos em grade de célula mínima 200, proporção 3:4.
- Atualizações: lista sequencial (880).

---

## 2. Atualização, pasta e questionários (`atualizacao-pasta-e-questionarios.md`)

### 2.1 Bloco B: leitura das respostas (peça única, aluno e treinador)

- Base: `ui/ListaDeDados`.
- **Cartão < 760 px** (celular, apoio, prévia): pergunta em cima (13 px, cor suave), resposta embaixo (15 a 16 px, cor
  de texto, peso normal ou médio), espaço de 4 entre elas e 12 a 16 até a divisória.
- **Cartão ≥ 760 px:** duas colunas, com a pergunta à esquerda em **40% até 320 px** e a resposta à direita, alinhadas
  pelo topo. Resposta longa respeita `LARGURA_TEXTO_CORRIDO` dentro da coluna.
- Divisória entre perguntas: `divisor` de 1 px. Nada de cartão por pergunta (uma moldura só, regra das duas molduras).
- Nota "4/10": 20 px semibold, tabular. Escala embaixo só quando não for 0 a 10.
- Notas por dia: uma linha de pares "Dia 1 · 8" (chips neutros que quebram linha) ou, com 7 ou mais, uma tabelinha de
  uma linha com rolagem horizontal **dentro do cartão**.
- Sim/Não: selo neutro. "Não respondeu" em texto suave, nunca "—" solto.
- Cabeçalho da seção: título + "N perguntas" à direita, em texto suave.

### 2.2 Bloco D: revisão da atualização pelo treinador

| Área | Arranjo |
| --- | --- |
| `compacta` / 390 | empilha: Resumo do período → Feedback → O que está prescrito → Respostas |
| `normal` (≥ 952 de área) | `ColunaComApoio`: principal = abas Respostas \| Evolução (com "O que mudou" no topo do Resumo); apoio (360, fixo) = Feedback em cima e O que está prescrito embaixo, com rolagem própria |
| `larga` | apoio de 400 |
| `ultralarga` | **três colunas** (proposta): Respostas (até 880) · O que está prescrito (440) · Feedback (400, fixo). O treinador lê as respostas, compara com o prescrito e escreve sem rolar nada |

- No apoio, o Feedback **não rola junto** com o Prescrito: o Feedback fica no topo e o Prescrito rola por dentro. Se o
  Feedback crescer (texto longo), ele mesmo tem altura máxima e rolagem.
- **Decisão do Gustavo (26/11, noite):** o cartão chama-se **"Prescrição atual"** (não "O que está prescrito") porque mostra a
  versão de **hoje** (`versaoLiberada`), não a que valia quando o aluno respondeu. Mostrar a prescrição da época da resposta
  fica para o próximo lote. As **três colunas** da tela ultralarga também ficam para o próximo lote; por enquanto o apoio
  fica em 440.
- Abas do Prescrito (Treino | Dieta | Suplementos | Outros): compactas, como as `Abas` pequenas, com aba sem permissão
  **removida** (não desabilitada). Uma aba só sobrando vira título, sem barra de abas.
- Linhas do prescrito em modo compacto: 13 a 14 px, uma linha por item ("Supino reto · 3×6 a 8 · WS"), números
  tabulares. "Abrir no editor" no cabeçalho da aba, como link.
- "O que mudou": lista de fatos, uma por linha, valor anterior → atual com a seta em cor suave. Sem verde nem vermelho
  (D5). A cor da meta do peso que já existe pode ficar.
- Aba Evolução: os cartões da ficha em **colunas independentes** (1:1 a partir de 1000 px cada, a regra da ficha), não
  em linhas.

### 2.3 Bloco F: folha da pasta

- Folha com a largura da variante que ela já usa (`LARGURA_EDITOR`, 1040). Não use a régua de tela larga dentro de folha.
- Cabeçalho em **uma linha** a partir de 640 px de folha: título, período e situação à esquerda; ⋯ e
  "Publicar alterações (N)" à direita. Abaixo de 640, o botão desce para uma linha própria, na largura toda.
- Atualização do período logo abaixo do cabeçalho, como cartão de destaque (superfície 2), com "Revisar" (`acao`)
  quando há envio.
- Planos: `Abas` Treino | Dieta | Mobilidade com a contagem. Linhas de 56 a 64 px. O rascunho que não está em uso fica em
  cor suave, com a data de criação na segunda linha.
- Selo único por linha, com prioridade: Agendado > Alterações não publicadas > Em uso > Rascunho.

### 2.4 Bloco G: questionários

- O plano pede "lista + inspetor". Junte isso às **faixas do editor de questionário que já existem** na 4.10, em vez de
  criar outras:

| Área do editor | Arranjo |
| --- | --- |
| < 1000 | um painel por vez: lista → propriedades (voltar) · Prévia em aba |
| 1000 a < 1440 | lista (240 a 260, fixa) + propriedades da pergunta (flexível até 1400) · Prévia em aba |
| ≥ 1440 | lista (260 a 320) + propriedades (flexível até 1400) + **prévia ao vivo de 560** encostada à direita, com a sobra dividida nos dois vãos (`colunasDoEditor().vao`) |

- Linha da lista: 40 a 44 px (pergunta) e 48 (seção, com a contagem). Alça de arrastar à esquerda, ⋯ à direita, a
  selecionada com a seleção neutra da Ajuda.
- Galeria de tipos: folha de 800 (`LARGURA_FOLHA_LARGA`), cartões de célula mínima 200 (3 por linha em 800, 1 no
  celular), com ícone 20, nome em 15 semibold e exemplo em 13 suave numa linha. Grupos com subtítulo.
- Modal único de criação: P1 de 600. "Começar de" como `OpcaoCartao` radio em coluna.
- Editor vazio: estado vazio centralizado **na coluna das propriedades** (não na tela toda), com a galeria embaixo.
- Listas das abas do Planejamento: `ListaEmColunas` com mínimo de 720, como os modelos.

---

## 3. Documentos (PDF), editor e galeria (`documentos-pdf-motor.md`)

### 3.1 Galeria de modelos

- 6 modelos: por linha, **6, 3, 2 ou 1** (0.4). Célula mínima 220 e máxima 320. Em 1280 com o menu aberto cabem 3.
- Miniatura: recorte do **topo** da página (cabeçalho + uma tabela) em proporção **4:3**, não a A4 inteira (a A4 em 220
  px de largura fica ilegível). Gerada pelo gerador real, `aria-hidden`.
- **Desvio aceito pelo Gustavo (26/11, noite):** a miniatura **não** usa `MESA_DA_PREVIA`; o fundo é `cores.superficie2`. O
  papel cobre todo o recorte 4:3 (zoom = largura ÷ 794), então a mesa nunca apareceria e só piscaria cinza ao montar; o
  contraste não muda. A mesa continua só no editor.
- Embaixo: nome (15 semibold) e uma linha de descrição. Selo "Em uso" no modelo gravado. O cartão inteiro é o botão
  "Usar este modelo".
- **Nativo:** sem miniatura (D-F4). Lista de `OpcaoCartao` radio com nome, descrição e "Em uso".

### 3.2 Editor `/treinador/documentos/personalizar`

- **Medição:** o editor é tela inteira sobre `TelaDoEditor`. Se ele esconde o menu do app, a área é quase a janela, e
  uma janela de 1024 entra no editor. Se o menu continua, 1024 de janela vira `compacta` e cai em "Personalize numa tela
  maior" (risco listado no plano). **Recomendo esconder o menu no editor**, como tela de tarefa, e medir a área.

| Área | Arranjo |
| --- | --- |
| < 1024 | só a escolha do modelo (D24); o resto avisa "Personalize numa tela maior" |
| 1024 a < 1600 | painel de opções 360 à esquerda (rolagem própria) + prévia **ajustada à largura** do espaço que sobra (zoom = espaço ÷ 794, mínimo 60%) |
| ≥ 1600 | painel 400 + prévia em **100%** (794 px, a largura A4 real), centralizada no espaço que sobra |
| ≥ 2400 | painel 440 + prévia em 100%. Não amplie acima de 100%: a prévia deixaria de parecer o papel |

- Controle de zoom pequeno acima da prévia: "Ajustar" | "100%". O padrão é Ajustar abaixo de 1600 e 100% acima.
- A prévia fica numa moldura com o fundo cinza neutro (o "papel sobre a mesa"), com uma sombra leve, para a folha branca
  se destacar nos temas escuro e areia. A folha é sempre branca, independente do tema do app.
- Painel de opções: `Cartao recolhivel` por grupo (Cores, Texto, Cabeçalho, Tabelas; Rodapé no N2), com o `resumo` do
  valor escolhido no cabeçalho fechado ("Faixa cheia · logo à esquerda · média"). Só um aberto por vez ajuda no 1024.
- Paleta de destaque (8 cores): `GradeDeOpcoes` com amostras de 32 a 36 px (alvo de 44 com o espaço), nome embaixo, a
  escolhida com o anel de seleção. Nunca só a cor: o nome sempre aparece.
- Barra de ações fixa no topo: "Restaurar o modelo" (`secundario`), Desfazer e "Salvar" (`primario`). Desabilitado sem
  mudança.
- Prévia sem atraso (D-F7). Mudar uma opção **não rola** a prévia de volta ao topo.

---

## 4. O que registrar no relatório de cada frente

- A matriz da 0.5 com o que foi e o que **não** foi conferido (larguras, temas, nativo).
- Toda constante nova (880, 1312, 360/400/440 do apoio) em `tema/tokens.ts` e na 4.10, com o motivo.
- Se a `ColunaComApoio` nascer numa frente, as outras duas usam a mesma peça. Duas versões da mesma composição é o
  problema que estes planos estão tentando resolver.
