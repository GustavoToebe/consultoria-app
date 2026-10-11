import { Link, type Href } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, fontes } from '../tema/tokens';
import { Texto } from './Texto';

/** Link de texto: cor do texto e sublinhado (contraste AA em qualquer tema, com ou sem marca); alvo de 44 px. */
export function LinkTexto({ href, texto }: { href: Href; texto: string }) {
  const { cores } = useTema();
  return (
    <Link href={href} accessibilityRole="link" style={estilos.alvo}>
      <Texto style={[estilos.texto, { color: cores.texto }]}>{texto}</Texto>
    </Link>
  );
}

const estilos = StyleSheet.create({
  alvo: { minHeight: ALVO_TOQUE, paddingVertical: 11, justifyContent: 'center' },
  texto: { fontFamily: fontes.semi, textDecorationLine: 'underline' },
});
