import { Children, useState, type ReactNode } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { colunasPorLargura } from '../dominio/grade';
import { espaco } from '../tema/tokens';

/**
 * Itens de uma lista em colunas, pela largura da própria grade (medida com onLayout, como o cartão do Progresso):
 * 1 coluna abaixo de 760 px, 2 a partir de 760 e 3 a partir de 1240. Cada filho ocupa uma célula de largura igual;
 * `gap` é o espaço entre itens (o mesmo da lista que a grade substitui). Sem medida ainda, 1 coluna.
 */
export function Grade({ children, gap = espaco(1) }: { children: ReactNode; gap?: number }) {
  const [largura, setLargura] = useState(0);
  const colunas = colunasPorLargura(largura);
  const itens = Children.toArray(children);
  const aoMedir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);
  // Largura exata da célula: o espaço total entre colunas sai da largura medida. A mesma árvore em 1 e em várias colunas
  // (cada item numa célula com a mesma chave): passar de 1 para 2 colunas depois da medida não remonta os campos, que
  // perderiam o foco e o que estava sendo digitado.
  const celula = colunas === 1 ? undefined : (largura - gap * (colunas - 1)) / colunas;
  return (
    <View onLayout={aoMedir} style={[colunas === 1 ? null : estilos.linha, { gap }]}>
      {itens.map((item, i) => <View key={i} style={celula === undefined ? undefined : { width: celula }}>{item}</View>)}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
});
