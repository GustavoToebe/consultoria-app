# Importação de alunos e histórico de peso

Pedido da reunião de 17/10 (R25, R26 e R51): trazer os alunos de outra planilha **com as datas dos pesos**, para a
curva de evolução já aparecer na ficha. Planos, dietas e treinos antigos ficam de fora nesta etapa.

## Formato (o modelo está em `scripts/importacao/modelos/`)

Dois arquivos CSV, separados por `;` ou `,`, com cabeçalho na primeira linha. A ordem das colunas não importa.

**`alunos.csv`**

| Coluna | Obrigatória | O que é |
|---|---|---|
| `codigo` | sim | Identificador do aluno na planilha antiga (só liga as duas planilhas; não vai para o app) |
| `nome` | sim | Até 120 letras |
| `email` | não | Se vier, precisa ser válido. Sem e-mail o aluno entra sem acesso; o convite sai depois pela ficha |
| `dias_atualizacao` | não | De 1 a 365; vazio usa o padrão da consultoria |

**`pesos.csv`**

| Coluna | Obrigatória | O que é |
|---|---|---|
| `codigo` | sim | O mesmo da `alunos.csv` |
| `data` | sim | `DD/MM/AAAA` (ou `AAAA-MM-DD`); data no futuro é recusada |
| `peso_kg` | sim | `82,5` ou `82.5` (maior que 0 e menor que 500) |
| `observacao` | não | Até 300 letras |

## Da planilha do treinador

A planilha do Saraiva é um `.xlsx` com, entre outras, as abas **"Alunos"** (`ID`, `Nome`, `Email`, `Telefone`,
`Peso Inicial (kg)`, `Objetivo`, `Data Início`, `Status`, `Obs`) e **"Histórico Pesos"** (`ID`, `ID Aluno`, `Nome Aluno`,
`Data`, `Semana Nº`, `Peso (kg)`, `Variação (kg)`, `Observação`). Em vez de exportar cada aba à mão (o que perde as
datas do Excel), o conversor gera os dois CSV deste formato:

```
node scripts/importacao/converter-planilha.mjs --planilha <fora do repositório>/planilha.xlsx --saida <pasta fora do repositório>
```

Ele grava na pasta de saída `alunos.csv`, `pesos.csv` e `problemas.csv`, e recusa planilha ou pasta de saída dentro do
repositório. Não fala com a API: depois de ler os problemas, rode o importador (abaixo) com `--pasta` na mesma saída.

- **Alunos:** `codigo` = o ID da planilha; nome com os espaços arrumados; e-mail em minúsculas; `dias_atualizacao`
  vazio (vale o padrão da consultoria). Telefone, Objetivo e Obs **não** são levados (o importador não os grava, e
  objetivo e observação são dado sensível). Se a primeira célula do cabeçalho tiver um ID em vez de "ID", essa coluna
  é tomada como a do ID; linhas de título acima do cabeçalho são puladas.
- **Status inativo (decisão):** o aluno é convertido mesmo assim e o importador o cria **ativo**, para o histórico de
  peso de quem saiu não se perder; o terminal diz só quantos estavam marcados como não ativos (qualquer status que não
  seja "Ativo"/"Ativa"). Desative-os depois na lista de alunos (ações em lote).
- **Peso inicial:** "Peso Inicial (kg)" com "Data Início" vira também uma linha de peso, a não ser que o histórico já
  tenha um peso do aluno naquela data (aí vale o do histórico).
- **Histórico:** usa ID Aluno, Data, Peso (kg) e Observação; Semana, Variação e Nome Aluno não são usados (a variação o
  app calcula do próprio histórico). Datas do Excel são convertidas (número de dias desde 30/12/1899; data digitada como
  texto `DD/MM/AAAA` também vale). Peso com resto de conta do Excel (`79,9000001`) volta a duas casas; com três casas de
  verdade é recusado, nunca arredondado.
- **Nada some calado.** Linha sem data, com data no futuro ou que não é data, peso vazio ou inválido (`#REF!`), aluno
  sem ID ou sem nome, ID repetido, ID de aluno que não está na aba Alunos, mesmo aluno e data duas vezes, peso inicial
  sem data: a linha fica de fora e vai para `problemas.csv` com **aba, linha e motivo** (nunca nome, e-mail ou peso), e
  o terminal mostra as contagens por motivo. E-mail inválido e observação com mais de 300 letras não tiram a linha: o
  aluno entra sem e-mail e o peso sem observação, e o problema fica anotado. Dois alunos com o mesmo nome ficam os dois
  (o conversor não escolhe) e o importador para até a planilha ser corrigida.
