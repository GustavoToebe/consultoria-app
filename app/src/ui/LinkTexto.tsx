import { Link, router, type Href } from 'expo-router';
import { StyleSheet } from 'react-native';

import { deixarParaONavegador, type CliqueDoNavegador } from '../dominio/cliqueDeLink';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, fontes } from '../tema/tokens';
import { useSaidaGuardada } from './GuardaDeSaida';
import { Texto } from './Texto';

/**
 * Link de texto: cor do texto e sublinhado (contraste AA em qualquer tema, com ou sem marca); alvo de 44 px. Com uma
 * alteração não salva na tela (guarda de saída), o clique simples pergunta antes de sair: o `Link` não navega quando o
 * toque chega com `preventDefault` (web e celular), e a navegação segue pelo `confirmar`. Sem nada pendente, é o `Link`
 * de sempre (Ctrl+clique e botão do meio abrem outra guia na web).
 */
export function LinkTexto({ href, texto }: { href: Href; texto: string }) {
  const { cores } = useTema();
  const { confirmar, pendente } = useSaidaGuardada();
  const aoTocar = (clique: CliqueDoNavegador & { preventDefault?: () => void }) => {
    if (!pendente() || deixarParaONavegador(clique)) return;
    clique.preventDefault?.();
    confirmar(() => router.navigate(href));
  };
  return (
    <Link href={href} accessibilityRole="link" style={estilos.alvo} onPress={aoTocar}>
      <Texto style={[estilos.texto, { color: cores.texto }]}>{texto}</Texto>
    </Link>
  );
}

const estilos = StyleSheet.create({
  alvo: { minHeight: ALVO_TOQUE, paddingVertical: 11, justifyContent: 'center' },
  texto: { fontFamily: fontes.semi, textDecorationLine: 'underline' },
});
