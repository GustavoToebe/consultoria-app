import { GripVertical } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { destinoDoArraste, type CaixaDoItem } from '../dominio/reordenar';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO_CONTROLE } from '../tema/tokens';
import { useAviso } from './Aviso';
import { useMovimentoReduzido } from './useMovimentoReduzido';

/** O que `useArrasteDaLista` devolve: passe a mesma para cada `ItemArrastavel` e `AlcaDeArraste` da lista. */
export interface ArrasteDaLista {
  total: number;
  eixo: 'vertical' | 'linhas';
  /** Índice do item em arraste e onde ele cairia agora (nulos fora do arraste). */
  de: number | null;
  para: number | null;
  /** Caixa da linha guia relativa à posição original do item arrastado (nula quando cai no mesmo lugar). */
  linha: CaixaDoItem | null;
  reduzido: boolean;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  medir: (indice: number) => (no: View | null) => void;
  gesto: (indice: number) => ReturnType<typeof Gesture.Pan>;
}

/**
 * Arrastar para reordenar (plano `docs/planos/dieta-tabela-e-arrastar.md`, D3), sem biblioteca nova: o mesmo
 * `Gesture.Pan` do `EditarPainel` e do `QuadroKanban`. É reforço, nunca o único caminho: a lista continua com "Mover para
 * cima/baixo" no ⋯ do item (WCAG 2.5.7), que é também o caminho do teclado e do leitor de tela.
 *
 * - Começa pela alça (`AlcaDeArraste`): no PC (web) ao segurar com o mouse e mover; no toque, depois de 250 ms segurando
 *   (`activateAfterLongPress`), para não brigar com a rolagem. Na web por toque não há essa espera.
 * - No começo mede os itens na janela (`measureInWindow`, funciona com itens aninhados, como os exercícios dentro de um
 *   grupo); o destino sai de `dominio/reordenar.destinoDoArraste` e só redesenha a lista quando muda.
 * - Ao soltar noutro lugar chama `aoSoltar(de, para)` (que aplica a MESMA função das setas e devolve como desfazer) e
 *   mostra o aviso "Ordem alterada." com Desfazer.
 *
 * Os índices são os da ordem visível, de 0 a `total - 1`.
 */
export function useArrasteDaLista({ total, aoSoltar, eixo = 'vertical', folga = espaco(0.5) }: {
  total: number;
  aoSoltar: (de: number, para: number) => () => void;
  eixo?: 'vertical' | 'linhas';
  /** Metade do espaço entre os itens: a linha guia fica no meio dele. */
  folga?: number;
}): ArrasteDaLista {
  const { avisar } = useAviso();
  const reduzido = useMovimentoReduzido();
  const nos = useRef(new Map<number, View>());
  const caixas = useRef<(CaixaDoItem | undefined)[]>([]);
  const [estado, setEstado] = useState<{ de: number; para: number; linha: CaixaDoItem | null } | null>(null);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);

  const comecar = (de: number) => {
    caixas.current = [];
    nos.current.forEach((no, i) => no.measureInWindow((x, y, w, h) => { caixas.current[i] = { x, y, w, h }; }));
    setEstado({ de, para: de, linha: null });
  };
  // shortcut: as caixas são medidas só no começo (sem rolagem automática perto da borda); rolar a página no meio do
  // arraste desalinha o destino até soltar. Trocar por medida a cada rolagem se listas maiores que a janela pedirem.
  const destino = (de: number, x: number, y: number) => Math.min(destinoDoArraste(caixas.current, de, { x, y }, eixo), total - 1);
  // A linha guia é desenhada dentro do item arrastado (por cima dele), na posição do vão entre os itens de destino.
  const linhaGuia = (de: number, para: number): CaixaDoItem | null => {
    const o = caixas.current[de];
    const c = caixas.current[para];
    if (!o || !c || para === de) return null;
    if (eixo === 'linhas') {
      const x = para < de ? c.x - folga : c.x + c.w + folga;
      return { x: x - 1 - o.x, y: c.y - o.y, w: 2, h: c.h };
    }
    const y = para < de ? c.y - folga : c.y + c.h + folga;
    return { x: c.x - o.x, y: y - 1 - o.y, w: c.w, h: 2 };
  };
  const mover = (de: number, x: number, y: number) => {
    const para = destino(de, x, y);
    setEstado((e) => (e && e.de === de && e.para === para ? e : { de, para, linha: linhaGuia(de, para) }));
  };
  const soltar = (de: number, x: number, y: number) => {
    const para = destino(de, x, y);
    setEstado(null);
    if (para === de || para < 0) return;
    const desfazer = aoSoltar(de, para);
    avisar('Ordem alterada.', 'neutro', { rotulo: 'Desfazer', aoTocar: desfazer });
  };

  const gesto = (indice: number) => {
    const base = Gesture.Pan().runOnJS(true).enabled(total > 1);
    return (Platform.OS === 'web' ? base.minDistance(4) : base.activateAfterLongPress(250))
      .onStart(() => comecar(indice))
      .onUpdate((e) => { dx.set(e.translationX); dy.set(e.translationY); mover(indice, e.absoluteX, e.absoluteY); })
      .onEnd((e) => soltar(indice, e.absoluteX, e.absoluteY))
      .onFinalize(() => { dx.set(0); dy.set(0); setEstado(null); });
  };
  const medir = (indice: number) => (no: View | null) => {
    if (no) nos.current.set(indice, no);
    else nos.current.delete(indice);
  };
  return { total, eixo, de: estado?.de ?? null, para: estado?.para ?? null, linha: estado?.linha ?? null, reduzido, dx, dy, medir, gesto };
}

