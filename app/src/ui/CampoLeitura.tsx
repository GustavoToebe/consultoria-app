import { StyleSheet, View } from 'react-native';

import { espaco } from '../tema/tokens';
import { Texto } from './Texto';

/** Rótulo pequeno em cima e valor embaixo, só leitura; sem valor mostra "—" (nunca inventa). Par do `Campo`. */
export function CampoLeitura({ rotulo, valor, numerico }: { rotulo: string; valor: string | number | null | undefined; numerico?: boolean }) {
  const texto = valor === null || valor === undefined || valor === '' ? '—' : String(valor);
  return (
    <View style={estilos.campo} accessibilityLabel={`${rotulo}: ${texto}`}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <Texto numerico={numerico}>{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({ campo: { gap: espaco(0.25) } });
