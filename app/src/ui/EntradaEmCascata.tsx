import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useMovimentoReduzido } from './useMovimentoReduzido';

/** Guarda a primeira lista pronta; filtros, paginação e retorno à tela não repetem a cascata. */
export function usePrimeiraLista(pronta: boolean, chave: string = '') {
  const [primeira, definir] = useState(true);
  const jaAnimou = useRef(false);
  useEffect(() => {
    if (!pronta || jaAnimou.current) return;
    jaAnimou.current = true;
    // Callback assíncrono: mantém os itens iniciais animados e exclui chaves de filtros posteriores.
    void Promise.resolve().then(() => definir(false));
  }, [pronta, chave]);
  return primeira;
}

export function EntradaEmCascata({ indice, animar = true, children, style }: {
  indice: number; animar?: boolean; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const reduzido = useMovimentoReduzido();
  const [entrando] = useState(animar);
  return <Animated.View style={style} entering={!reduzido && entrando ? FadeInDown.delay(indice < 8 ? indice * 30 : 0).duration(220).reduceMotion(ReduceMotion.System) : undefined}>{children}</Animated.View>;
}
