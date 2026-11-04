import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';
import { Texto } from './Texto';

/**
 * Número numa caixinha de 28 px (posição do item na lista do editor, número da série aberta): claro no comum e invertido
 * (fundo `texto`, letra `fundo`) no escolhido, a seleção invertida do app. Decorativo: quem o usa diz o número no rótulo
 * ou no título ao lado. Cresce com o texto da pessoa e com dois dígitos.
 */
export function NumeroInvertido({ numero, invertido }: { numero: number; invertido: boolean }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.caixa, invertido ? { backgroundColor: cores.texto, borderColor: cores.texto } : { backgroundColor: cores.superficie, borderColor: cores.bordaCampo }]}
      aria-hidden>
      <Texto numerico style={[estilos.texto, { color: invertido ? cores.fundo : cores.texto }]}>{numero}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { minWidth: 28, minHeight: 28, paddingHorizontal: 4, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  texto: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 16 },
});
