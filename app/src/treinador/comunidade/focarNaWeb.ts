import { Platform } from 'react-native';

/**
 * Web: depois que um item anda (ou o campo de renomear sai) o elemento focado some do DOM e o foco cairia no `body`
 * (conferido no e2e); volta ao botão com este nome acessível. No nativo o leitor de tela segue o elemento.
 */
export function focarNaWeb(rotulo: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.querySelector<HTMLElement>(`[aria-label="${CSS.escape(rotulo)}"]`)?.focus();
}
