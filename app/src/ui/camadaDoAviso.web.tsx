import type { ReactNode, ReactPortal } from 'react';

// O app não tem os tipos do react-dom (vem com o react-native-web); só o `createPortal` é usado.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createPortal } = require('react-dom') as { createPortal: (filhos: ReactNode, no: Element) => ReactPortal };

/**
 * Nó próprio do aviso no fim do `body`, fora da raiz do app. Os `Modal` do react-native-web (menus, Calendário, seleções)
 * são nós no `body` sem z-index e a confirmação (`PainelConfirmacao`) usa `z-50`: com este z-index o aviso fica por cima
 * de todos. Fica abaixo só da cópia do arrastar (`ui/arrasteNaWeb`, 2147483000). Criado uma vez.
 */
let no: HTMLDivElement | null = null;

function noDoAviso(): HTMLDivElement {
  if (!no) {
    const novo = document.createElement('div');
    novo.setAttribute('data-camada', 'aviso');
    Object.assign(novo.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147482999' });
    // A confirmação esconde do leitor de tela o resto do `body` (aria-hidden); o aviso não pode sumir junto.
    new MutationObserver(() => {
      if (novo.hasAttribute('aria-hidden')) novo.removeAttribute('aria-hidden');
      if (novo.hasAttribute('inert')) novo.removeAttribute('inert');
    }).observe(novo, { attributes: true, attributeFilter: ['aria-hidden', 'inert'] });
    no = novo;
  }
  if (!no.isConnected) document.body.appendChild(no);
  return no;
}

export function CamadaDoAviso({ children }: { children: ReactNode }) {
  return typeof document === 'undefined' ? children : createPortal(children, noDoAviso());
}
