import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO } from '../tema/tokens';
import { Texto } from './Texto';

interface Props {
  children: ReactNode;
  titulo?: string;
  /** Botões do cartão, à direita do título. */
  acoes?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Cartão flat: superfície, borda só no tema claro, cantos de 8 px, sem sombra. Separa seções, dias, exercícios. */
export function Cartao({ children, titulo, acoes, style }: Props) {
  const { cores, modo } = useTema();
  return (
    <View style={[estilos.cartao, { backgroundColor: cores.superficie, borderColor: cores.borda, borderWidth: modo === 'CLARO' ? 1 : 0 }, style]}>
      {titulo || acoes ? (
        <View style={estilos.topo}>
          {titulo ? <Texto variante="secao" style={estilos.titulo}>{titulo}</Texto> : <View />}
          {acoes ? <View style={estilos.acoes}>{acoes}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1) },
  titulo: { flexShrink: 1 },
  acoes: { flexDirection: 'row', gap: espaco(1), flexWrap: 'wrap' },
});
