import { useEffect, useRef, type RefObject } from 'react';
import { Platform } from 'react-native';

/** Chamado a cada tecla enquanto ativo. Devolver `true` diz que a tecla foi tratada (o navegador não faz o padrão dela). */
export type AoTeclar = (evento: { key: string; ctrl: boolean }) => boolean | void;

/**
 * Escuta o teclado da página inteira enquanto `ativo` (só na web; no celular não há teclado de atalhos).
 * O ouvinte sai quando a tela desmonta ou `ativo` muda.
 */
export function useTeclado(ativo: boolean, aoTeclar: AoTeclar): void {
  const ultimo = useRef(aoTeclar);
  useEffect(() => {
    ultimo.current = aoTeclar;
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || !ativo) return undefined;
    const ouvir = (e: KeyboardEvent) => {
      const tratada = ultimo.current({ key: e.key, ctrl: e.ctrlKey || e.metaKey });
      if (tratada) e.preventDefault();
    };
    document.addEventListener('keydown', ouvir);
    return () => document.removeEventListener('keydown', ouvir);
  }, [ativo]);
}

/** Chama `aoFora` quando o clique cai fora do elemento de `ref` (só na web), enquanto `ativo`. */
export function useCliqueFora(ref: RefObject<unknown>, ativo: boolean, aoFora: () => void): void {
  const ultimo = useRef(aoFora);
  useEffect(() => {
    ultimo.current = aoFora;
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || !ativo) return undefined;
    const ouvir = (e: MouseEvent) => {
      const elemento = ref.current as HTMLElement | null;
      if (elemento && e.target instanceof Node && !elemento.contains(e.target)) ultimo.current();
    };
    document.addEventListener('mousedown', ouvir);
    return () => document.removeEventListener('mousedown', ouvir);
  }, [ref, ativo]);
}
