import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';

/**
 * Fio de 1 px entre partes de um mesmo bloco (no lugar de mais uma caixa: "nos níveis de dentro, divisor ou recuo",
 * §5.1 do design). Decorativo: o leitor de tela não o anuncia.
 */
export function Divisor({ style }: { style?: StyleProp<ViewStyle> }) {
  const { cores } = useTema();
  return <View aria-hidden style={[{ height: 1, backgroundColor: cores.divisor }, style]} />;
}