- Lê o `.xlsx` só com o Node (o arquivo é um zip de XML; nenhuma dependência nova). Planilha com senha precisa ser
  salva antes como cópia sem senha. Testes: `node --test scripts/importacao/planilha.test.mjs`, com uma planilha
  fictícia montada no próprio teste.

## Dieta e treino da planilha do treinador (rascunhos)

Além dos alunos, a planilha tem as abas **Planos**, **Refeições**, **Suplementos**, **Treinos_Rotinas** e
**Treinos_Exercicios**. Dois scripts levam isso para a plataforma como **rascunho**, nunca publicado: o treinador revisa
e publica na tela. A aba **TACO** (tabela de terceiros) nunca é lida: o conversor pede ao leitor só as abas de que
precisa e a TACO nem é descomprimida. Os alunos precisam ter sido importados antes (o plano é ligado ao aluno pelo nome).

```
node scripts/importacao/converter-planos.mjs --planilha <fora do repositório>/planilha.xlsx --saida <pasta fora do repositório> [--simular] [--pacote]
node scripts/importacao/importar-planos.mjs  --pasta <a mesma pasta> --simular      (sem rede e sem login)
node scripts/importacao/importar-planos.mjs  --pasta <a mesma pasta> --gravar       (grava; exige API_URL, IMPORT_EMAIL, IMPORT_SENHA)
```

- **Conversor:** grava um JSON por aluno (o nome do arquivo é o código do aluno na planilha, nunca o nome; permissão 0600)
  e um `problemas.csv` só com aba, linha e motivo. Recusa planilha e pasta dentro do repositório. O terminal mostra só
  contagens. `--simular` não grava nada. Grava também o `correspondencias-exercicios.csv` e o
  `classificacao-suplementos.csv` (abaixo); com `--pacote`, grava ainda a pasta `para-o-saraiva/` (abaixo).
- **Regras:** só entra plano ou rotina **ativo** e **único** por aluno (plano inativo, repetido ou de aluno que não está
  na aba Alunos vai para os problemas; o conversor nunca escolhe um). Valor ausente é "—" (nulo), nunca zero: quantidade 0
  na dieta fica sem quantidade. Intra-treino, hidratação e refeição livre viram orientações da dieta; "Obs Gerais", a
  observação geral. Treino: uma sessão por letra, exercícios pela coluna Ordem, e as observações da rotina (divisão
  semanal, acessórios, recomendações, gerais) viram as orientações do treino. Os limites de tamanho da API são respeitados
  (nome de exercício com mais de 120 letras é cortado e o nome inteiro vai para a observação; link de vídeo só https do
  YouTube).
- **Séries (padrão do Saraiva, igual à metodologia padrão):** FS segue a regra de preparação (1 FS = 85%; 2 = 70 e 85;
  3 = 50, 70 e 85; outra quantidade fica sem intensidade e vai para os problemas), 3 repetições; WS usa a faixa da coluna
  "Rep Range" (`3a6`); TS vira um "Top set" livre; BO vira "Back off" com o percentual da coluna "Back Off %" e 6 a 8
  repetições. Exercício sem nenhuma série entra vazio, para o treinador preencher.
- **Faixa de repetições que o Excel virou data:** "6-8" digitado numa célula vira a data 06/08 (ou 8 de junho, conforme a
  configuração do Excel) e chega como número de série. O conversor pega o dia e o mês da data (converte o serial em UTC, sem
  depender do fuso do computador, e respeita o sistema de datas de 1904 da planilha) e, se os dois estão entre 1 e 50, usa a
  faixa do **menor para o maior** (6/8 e 8/6 dão 6 a 8; 12/10 dá 10 a 12). Também vale a data escrita em texto (`6/8`,
  `06/08/2026`, `2026-08-06`). Se a data tem ano, ele precisa estar entre 2015 e 2040 (o Excel põe o ano em que se
  digitou); fora disso, ou com dia ou mês acima de 50, **nada é recuperado**: as repetições ficam em branco e o motivo é
  "faixa de repetições virou data no Excel" (esse, sim, vai para o `problemas.csv`). A faixa recuperada **não** entra no
  `problemas.csv`: o resumo do terminal (conversor e `--simular`) só conta quantas foram. Número pequeno (8) continua sendo
  repetição fixa.
