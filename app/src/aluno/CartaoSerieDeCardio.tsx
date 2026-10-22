import { StyleSheet, View } from 'react-native';

import type { Serie } from '../api/tipos';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { BotaoMarcar } from '../ui/BotaoMarcar';
import { Texto } from '../ui/Texto';
import { linhasDoCardio } from './serieDoAluno';

/**
 * Série de cardio: a prescrição (duração, distância, ritmo, zona, intervalos) e um único gesto, marcar "feito". Não há
 * peso, repetições nem esforço; o registro vai com carga e repetições nulas, como qualquer série sem esses valores.
 */
export function CartaoSerieDeCardio({
  serie,
  numero,
  feita,
  ultimaDoExercicio,
  aoMarcar,
}: {
  serie: Serie;
  numero: number;
  feita: boolean;
  ultimaDoExercicio: boolean;
  aoMarcar: (concluida: boolean) => void;
}) {
  const { cores } = useTema();
  const linhas = linhasDoCardio(serie.cardio);
  return (
    <View style={[estilos.serie, { borderColor: feita ? cores.sucesso : cores.borda, backgroundColor: feita ? `${cores.sucesso}29` : cores.superficie2 }]}>
      <View style={estilos.linha}>
        <View style={estilos.textos}>
          <Texto style={estilos.nome}>Série {numero}</Texto>
          {linhas.length ? linhas.map((l) => <Texto key={l} numerico>{l}</Texto>) : <Texto numerico>—</Texto>}
        </View>
        <BotaoMarcar
          feito={feita}
          ultimaDoExercicio={ultimaDoExercicio}
          rotulo={`Cardio da série ${numero} feito`}
          aoTocar={() => aoMarcar(!feita)}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  serie: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5) },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  textos: { flex: 1, minWidth: 0, gap: 2 },
  nome: { fontFamily: fontes.semi, fontSize: 16 },
});
