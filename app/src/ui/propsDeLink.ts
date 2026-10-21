import { Link, type Href } from 'expo-router';
import { Platform, type GestureResponderEvent } from 'react-native';

import { deixarParaONavegador, type CliqueDoNavegador } from '../dominio/cliqueDeLink';

type ComPreventDefault = CliqueDoNavegador & { preventDefault?: () => void };

/**
 * Props de um item que abre outra tela. Na web vira `<a href>`: o clique direito oferece "Abrir link em uma nova guia" e
 * Ctrl/Cmd+clique e o botão do meio funcionam; o clique simples segue por `navegar` (que passa pela guarda de saída do
 * editor). No celular é só o `onPress`. Quem já tem `aoTocar` passa a própria navegação em `navegar`.
 */
export function propsDeLink(href: Href, navegar: () => void) {
  if (Platform.OS !== 'web') return { onPress: navegar };
  return {
    href: Link.resolveHref(href),
    onPress: (evento: GestureResponderEvent) => {
      const clique = evento as unknown as ComPreventDefault;
      if (deixarParaONavegador(clique)) return;
      clique.preventDefault?.();
      navegar();
    },
  };
}