- **Suplementos:** vai para a suplementação o que a lista de ergogênicos **não** reconhece e que (1) casa com um
  suplemento conhecido (lista do fornecedor e `dados/suplementos-comuns.json`) por palavras contidas, como sempre foi, ou
  (2) começa, em palavras inteiras, com um item da lista comum. **Todo o resto** (inclusive o que não for reconhecido) vai
  para medicação e ergogênicos, que é dado sensível. A lista de ergogênicos sempre tem precedência. Na dúvida, a escolha
  mais conservadora. Para a regra (2) o nome é normalizado: sem acento, em minúsculas, sem texto entre parênteses e sem dose
  ou unidade (`5g`, `10.000ui`, `2 caps`, `500 mg`, `1 scoop`; "Ômega 3", "D3" e "B12" mantêm o número); entre os itens
  que casam vale o mais longo ("Whey Protein isolado" é "Whey Protein", não "Whey"); pedaço de palavra ("Zincoxxx") e
  palavra no meio do nome não casam **por esta regra**. Atenção: a regra (1) continua valendo e reconhece a palavra no meio
  ("Citrato de Magnésio"), então na planilha real o começo do nome não reconheceu nada a mais (o prefixo é um caso
  particular das palavras contidas). Para tornar a lista comum estrita (só pelo começo), tire `...comuns` de
  `suplementos` em `biblioteca-local.mjs`; na planilha real isso passa para a lista sensível os itens que têm "Magnésio"
  depois de outra palavra. O nome do suplemento na dieta não muda; a regra só decide o destino. O que sobra na lista
  sensível o treinador classifica no `classificacao-suplementos.csv` (próximo item), sem mexer em `suplementos-comuns.json`.
