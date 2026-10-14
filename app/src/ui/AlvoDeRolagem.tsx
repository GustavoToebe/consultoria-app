import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useRolagem } from './RolagemComTopo';

/** Marca um bloco da tela como destino de `useRolagem().rolarAte([chave])` (ex.: o cartão com problema). */
export function AlvoDeRolagem({ chave, children, style }: { chave: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { registrar } = useRolagem();
  const vista = useRef<View>(null);
  useEffect(() => {
    registrar(chave, vista.current);
    return () => registrar(chave, null);
  }, [chave, registrar]);
  return <View ref={vista} collapsable={false} style={style}>{children}</View>;
}
