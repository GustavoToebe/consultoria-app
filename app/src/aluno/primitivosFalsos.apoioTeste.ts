/**
 * Módulo falso para os `@rn-primitives/*` nos testes de tela do Jest: o pacote vem em JSX que o Jest não transforma e o teste
 * só precisa que cada peça repasse os filhos. Nunca importado pelo app.
 */
export function primitivosFalsos(): unknown {
  return new Proxy({}, { get: (_alvo, chave) => (chave === '__esModule' ? true : (props: { children?: unknown }) => props.children ?? null) });
}