/**
 * A caixa de um item da lista: é ela que se mede e que sobe por cima com a sombra do tema enquanto é arrastada (segue o
 * ponteiro; com o movimento reduzido fica no lugar). Ela também desenha a linha guia de 2 px na cor de ação, fixa no vão
 * onde o item vai cair (por cima do próprio item, para não ficar escondida embaixo dele).
 */
export function ItemArrastavel({ arraste: a, indice, style, children }: {
  arraste: ArrasteDaLista;
  indice: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { cores } = useTema();
  const emArraste = a.de === indice;
  const seguir = emArraste && !a.reduzido;
  const linhas = a.eixo === 'linhas';
  const { dx, dy, linha } = a;
  const andar = useAnimatedStyle(() => (seguir ? { transform: [{ translateX: linhas ? dx.get() : 0 }, { translateY: dy.get() }] } : {}));
  // Desconta o quanto o item andou: a linha fica parada no vão enquanto o item segue o ponteiro.
  const ficar = useAnimatedStyle(() => (linha
    ? { left: linha.x - (seguir && linhas ? dx.get() : 0), top: linha.y - (seguir ? dy.get() : 0), width: linha.w, height: linha.h }
    : {}));
  return (
    <Animated.View ref={a.medir(indice)} collapsable={false}
      style={[style, emArraste ? [estilos.porCima, { backgroundColor: cores.superficie, boxShadow: cores.sombra }] : null, andar]}>
      {children}
      {emArraste && linha ? <Animated.View pointerEvents="none" aria-hidden style={[estilos.guia, { backgroundColor: cores.acao }, ficar]} /> : null}
    </Animated.View>
  );
}

/**
 * A alça ≡ no começo do item. Só para o ponteiro: fica fora da árvore de acessibilidade (o ⋯ do item faz o mesmo pelo
 * teclado e pelo leitor de tela) e fora do botão do item (clicar nela não abre nada; clicar fora dela continua abrindo).
 * Some quando a lista tem um item só.
 */
export function AlcaDeArraste({ arraste: a, indice }: { arraste: ArrasteDaLista; indice: number }) {
  const { cores } = useTema();
  if (a.total < 2) return null;
  return (
    <GestureDetector gesture={a.gesto(indice)}>
      <View testID="alca-de-arraste" aria-hidden importantForAccessibility="no-hide-descendants" collapsable={false}
        style={[estilos.alca, Platform.OS === 'web' ? (a.de === indice ? estilos.agarrando : estilos.agarrar) : null]}>
        <GripVertical size={18} color={cores.textoSuave} strokeWidth={2} />
      </View>
    </GestureDetector>
  );
}

/** Largura da alça: o cabeçalho de uma tabela soma esta medida para as colunas caírem sobre os valores. */
export const LARGURA_DA_ALCA = 24;

const estilos = StyleSheet.create({
  porCima: { zIndex: 10, borderRadius: RAIO_CONTROLE },
  guia: { position: 'absolute', borderRadius: 1 },
  alca: { width: LARGURA_DA_ALCA, minHeight: ALVO_TOQUE, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // Segurar e arrastar com o mouse não seleciona texto nem rola a página por baixo.
  agarrar: { cursor: 'grab', userSelect: 'none', touchAction: 'none' } as never,
  agarrando: { cursor: 'grabbing', userSelect: 'none', touchAction: 'none' } as never,
});
