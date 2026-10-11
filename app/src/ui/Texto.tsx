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
  /**
   * Nível de título para o leitor de tela (h1 a h3). Explícito, não derivado da variante: a tela tem um h1 (o
   * `Cabecalho`), cartões e folhas têm h2 e subtítulos dentro deles h3.
   */
  nivel?: 1 | 2 | 3;
}

export function Texto({ variante = 'corpo', cor, numerico, nivel, style, ...resto }: Props) {
  const { cores, fatorTexto } = useTema();
  const padrao = variante === 'suave' || variante === 'secao' || variante === 'pequeno' || variante === 'rotulo' ? cores.textoSuave : cores.texto;
  // O tamanho do texto da pessoa multiplica fonte e altura de linha, inclusive os tamanhos fixos passados em `style`.
  const estilo = StyleSheet.flatten([ESTILOS_TEXTO[variante], numerico && NUMERICO, { color: cor === 'suave' ? cores.textoSuave : cor ?? padrao }, style]);
  if (fatorTexto !== 1 && estilo.fontSize) {
    estilo.fontSize = escalar(estilo.fontSize, fatorTexto);
    if (estilo.lineHeight) estilo.lineHeight = escalar(estilo.lineHeight, fatorTexto);
  }
  const titulo = nivel ? { role: 'heading' as const, 'aria-level': nivel } : null;
  return <Text maxFontSizeMultiplier={1.5} {...titulo} {...resto} style={estilo} />;
}
