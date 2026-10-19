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
