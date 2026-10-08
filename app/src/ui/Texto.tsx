import { Text, type TextProps } from 'react-native';
import { useTema } from '../tema/TemaProvider';
import { ESTILOS_TEXTO, NUMERICO, type Variante } from './tipografia';
export type { Variante } from './tipografia';

interface Props extends TextProps {
  variante?: Variante;
  cor?: string;
  numerico?: boolean;
}

export function Texto({ variante = 'corpo', cor, numerico, style, ...resto }: Props) {
  const { cores } = useTema();
  const padrao = variante === 'secao' || variante === 'pequeno' ? cores.textoSuave : cores.texto;
  return <Text {...resto} style={[ESTILOS_TEXTO[variante], numerico && NUMERICO, { color: cor === 'suave' ? cores.textoSuave : cor ?? padrao }, style]} />;
}
