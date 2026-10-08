import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** Acompanha também mudanças da preferência enquanto o app está aberto. */
export function useMovimentoReduzido() {
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
