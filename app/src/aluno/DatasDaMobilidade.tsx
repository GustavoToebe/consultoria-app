import { StyleSheet, View } from 'react-native';

import { dataCurta } from '../dominio/formatos';
import { espaco } from '../tema/tokens';
import { ChipData } from './DatasDaDivisao';

/**
 * Chips com os últimos dias para marcar a mobilidade ("Hoje · 19/10", "18/10"...), no estilo das "Outras datas" do
 * treino. O ✓ verde diz que o dia tem algum item feito; o dia aberto fica marcado e não toca de novo.
 */
export function DatasDaMobilidade({
  datas,
  hoje,
  atual,
  comAlgoFeito,
  aoAbrir,
}: {
  datas: string[];
  hoje: string;
  /** A data que a tela está mostrando. */
  atual: string;
  comAlgoFeito: (data: string) => boolean;
  aoAbrir: (data: string) => void;
}) {
  return (
    <View style={estilos.chips}>
      {datas.map((d) => (
        <ChipData
          key={d}
          rotulo={d === hoje ? `Hoje · ${dataCurta(d)}` : dataCurta(d)}
          descricao={`Mobilidade, ${dataCurta(d)}`}
          hoje={d === hoje}
          atual={d === atual}
          feito={comAlgoFeito(d)}
          ativo
          aoTocar={() => aoAbrir(d)}
        />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({ chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) } });
