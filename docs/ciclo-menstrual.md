# Ciclo menstrual

O acompanhamento é opcional e só existe quando o sexo do cadastro é Feminino. Só a aluna liga, grava e apaga. O treinador lê, se tiver acesso a dados sensíveis.

A API guarda datas, fluxo, cólica, sintomas e observação. Ela não calcula fase, não avisa e não muda treino nem dieta.

## Estimativa, só no app

Arquivo `app/src/dominio/cicloMenstrual.ts`. Sem dado, a tela mostra "—".

1. A duração do ciclo é a média das diferenças de 21 a 45 dias entre os inícios, usando até os seis últimos intervalos válidos. Sem nenhum, vale a duração habitual (21 a 45). Sem as duas, não há fase estimada: só "Dia N do ciclo", contado do último início.
2. A duração da menstruação é a média dos registros que já têm fim. Ela só entra na previsão. O passado usa o fim registrado.
3. Fases, do início `I` até a véspera do próximo início `P`:
   - Menstrual: de `I` até o fim registrado. Em andamento, até hoje.
   - Ovulatória: o dia `P − 14`.
   - Folicular: do dia seguinte à menstrual até a véspera da ovulatória.
   - Lútea: do dia seguinte à ovulatória até `P − 1`.
   - No ciclo atual, `P` é o último início mais a duração. No ciclo passado, `P` é o próximo início real.
   - Ciclo real fora de 21 a 45 dias fica só com a menstrual.
4. Último início há mais de 60 dias: sem previsão. A tela diz "Sem registro recente".
5. Com "Mostrar fases estimadas" desligado, só a menstruação registrada e o dia do ciclo.

Exemplo de 28 dias, inícios em 01/01 e 29/01, menstruação até o dia 5: 03/01 é menstrual, 10/01 é folicular, 15/01 é ovulatória e 20/01 é lútea.

## O que fica de fora

Não há lembrete nem notificação da menstruação prevista. O treinador não registra data nem sintoma. Não há gráfico de sintomas nem relação automática entre sintoma e fase. Nada do ciclo fica no aparelho. O app não ajusta treino nem dieta por fase.
