import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { elementoDaWeb } from '../painel/edicao/tipos';
import { escalaParaCaber } from './arranjoDaMarca';

/**
 * Desenho da prévia: fora do toque, do Tab e do leitor de tela (`inert` no DOM, como a `PreviaDaMobilidade`, mais
 * `aria-hidden` e `pointerEvents`). Dentro há peças de verdade (os botões das redes): nada ali pode ser acionado.
 * Quem usa diz o que é a prévia num texto fora daqui.
 */
export function Inerte({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const caixa = useRef<View>(null);
  useEffect(() => { elementoDaWeb(caixa.current)?.setAttribute('inert', ''); }, []);
  return <View ref={caixa} aria-hidden pointerEvents="none" style={style}>{children}</View>;
}

/**
 * Desenho de tamanho fixo (`base`) reduzido por inteiro para caber (os celulares da prévia): o conteúdo nunca refaz a
 * linha numa largura estreita, só encolhe. `largura`: cabe na largura e a caixa fica com a altura escalada (celular e
 * prévia embaixo do formulário); `caixa`: a caixa estica no pai (`flex: 1`) e o desenho cabe na largura e na altura
 * (prévia fixa da tela larga). A caixa corta o que passar: nunca há rolagem lateral.
 */
export function Escala({ base, modo, children }: { base: { largura: number; altura: number }; modo: 'largura' | 'caixa'; children: ReactNode }) {
  const [caixa, setCaixa] = useState({ largura: 0, altura: 0 });
  const s = escalaParaCaber(base, modo === 'caixa' ? caixa : { largura: caixa.largura });
  return (
    <View
      style={[estilos.caixa, modo === 'caixa' ? estilos.esticada : { height: base.altura * s }]}
      onLayout={(e) => setCaixa({ largura: e.nativeEvent.layout.width, altura: e.nativeEvent.layout.height })}>
      {s > 0 ? (
        <View style={[estilos.desenho, {
          width: base.largura, height: base.altura,
          // A escala parte do centro do desenho (o padrão em todo lugar, sem depender de `transformOrigin`): estas posições
          // deixam o desenho escalado centrado na largura e encostado no topo da caixa.
          left: (caixa.largura - base.largura) / 2,
          top: (base.altura * s - base.altura) / 2,
          transform: [{ scale: s }],
        }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { width: '100%', overflow: 'hidden' },
  esticada: { flex: 1, minHeight: 0 },
  desenho: { position: 'absolute' },
});
