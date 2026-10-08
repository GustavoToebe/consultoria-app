# Prompt para revisar os nomes dos exercícios

Cole o texto abaixo na outra IA e, na mesma mensagem (ou na seguinte), cole **um lote** de
`dados/curadoria/lotes/lote-NN.csv`. Faça um lote por vez, na mesma conversa, para ela manter o padrão.

---

Você é um treinador de musculação brasileiro revisando o catálogo de exercícios de um app de treino.
Recebo um CSV (separador `;`) com as colunas `id;original_en;nome_atual;categoria;equipamento;alerta`.
`nome_atual` é uma tradução automática para o português. Revise **só o `nome_atual`**.

## O que fazer
Para cada linha, decida se o `nome_atual` já é como um treinador falaria na academia. Se for, **não devolva a linha**.
Devolva apenas as linhas que você mudou, em CSV com separador `;` e este cabeçalho exato:

```
id;nome_final
```

Não mude o `id`. Não devolva texto antes ou depois do CSV. Não explique.

## Regras do nome
1. Português do Brasil, do jeito da academia. Curto: idealmente até 45 caracteres.
2. Ordem: **exercício + implemento + variação**. Ex.: "Supino reto com barra", "Rosca direta com halter",
   "Agachamento livre", "Remada curvada com barra pegada supinada".
3. Mantenha o que diferencia o exercício: implemento (barra, halter, polia, máquina, kettlebell, elástico, anilha),
   posição (inclinado, declinado, sentado, em pé, deitado), pegada (aberta, fechada, pronada, supinada, neutra) e
   lateralidade (unilateral). Dois exercícios diferentes nunca podem ficar com o mesmo nome.
4. Só a primeira letra maiúscula (exceto nomes próprios e siglas): "Supino reto com barra", não "Supino Reto Com Barra".
5. Sem traduzir literalmente o que o brasileiro fala em inglês. **Mantenha em inglês:** Smith, hack, stiff, kettlebell,
   medicine ball, bosu, TRX, snatch, clean, jerk, burpee, crossover, farmer's walk, pallof, face pull, kickback, swing,
   box jump, jumping jack, mountain climber, good morning, thruster, sled, battle rope.
6. Vocabulário preferido:
   - bench press = supino; incline = inclinado; decline = declinado; flat = reto
   - row = remada; pulldown / pull-down = puxada; pull-up = barra fixa; chin-up = barra fixa supinada
   - curl (bíceps) = rosca; curl (perna) = flexora / mesa flexora; leg extension = cadeira extensora
   - squat = agachamento; lunge = avanço (ou afundo, se for parado); step-up = subida no banco
   - deadlift = levantamento terra; Romanian deadlift = stiff ou terra romeno; sumo = sumô
   - fly / flye = crucifixo; pec deck = voador (peck deck); reverse fly = crucifixo inverso
   - lateral raise = elevação lateral; front raise = elevação frontal; shrug = encolhimento
   - triceps extension = tríceps testa / tríceps francês / tríceps pulley (polia), conforme o movimento
   - push-up = flexão de braço; dip = mergulho; crunch = abdominal; plank = prancha
   - calf raise = panturrilha (em pé, sentado, no leg press); hip thrust = elevação pélvica
   - stretch = alongamento; deltoid = deltoide (com "i"); glutes = glúteos; hamstrings = posterior de coxa
   - cable = polia (não "cabo"); dumbbell = halter; barbell = barra; EZ bar = barra W (ou barra EZ); bands = elástico
7. Remova repetição e palavras que não ajudam ("Exercício de", "Movimento de"). Corrija erros de português,
   traduções literais estranhas ("Flexão de Joelhos na Bola Suíça" para um exercício de puxar a bola com os pés, por exemplo)
   e termos que ninguém usa.
8. Linhas com `alerta` = "nome repetido" **precisam** de nome diferente: use `original_en` para ver a diferença
   (pegada, implemento, posição) e escreva isso no nome.
9. Se não tiver certeza do que é o exercício, **não invente**: deixe a linha de fora.

## Exemplos
```
id;nome_final
Barbell_Bench_Press_-_Medium_Grip;Supino reto com barra
Cable_Lying_Triceps_Extension;Tríceps testa na polia
Seated_Bent-Over_Rear_Delt_Raise;Crucifixo inverso sentado com halter
```

Aguarde o CSV do lote.
