# S6. Aluno: Início e treino do dia

Prévia: `aluno-inicio.html`, `aluno-treino.html` (sessão e exercício) · Plano: [visual-vendavel.md](../visual-vendavel.md)

## O problema
- **Início:** cartão "Hoje" em vermelho chapado com três linhas de texto, "Sua semana 0 de 0 treinos" e cerca de 60% da
  tela vazia. Não vende o produto nem diz o que falta fazer.
- **Sessão do dia:** lista de cartões iguais; "0/3 SÉRIES" num selo cinza; nenhuma cor de tipo de série.
- **Exercício:** três parágrafos de explicação antes da primeira série; a sugestão de carga aparece em três linhas
  ("Sugestão: 53 kg", "85% da última vez", botão "Usar sugestão: 53 kg"); todas as séries têm o mesmo peso visual.

## A proposta

### Início
1. **Cartão "Hoje" mais rico** (continua sendo o único sólido da marca e o único botão principal): sobretítulo "HOJE ·
   TERÇA", nome da sessão em 24 px, linha "5 exercícios · 14 séries · cerca de 55 min" (duração só se houver histórico;
   senão não aparece), botão "Começar treino". Treino em andamento: barra "6 de 14 séries" e botão "Continuar".
   Concluído: selo "Concluído" e "Ver resumo".
2. **"Sua semana" em sete dias:** uma fileira D S T Q Q S S; dia treinado preenchido com a letra da divisão na cor dela
   (D13 de 03/11 limitou essa cor ao Histórico: estender ao Início é decisão do Gustavo; sem o ok, fica neutro),
   hoje com anel da `marcaTexto`, futuro vazio. Embaixo "2 de 4 treinos".
3. **Atalhos em grade de dois** no lugar do vazio: Dieta de hoje (próxima refeição e horário), Água, Mobilidade,
   Atualização (com a data), cada um com ícone, uma linha e, quando pede ação, selo de status.
4. Ordem fixa: Hoje, Semana, pendências (anamnese, atualização, pagamento, como hoje em `ParaFazer`), atalhos.

### Sessão do dia
1. Topo: "Exercício 0 de 5" e barra de progresso de séries na `marcaTexto`.
2. Cada exercício: nome, `BarraDeComposicao` (S2) com as séries feitas preenchidas, "Última carga 52 kg" à direita.
   Exercício concluído: ✓ verde e o cartão recolhe para uma linha.
3. O próximo exercício a fazer é o único com contorno `marcaBorda`.

### Exercício
1. **Uma linha de sugestão**, sem mudar a regra de 02/11 (a sugestão é dica; o campo nasce vazio; o ✓ abre o painel
   "Fez com 53 kg?"): "Sugestão 53 kg · 85% da última vez" numa linha só, e o botão vira ação curta "Usar 53 kg" ao lado
   do campo. De três linhas para uma.
2. **Explicação recolhida:** o cartão "Carga de trabalho (WS)" mostra o campo e uma frase; o resto atrás de "Como
   funciona".
3. **A série de trabalho em destaque** (S2): cabeçalho tingido da cor do tipo; aquecimento e preparação mais compactos.
4. **Série feita** recolhe para uma linha ("✓ FS 1 · 45 kg × 12"), tocável para corrigir.
5. Rodapé fixo com "Próximo: Supino inclinado" (principal) e "Exercício 2 de 5".

## Onde mexer
| Arquivo | O que muda |
| --- | --- |
| `app/src/aluno/CartaoHoje.tsx:28-94` | conteúdo do cartão; estados em andamento e concluído |
| `app/src/aluno/ProgressoSemana.tsx:32` e `app/src/dominio/progressoSemana.ts` | fileira de sete dias (a regra dos dias já existe para a "semana completa") |
| `app/src/app/aluno/index.tsx`, `aluno/SecaoDoInicio.tsx`, `aluno/CartaoDietaDoInicio.tsx`, `aluno/ParaFazer.tsx` | grade de atalhos e ordem |
| `app/src/aluno/ExerciciosDoDia.tsx`, `CartaoExercicioDoDia.tsx:62-63` | progresso, composição, recolher o concluído |
| `app/src/aluno/ExercicioAluno.tsx:214-220` (cartão da carga de trabalho), `:410` (barra), `:556` ("Usar sugestão") | itens 1 a 4 |
| `app/src/aluno/CartaoSerieComEtapas.tsx:100,207`, `PartesDaSerie.tsx` | a mesma linha de sugestão nas séries com etapas |
| `app/src/aluno/FaixaDoTreino.tsx` | já mostra duração, volume e "N/M": conferir que não duplica o progresso novo (com o retorno ligado, vale a faixa) |

Nada na API. Nada no armazenamento offline: é só exibição do que o pacote já traz.

## Testes
- Os testes `ExercicioAluno.cargas.test.tsx` leem o texto da dica ("Sugestão: 36,5 kg × 3 reps (+0,5 kg) · Última vez:
  36 kg × 6"). Se o texto mudar, os testes mudam junto; a regra em `dominio/cargas.ts` não muda.
- `dominio/progressoSemana` com o caso de plano sem dia fixo (não mostra os sete dias, só a contagem).
- E2e da execução (`concluir-treino`, `treino-ao-vivo`, `recordes-pessoais`) em 390; a prévia do treinador ("Ver como o
  aluno") usa as mesmas peças e tem de continuar com o ✓ desabilitado.

## Atenção
Tela usada na academia, com uma mão e sem internet: alvo de toque de 44 px, nada que dependa de hover, e nenhum
elemento novo que só exista online.
