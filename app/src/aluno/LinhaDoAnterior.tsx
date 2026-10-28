import { StyleSheet, View } from 'react-native';

import { espaco, fontes } from '../tema/tokens';
import { Texto } from '../ui/Texto';

/**
 * "Anterior 60 kg × 8": a mesma série da última vez (coluna "Anterior", Engajamento 0.3), no cartão da série simples e
 * no da série com etapas. "—" = a série não casou com nenhuma da última vez (ou não foi feita).
 */
export function LinhaDoAnterior({ texto, numero }: { texto: string; numero: number }) {
  return (
    <View style={estilos.linha} accessible accessibilityLabel={`Série ${numero} da última vez: ${texto === '—' ? 'sem registro' : texto}`}>
      <Texto variante="pequeno" style={estilos.rotulo}>Anterior</Texto>
      <Texto numerico variante="pequeno">{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'baseline', gap: espaco(0.75), flexWrap: 'wrap' },
  rotulo: { fontFamily: fontes.semi },
});
