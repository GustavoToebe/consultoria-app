import { StyleSheet, type TextProps } from 'react-native';

import { escalar } from '../dominio/preferencias';
import { Text } from '../components/ui/text';
import { useTema } from '../tema/TemaProvider';
import { ESTILOS_TEXTO, NUMERICO, type Variante } from './tipografia';
export type { Variante } from './tipografia';

interface Props extends TextProps {
  variante?: Variante;
  cor?: string;
  numerico?: boolean;
}

export function Texto({ variante = 'corpo', cor, numerico, style, ...resto }: Props) {
  const { cores, fatorTexto } = useTema();
  const padrao = variante === 'suave' || variante === 'secao' || variante === 'pequeno' || variante === 'rotulo' ? cores.textoSuave : cores.texto;
  // O tamanho do texto da pessoa multiplica fonte e altura de linha, inclusive os tamanhos fixos passados em `style`.
  const estilo = StyleSheet.flatten([ESTILOS_TEXTO[variante], numerico && NUMERICO, { color: cor === 'suave' ? cores.textoSuave : cor ?? padrao }, style]);
  if (fatorTexto !== 1 && estilo.fontSize) {
    estilo.fontSize = escalar(estilo.fontSize, fatorTexto);
    if (estilo.lineHeight) estilo.lineHeight = escalar(estilo.lineHeight, fatorTexto);
  }
  return <Text maxFontSizeMultiplier={1.5} {...resto} style={estilo} />;
}
