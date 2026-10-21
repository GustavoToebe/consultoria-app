/** O que a regra precisa ler de um clique do navegador (o evento do react-native-web tem estes campos). */
export interface CliqueDoNavegador {
  button?: number | null;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/**
 * Num link da web, o clique simples navega dentro do app, mas Ctrl/Cmd/Shift + clique (nova guia ou janela) e qualquer
 * botão que não seja o esquerdo ficam com o navegador, que abre o `href`. Mesmo critério do `Link` do Expo Router.
 */
export function deixarParaONavegador(clique: CliqueDoNavegador): boolean {
  if (clique.ctrlKey || clique.metaKey || clique.shiftKey || clique.altKey) return true;
  return clique.button != null && clique.button !== 0;
}
