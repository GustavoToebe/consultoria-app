import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useTema } from '../tema/TemaProvider';

/**
 * Animações reduzidas: a preferência "Reduzir" da pessoa ou a do aparelho (acompanha mudanças enquanto o app está
 * aberto).
 */
export function useMovimentoReduzido() {
  const { preferencias } = useTema();
  const doAparelho = useMovimentoDoAparelho();
  return preferencias.movimento === 'REDUZIDO' || doAparelho;
}

function useMovimentoDoAparelho() {
  const inicial = useReducedMotion();
  const [reduzido, definir] = useState(inicial);
  useEffect(() => {
    let ativo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((valor) => { if (ativo) definir(valor); }).catch(() => undefined);
    const evento = AccessibilityInfo.addEventListener('reduceMotionChanged', definir);
    return () => { ativo = false; evento.remove(); };
  }, []);
  return reduzido;
}
