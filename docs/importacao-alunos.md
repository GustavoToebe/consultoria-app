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

## Como rodar

1. Exporte as duas abas da planilha para CSV numa pasta **fora do repositório** (o script recusa uma pasta de dentro).
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
