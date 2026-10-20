import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { espaco } from '../tema/tokens';

/**
 * Pares "rótulo / valor" (`CampoLeitura`) lado a lado, quebrando linha quando não cabem: quatro numa linha no PC, dois
 * no celular. Para resumos curtos (valor, periodicidade, vencimento) que, um embaixo do outro, viravam uma coluna alta e
 * vazia. Cada item tem a mesma largura mínima, então as colunas se alinham entre linhas.
 */
export function CamposEmLinha({ children, minimo = 150 }: { children: ReactNode; minimo?: number }) {
  const itens = Children.toArray(children);
  return (
    <View style={estilos.linha}>
      {itens.map((item, i) => <View key={i} style={[estilos.item, { flexBasis: minimo }]}>{item}</View>)}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(1.5) },
  item: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
});
