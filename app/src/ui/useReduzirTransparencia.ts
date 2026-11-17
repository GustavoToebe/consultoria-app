import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * "Reduzir transparência" do aparelho (acompanha mudanças com o app aberto): no iPhone pela Acessibilidade; na web por
 * `prefers-reduced-transparency`. O Android não expõe a preferência ao React Native: lá fica sempre `false`.
 */
export function useReduzirTransparencia(): boolean {
  const [reduzir, definir] = useState(() => consultaDaWeb()?.matches ?? false);
  useEffect(() => {
    const lista = consultaDaWeb();
    if (lista) {
      const aoMudar = (e: MediaQueryListEvent) => definir(e.matches);
      lista.addEventListener?.('change', aoMudar);
      return () => lista.removeEventListener?.('change', aoMudar);
    }
    if (Platform.OS !== 'ios') return undefined;
    let ativo = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then((valor) => { if (ativo) definir(valor); }).catch(() => undefined);
    const evento = AccessibilityInfo.addEventListener('reduceTransparencyChanged', definir);
    return () => { ativo = false; evento.remove(); };
  }, []);
  return reduzir;
}

/** A consulta `prefers-reduced-transparency` da web; fora dela, ou em navegador sem `matchMedia`, nada. */
function consultaDaWeb(): MediaQueryList | undefined {
  if (Platform.OS !== 'web') return undefined;
  try {
    return window.matchMedia?.('(prefers-reduced-transparency: reduce)');
  } catch {
    return undefined;
  }
}
