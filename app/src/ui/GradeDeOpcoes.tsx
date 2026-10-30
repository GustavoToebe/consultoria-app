import { Children, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { Texto } from './Texto';

interface Props {
  rotulo: string;
  /** Um `OpcaoCartao` por filho. */
  children: ReactNode;
  descricao?: string;
}

/** Grupo de opções (`radiogroup`): 1 coluna abaixo de 700 px e 2 colunas acima. */
export function GradeDeOpcoes({ rotulo, descricao, children }: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const colunas = width >= 700 ? 2 : 1;
  return (
    <View style={estilos.grupo}>
      <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto>
      {descricao ? <Texto variante="pequeno">{descricao}</Texto> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel={rotulo} style={estilos.grade}>
        {Children.toArray(children).map((filho, i) => (
          <View key={i} style={colunas === 2 ? estilos.metade : estilos.inteira}>
            {filho}
          </View>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco(0.75) },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  metade: { flexBasis: '48%', flexGrow: 1, minWidth: 260 },
  inteira: { width: '100%' },
});
