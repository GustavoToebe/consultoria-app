import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';
import { Texto } from './Texto';

/**
 * Número numa caixinha de 28 px (posição do item na lista do editor, número da série aberta). Com `invertido` (o item
 * escolhido) vale a seleção neutra de 11/11 (`ui/selecao.ts`): `superficie3` com o contorno forte; o comum fica no
 * cartão com o filete discreto e o número em texto secundário. O nome ficou da seleção invertida que substituiu.
 * Decorativo: quem o usa diz o número no rótulo ou no título ao lado. Cresce com o texto da pessoa e com dois dígitos.
 */
export function NumeroInvertido({ numero, invertido }: { numero: number; invertido: boolean }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.caixa, invertido ? { backgroundColor: cores.superficie3, borderColor: cores.bordaCampo } : { backgroundColor: cores.superficie, borderColor: cores.divisor }]}
      aria-hidden>
      <Texto numerico style={[estilos.texto, { color: invertido ? cores.texto : cores.textoSuave }]}>{numero}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { minWidth: 28, minHeight: 28, paddingHorizontal: 4, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  texto: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 16 },
});
