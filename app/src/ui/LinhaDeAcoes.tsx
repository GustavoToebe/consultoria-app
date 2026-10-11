import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { espaco } from '../tema/tokens';

interface Props {
  children: ReactNode;
  /** `fim` alinha à direita (rodapés); `inicio` (padrão) à esquerda; `entre` separa dois grupos. */
  alinhar?: 'inicio' | 'fim' | 'entre';
  style?: StyleProp<ViewStyle>;
}

/**
 * Botões lado a lado que quebram linha quando não cabem e nunca passam da largura do cartão (o rodapé "Salvar como
 * modelo · Remover sessão" estourava o cartão no celular). Toda fila de dois ou mais `Botao` usa isto.
 */
export function LinhaDeAcoes({ children, alinhar = 'inicio', style }: Props) {
  return (
    <View style={[estilos.linha, alinhar === 'fim' && estilos.fim, alinhar === 'entre' && estilos.entre, style]}>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), maxWidth: '100%' },
  fim: { justifyContent: 'flex-end' },
  entre: { justifyContent: 'space-between' },
});