- **Classificação de suplementos (`classificacao-suplementos.csv`):** o conversor grava, na pasta de saída, os itens da aba
  "Suplementos" que **nenhuma lista reconhece** (os que hoje vão para Medicação e ergogênicos), um por linha, pelo nome
  normalizado (sem acento, em minúsculas, sem dose, unidade nem parênteses). Colunas (`;`, UTF-8 com BOM): `nome_normalizado`,
  `ocorrencias` e `destino` (em branco). Quem a lista de ergogênicos ou a de suplementos reconhece **não** entra; nome que
  fica vazio depois de normalizar ("500 mg") também não, e continua na lista sensível. O arquivo é sempre gravado (só com o
  cabeçalho quando não há nada a classificar). O valor de `destino` é lido sem acento, sem diferença de maiúsculas e sem
  espaços nas pontas: **suplemento** = `suplemento`, `suplementos` ou `s`; **sensível** (Medicação e ergogênicos) =
  `sensivel`, `sensível`, `medicamento`, `medicacao`, `medicação` ou `m`. Em branco = não classificado (fica na lista
  sensível). **Qualquer outro valor** é "destino não entendido": o item também fica na lista sensível, o resumo conta
  (conversor e `--simular`) e o conversor o lista no `problemas.csv` com a linha do arquivo (nunca o valor escrito). **A
  decisão é aplicada pelo importador, não pelo conversor** (os JSON não mudam): `importar-planos.mjs`
  lê o arquivo se ele estiver na pasta, recalcula o destino de cada item da lista sensível com as mesmas listas do conversor
  e só move o que nenhuma lista reconhece (a lista de ergogênicos vence sempre, mesmo se o nome normalizado for igual ao de
  uma linha `suplemento`): `suplemento` leva o item para a Suplementação (sem princípio ativo, concentração nem prescrição);
  sensível, em branco, destino não entendido ou arquivo ausente deixa na lista sensível. A Suplementação tem teto de 40 itens por
  dieta: o excedente fica na lista sensível e o resumo conta. Quem fica sem nenhum item sensível não exige
  `ERGOGENICO_ALTERAR`. Rodar o conversor de novo **preserva o `destino` já preenchido** dos nomes que continuam na planilha
  e não apaga linha preenchida de nome que sumiu (fica com 0 ocorrências); as linhas em branco são geradas de novo. Aceita o
  "CSV" comum do Excel (ANSI); arquivo sem as colunas esperadas é recusado. O resumo do `--simular` traz as contagens de itens
  classificados como suplemento, como sensível e não classificados, e, se houver, os nomes e os itens com destino não
  entendido (com as linhas do arquivo). O arquivo que o Saraiva devolve (cabeçalhos "Nome na planilha", "Quantas vezes
  aparece", "Destino") também é lido: basta salvá-lo na pasta como `classificacao-suplementos.csv`.
- **Correspondência de exercícios (`correspondencias-exercicios.csv`):** o conversor grava, na pasta de saída, os
  exercícios da planilha **sem par exato** (fora da biblioteca do Saraiva e do catálogo; mesma chave da importação: sem
  acento, caixa, pontuação e artigos, mais os apelidos do `importar.mjs`). Colunas (`;`, UTF-8 com BOM, abre no Excel):
  `nome_na_planilha`, `ocorrencias`, `sugestao_da_biblioteca`, `nota_de_semelhanca`, `confirmado` e `nome_correto` (as
  duas últimas em branco; `nome_correto` pode faltar em arquivo gerado antes dela). A sugestão
  é o nome da biblioteca do Saraiva mais parecido, com nota de 0 a 1 (média da semelhança de edição, `1 - distância de
  edição / tamanho`, com o coeficiente de Dice das palavras); abaixo de 0,5 não há sugestão (ficam em branco, nunca 0).
  O treinador responde de duas formas: `sim` em `confirmado` nas sugestões certas, ou o nome certo do exercício em
  `nome_correto` quando a sugestão está errada. `confirmado` vale como **sim** com `sim`, `s`, `x` ou `ok` e como **não**
  com `nao` ou `n` (sem acento, sem diferença de maiúsculas e sem espaços nas pontas); qualquer outro valor não é resposta.
  **O vínculo é aplicado pelo importador, não pelo conversor** (o conversor não conhece os ids da API e os JSON continuam
  com `exercicioId` nulo): `importar-planos.mjs` lê o arquivo se ele estiver na pasta e usa **só** as linhas com `sim`
  (vale a sugestão) ou com `nome_correto` (vale esse nome, procurado na biblioteca sem acento nem diferença de maiúsculas);
  se as duas estiverem preenchidas na mesma linha (`sim` e um nome), é uma **resposta em dúvida**: nenhum dos dois é usado, o resumo (conversor e `--simular`) conta e o conversor lista a linha do arquivo no `problemas.csv` (nunca o conteúdo), para o Saraiva confirmar. `não` com nome certo não é dúvida: vale o nome. Vale só para nome sem par exato. O exercício ganha o
  `exercicioId`, a modalidade e (se a planilha não trouxe) o vídeo do exercício da biblioteca, e **mantém o nome da
  planilha**. Nome certo que não existe na biblioteca (ou só no catálogo, que precisa ser importado antes) deixa o
  exercício sem par, e o resumo conta esses casos: **nunca nasce exercício novo**. Linha sem `sim` nem `nome_correto` não
  muda nada. Rodar o conversor de novo **não mexe nas linhas que já têm `confirmado` ou `nome_correto` preenchido** (nem a
  sugestão e a nota delas, porque o `sim` vale para o que o treinador viu) e não apaga linha preenchida de nome que sumiu
  da planilha (fica com 0 ocorrências); o resto é gerado de novo. Se o Excel salvar o arquivo como "CSV" comum (ANSI), a
  leitura aceita; arquivo sem as colunas esperadas é recusado. O arquivo que o Saraiva devolve (cabeçalhos "Nome na
  planilha", "Quantas vezes aparece", "Sugestão do app", "Está certo?", "Se não, qual é"; "—" na sugestão = sem sugestão)
  também é lido: basta salvá-lo na pasta como `correspondencias-exercicios.csv`.
- **Pacote para o Saraiva (`--pacote`):** o conversor grava, em `para-o-saraiva/` dentro da pasta de saída (0600), o que
  ele precisa conferir, para abrir direto no Excel do Brasil (UTF-8 com BOM, `;`; sem `--simular`; com `--simular` só
  conta): `1-suplementos.csv` (os nomes que nenhuma lista reconhece: "Nome na planilha", "Quantas vezes aparece" e "Destino",
  em branco), `2-exercicios.csv` (os exercícios sem par, do mais ao menos frequente: "Nome na planilha", "Quantas vezes
  aparece", "Sugestão do app", com "—" quando não há, "Está certo?" e "Se não, qual é", em branco), `3-o-que-corrigir.csv`
  (os problemas da planilha, por aluno, aba e linha, cada um num texto em português simples: "Aluno", "Aba", "Linha" e "O
  que corrigir"; o aluno é o da aba Alunos, senão o "Nome Aluno" da própria linha, senão o código, senão "—") e
  `mensagem.txt` (o texto que o Gustavo manda junto, com as contagens). **Esses arquivos têm nome e dado real de aluno**:
  ficam fora do repositório, nunca vão para log, chat nem grupo; seguem para o Saraiva por canal privado (e-mail ou
  WhatsApp direto). O terminal mostra só as contagens. Como o Saraiva preenche: em `1-suplementos.csv`, escreve
  `suplemento` ou `medicamento` em cada linha (em branco entra como medicamento); em `2-exercicios.csv`, escreve `sim` se
  a sugestão está certa ou o nome certo na última coluna, nunca os dois na mesma linha (em branco: entra com o nome da planilha, sem vídeo); em
  `3-o-que-corrigir.csv` só lê e ajusta a planilha original. Como volta: salvar o `1-suplementos.csv` preenchido como
  `classificacao-suplementos.csv` e o `2-exercicios.csv` como `correspondencias-exercicios.csv` na pasta do conversor
  (substituem os gerados) e rodar `importar-planos.mjs --simular`.
- **Importador:** `--simular` lê só os arquivos e o repositório e mostra contagens, entre elas quantos exercícios têm par
  na biblioteca do Saraiva, quantos só no catálogo público (precisam ser importados para a biblioteca) e quantos não têm
  par (e quantos foram ligados por `confirmado = sim` ou por `nome_correto`) e quantos suplementos foram classificados como
  suplemento, como sensível e não classificados (com a contagem de destinos não entendidos). `--gravar` cria, para cada aluno, a pasta "Importada da planilha (rascunho)" (sem datas), os planos e o rascunho
  de cada um (com o `exercicioId` quando o nome casa com a biblioteca; exercício sem par fica só com o nome, nunca é
  criado). Confere as permissões em `GET /eu` antes de gravar qualquer coisa (inclusive `ERGOGENICO_ALTERAR` quando há
  medicação) e para no primeiro erro. Rodar de novo não duplica. Nunca chama `/publicar`.
- Testes (planilha e servidor falsos montados no próprio teste): `node --test scripts/importacao/*.test.mjs`.

## Como rodar

1. Gere os dois CSV numa pasta **fora do repositório** (o script recusa uma pasta de dentro): pelo conversor (seção
   anterior) ou exportando as duas abas à mão.
2. Defina no terminal `API_URL`, `IMPORT_EMAIL` e `IMPORT_SENHA` de um Administrador (senha nunca na linha de comando;
   com a verificação em duas etapas ligada, o login do script não passa).
3. Confira: `node scripts/importacao/importar-alunos.mjs --pasta <pasta> --simular`.
4. Sem problemas na conferência, grave: o mesmo comando sem `--simular`.

## O que ele garante

- **Confere tudo antes de gravar.** Um problema em qualquer linha (código repetido, e-mail inválido, data que não existe,
  peso vazio ou absurdo, mesmo aluno duas vezes na mesma data) para a importação inteira. A mensagem cita só o arquivo, a
  linha e o campo, nunca o valor.
- **Não inventa dado.** Data inválida ou com ano estranho não é corrigida; peso vazio ou com erro de fórmula (`#REF!`)
  não vira zero. Corrija na planilha e rode de novo.
- **Rodar de novo não duplica.** Aluno com o mesmo nome (sem acento e caixa) de um que já existe é reaproveitado; peso
  da mesma data é atualizado (a API guarda um por dia). Se parar no meio, rodar de novo continua.
- **Não manda convite** e não mexe em aluno que não está na planilha.
- **Dado de aluno nunca vai para o git** nem aparece no terminal: só contagens e números de linha.

Antes da carga real, decidir com o Saraiva o período e o ano do histórico e o que fazer com linhas incompletas
(levantamento, Q51 e Q52).
