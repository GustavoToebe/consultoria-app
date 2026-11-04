import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const CONSULTA = '(hover: hover) and (pointer: fine)';

function consulta(): MediaQueryList | null {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA) : null;
}

function assinar(ouvir: () => void): () => void {
  const lista = consulta();
  lista?.addEventListener('change', ouvir);
  return () => lista?.removeEventListener('change', ouvir);
}

const atual = () => consulta()?.matches ?? false;

/**
 * Se o aparelho tem mouse (passa por cima e aponta fino): o que só aparece no hover precisa de outro caminho sem ele.
 * No celular nativo é sempre `false`; na web segue a mídia `(hover: hover) and (pointer: fine)` e muda junto com ela.
 */
export const useComMouse = (): boolean => useSyncExternalStore(assinar, atual, () => false);
