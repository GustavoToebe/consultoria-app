import { GripVertical } from 'lucide-react-native';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { destinoDoArraste, linhaGuia, type CaixaDoItem } from '../dominio/reordenar';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO_CONTROLE } from '../tema/tokens';
import { abrirCamada, caixaNaWeb, ouvirEsc, rolagemAutomatica, type CamadaDoArraste } from './arrasteNaWeb';
import { useAviso } from './Aviso';
import { useMovimentoReduzido } from './useMovimentoReduzido';

const WEB = Platform.OS === 'web';
type Ponto = { x: number; y: number };

/** O que um item arrastável e a alça dele precisam saber do arraste (a mesma para todos os itens da lista ou do quadro). */
export interface ArrasteDoItem<K> {
  /** Falso: sem gesto (lista com um item, quadro empilhado); a alça some. */
  ativo: boolean;
  /** Item em arraste (nulo fora do arraste). */
  de: K | null;
  /** Caixa do item arrastado no começo, na janela (o Kanban usa a altura no espaço de entrada). */
  origem: CaixaDoItem | null;
  /** Linha guia na janela (só o desenho do aparelho a usa; na web ela vai na camada). */
  guia: CaixaDoItem | null;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  medir: (chave: K) => (no: View | null) => void;
  gesto: (chave: K) => PanGesture;
}

/** O arraste inteiro: `para` é o destino de agora (índice na lista, coluna no Kanban, bloco no Início). */
export interface Arraste<K, D> extends ArrasteDoItem<K> {
  para: D | null;
  /** Registra um alvo (as colunas do Kanban; nas listas, o próprio item: `comItensComoAlvos`). */
  alvo: (destino: D) => (no: View | null) => void;
  /** Acabou de soltar: o clique que o navegador manda logo depois não deve abrir o item. */
  arrastouHaPouco: () => boolean;
}

/** O que `useArrasteDaLista` devolve: passe a mesma para cada `ItemArrastavel` e `AlcaDeArraste` da lista. */
export type ArrasteDaLista = Arraste<number, number>;

/**
 * O núcleo único do arrastar (plano `docs/planos/arrastar-com-copia-translucida.md`, D1 a D5), sem biblioteca nova: um
 * `Gesture.Pan` por item. As listas (`useArrasteDaLista`), o Kanban de Interessados e o Início em edição usam este.
 *
 * - Começa (D3): na web, com o mouse, depois de 4 px (clicar continua sendo clique); no aparelho, toque longo de 250 ms.
 * - Durante: uma cópia translúcida do item segue o ponteiro (também com o movimento reduzido, D2), sem escala e presa ao
 *   ponto onde foi pega (26/11: sai exatamente sobre a linha e anda o mesmo que o ponteiro), a origem vira um
 *   espaço tracejado do mesmo tamanho e `para` acompanha o destino (`destino` recebe a caixa de cada alvo). Na web a
 *   cópia, o tracejado e a linha guia vão numa camada no `body` (`ui/arrasteNaWeb`), a área que rola anda sozinha perto
 *   da borda e as medidas são refeitas a cada movimento e a cada rolagem; no aparelho o próprio item anda.
 * - Esc cancela (web): a cópia volta e nada muda. Ao soltar, `aoSoltar(de, para)` diz se aplicou; aplicado com
 *   `encaixar`, a cópia encaixa no lugar novo; sem `encaixar` (o Kanban, que só muda depois da resposta) ela some. Com o
 *   movimento reduzido ela só some, sem encaixe nem volta.
 */
export function useArraste<K, D>({ ativo, destino, guia, aoSoltar, encaixar = true }: {
  ativo: boolean;
  destino: (de: K, ponto: Ponto, alvos: ReadonlyMap<D, CaixaDoItem>) => D | null;
  guia?: (de: K, para: D, alvos: ReadonlyMap<D, CaixaDoItem>) => CaixaDoItem | null;
  /** Devolve se o soltar mudou algo (falso: a cópia volta para a origem). */
  aoSoltar: (de: K, para: D) => boolean;
  encaixar?: boolean;
}): Arraste<K, D> {
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const itens = useRef(new Map<K, View>());
  const alvos = useRef(new Map<D, View>());
  const medidas = useRef(new Map<D, CaixaDoItem>());
  const [estado, setEstado] = useState<{ de: K; para: D | null; guia: CaixaDoItem | null; origem: CaixaDoItem | null } | null>(null);
  const sessao = useRef<{ de: K; ponto: Ponto; camada: CamadaDoArraste | null; rolar?: (y: number) => void; parar: (() => void)[] } | null>(null);
  // Onde o botão desceu (`onBegin`). Na web o `translationX/Y` do gesto conta a partir da ativação (depois dos 4 px), não
  // do toque: a cópia ficava para trás do ponteiro (26/11, "a sombra sai deslocada"). O deslocamento é medido daqui.
  const pega = useRef<Ponto | null>(null);
  const fimEm = useRef(0);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  // Saiu da tela no meio do arraste (troca de rota): nada da camada pode ficar no `body`.
  useEffect(() => () => {
    const s = sessao.current;
    sessao.current = null;
    s?.camada?.terminar('sumir', true);
    s?.parar.forEach((f) => f());
  }, []);

  // Na web, a caixa de agora de cada alvo; no aparelho, as medidas do começo (lá a página não rola durante o gesto).
  const caixasDosAlvos = (): ReadonlyMap<D, CaixaDoItem> => {
    if (!WEB) return medidas.current;
    const m = new Map<D, CaixaDoItem>();
    alvos.current.forEach((no, d) => {
      const c = caixaNaWeb(no);
      if (c) m.set(d, c);
    });
    return m;
  };
  const calcular = () => {
    const s = sessao.current;
    if (!s) return null;
    const m = caixasDosAlvos();
    const para = destino(s.de, s.ponto, m);
    const linha = para === null || !guia ? null : guia(s.de, para, m);
    s.camada?.guia(linha);
    setEstado((e) => (!e || e.para === para ? e : { ...e, para, guia: linha }));
    return para;
  };
  const terminar = (fim: 'voar' | 'sumir') => {
    const s = sessao.current;
    if (!s) return;
    sessao.current = null;
    s.camada?.terminar(fim, reduzido);
    s.parar.forEach((f) => f());
    fimEm.current = Date.now();
    setEstado(null);
  };
  const comecar = (de: K, ponto: Ponto) => {
    const no = itens.current.get(de);
    dx.set(0);
    dy.set(0);
    if (WEB) {
      const s: NonNullable<typeof sessao.current> = { de, ponto, camada: abrirCamada(no, cores), parar: [] };
      sessao.current = s;
      // A cada rolagem (a automática ou a roda do mouse) o ponteiro fica parado: redesenha o tracejado e recalcula.
      const rolagem = rolagemAutomatica(no, () => { s.camada?.mover(dx.get(), dy.get()); calcular(); });
      const esc = ouvirEsc(() => terminar('voar'));
      if (rolagem) {
        s.rolar = rolagem.ponteiro;
        s.parar.push(rolagem.parar);
      }
      if (esc) s.parar.push(esc);
      setEstado({ de, para: null, guia: null, origem: caixaNaWeb(no) ?? null });
      return;
    }
    // shortcut: no aparelho não há rolagem automática nem Esc, as medidas são só as do começo e o próprio item anda no
    // lugar (o `zIndex` só vale entre irmãos: num tablet, a coluna seguinte do Kanban pode cobri-lo). Trocar por um portal
    // e a referência da rolagem se o arraste por toque for conferido no aparelho e pedir.
    sessao.current = { de, ponto, camada: null, parar: [] };
    const novas = new Map<D, CaixaDoItem>();
    medidas.current = novas;
    alvos.current.forEach((n, d) => n.measureInWindow((x, y, w, h) => { novas.set(d, { x, y, w, h }); }));
    setEstado({ de, para: null, guia: null, origem: null });
    no?.measureInWindow((x, y, w, h) => setEstado((e) => (e && e.de === de ? { ...e, origem: { x, y, w, h } } : e)));
  };

  const gesto = (chave: K) => {
    const base = Gesture.Pan().runOnJS(true).enabled(ativo);
    return (WEB ? base.minDistance(4) : base.activateAfterLongPress(250))
      .onBegin((e) => { pega.current = { x: e.absoluteX, y: e.absoluteY }; })
      .onStart((e) => comecar(chave, { x: e.absoluteX, y: e.absoluteY }))
      .onUpdate((e) => {
        const s = sessao.current;
        if (!s || s.de !== chave) return;
        const p = pega.current;
        const x = p ? e.absoluteX - p.x : e.translationX;
        const y = p ? e.absoluteY - p.y : e.translationY;
        dx.set(x);
        dy.set(y);
        s.ponto = { x: e.absoluteX, y: e.absoluteY };
        s.camada?.mover(x, y);
        s.rolar?.(e.absoluteY);
        calcular();
      })
      .onEnd((e) => {
        const s = sessao.current;
        if (!s || s.de !== chave) return;
        s.ponto = { x: e.absoluteX, y: e.absoluteY };
        const para = calcular();
        const aplicou = para !== null && aoSoltar(chave, para);
        terminar(aplicou && !encaixar ? 'sumir' : 'voar');
      })
      .onFinalize(() => { if (sessao.current?.de === chave) terminar('voar'); });
  };
  const registrar = <C,>(mapa: Map<C, View>, chave: C, no: View | null) => {
    if (no) mapa.set(chave, no);
    else mapa.delete(chave);
  };
  return {
    ativo, de: estado?.de ?? null, para: estado?.para ?? null, origem: estado?.origem ?? null, guia: estado?.guia ?? null, dx, dy, gesto,
    medir: (chave) => (no) => registrar(itens.current, chave, no),
    alvo: (d) => (no) => registrar(alvos.current, d, no),
    arrastouHaPouco: () => Date.now() - fimEm.current < 400,
  };
}

/** Quando os próprios itens são os alvos (listas, Início): medir um item registra o nó também como alvo, com a mesma chave. */
export function comItensComoAlvos<K>(a: Arraste<K, K>): Arraste<K, K> {
  return { ...a, medir: (chave) => (no) => { a.medir(chave)(no); a.alvo(chave)(no); } };
}

/**
 * Arrastar para reordenar uma lista (plano `docs/planos/dieta-tabela-e-arrastar.md`, D3), sobre o `useArraste`. É reforço,
 * nunca o único caminho: a lista continua com "Mover para cima/baixo" no ⋯ do item (WCAG 2.5.7), que é também o caminho do
 * teclado e do leitor de tela. O destino é o vão (`dominio/reordenar.destinoDoArraste`), com a linha guia de 2 px na cor
 * de ação. Ao soltar noutro lugar chama `aoSoltar(de, para)`, que aplica a MESMA função das setas, e mostra o aviso "Ordem
 * alterada." com Desfazer. Se `aoSoltar` devolve uma função, ela é o desfazer (o conteúdo de antes, como o `BarraDesfazer`);
 * senão o Desfazer leva o item de volta (`aoSoltar(para, de)` da versão mais nova da lista, nada se ela já saiu da tela).
 *
 * Os índices são os da ordem visível, de 0 a `total - 1`. `horizontal` (uma fileira só, as abas das opções da refeição):
 * vale só o x do ponteiro, como se ele estivesse na altura da fileira (subir ou descer um pouco não leva ao começo nem ao
 * fim). `mensagem` troca o "Ordem alterada." quando a lista tem algo a dizer sobre a ordem nova (lida antes de soltar).
 */
export function useArrasteDaLista({ total, aoSoltar, eixo = 'vertical', folga = espaco(0.5), mensagem }: {
  total: number;
  aoSoltar: (de: number, para: number) => (() => void) | void;
  eixo?: 'vertical' | 'linhas' | 'horizontal';
  /** Metade do espaço entre os itens: a linha guia fica no meio dele. */
  folga?: number;
  mensagem?: (de: number, para: number) => string;
}): ArrasteDaLista {
  const { avisar } = useAviso();
  // O Desfazer chega até 10 s depois: usa o `aoSoltar` da lista de agora, e só se ela ainda está na tela.
  const atual = useRef(aoSoltar);
  const montada = useRef(false);
  useEffect(() => { atual.current = aoSoltar; });
  useEffect(() => { montada.current = true; return () => { montada.current = false; }; }, []);
  const emOrdem = (m: ReadonlyMap<number, CaixaDoItem>) => Array.from({ length: total }, (_, i) => m.get(i));
  return comItensComoAlvos(useArraste<number, number>({
    ativo: total > 1,
    destino: (de, ponto, m) => {
      const caixas = emOrdem(m);
      const fileira = caixas[de];
      const p = eixo === 'horizontal' && fileira ? { x: ponto.x, y: fileira.y + fileira.h / 2 } : ponto;
      return Math.min(destinoDoArraste(caixas, de, p, eixo === 'vertical' ? 'vertical' : 'linhas'), total - 1);
    },
    guia: (de, para, m) => linhaGuia(emOrdem(m), de, para, eixo === 'vertical' ? 'vertical' : 'linhas', folga),
    aoSoltar: (de, para) => {
      if (para === de || para < 0) return false;
      const texto = mensagem?.(de, para) ?? 'Ordem alterada.';
      const desfazer = aoSoltar(de, para) ?? (() => { if (montada.current) atual.current(para, de); });
      avisar(texto, 'neutro', { rotulo: 'Desfazer', aoTocar: desfazer });
      return true;
    },
  }));
}

/**
 * O mesmo `useArrasteDaLista` como componente (render prop), para quem monta a lista dentro de uma função de render ou
 * depois de um retorno antecipado, onde não pode chamar hook.
 */
export function ListaArrastavel({ children, ...opcoes }: Parameters<typeof useArrasteDaLista>[0] & { children: (arraste: ArrasteDaLista) => ReactNode }) {
  return <>{children(useArrasteDaLista(opcoes))}</>;
}

/**
 * A caixa de um item arrastável: é ela que se mede e que a cópia reproduz. Na web a camada do `ui/arrasteNaWeb` desenha a
 * cópia, o espaço tracejado e a linha guia por cima de tudo (este nó só fica invisível no lugar). No aparelho o próprio
 * item anda com o dedo, translúcido e com a sombra do tema, e deixa no lugar o contorno tracejado e a linha guia.
 */
export function ItemArrastavel<K>({ arraste: a, indice, style, children }: {
  arraste: ArrasteDoItem<K>;
  indice: K;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { cores } = useTema();
  // O `ref` do `Animated.View` só é chamado na montagem (o Reanimated repassa por uma função fixa): com ele, o item ficava
  // registrado na posição em que nasceu, e depois de reordenar o arraste pegava (e copiava) a linha de outro índice, que
  // aparecia acima ou abaixo do ponteiro (26/11). O nó vem do `ref`; o registro segue o índice de agora. Os efeitos de
  // layout desfazem todos os registros velhos antes de fazer os novos, então trocar dois itens não apaga nenhum.
  const no = useRef<View | null>(null);
  const medir = useRef(a.medir);
  useLayoutEffect(() => { medir.current = a.medir; });
  useLayoutEffect(() => {
    const registrar = medir.current(indice);
    registrar(no.current);
    return () => registrar(null);
  }, [indice]);
  const andando = a.de === indice && !WEB;
  const { dx, dy, origem: o, guia: g } = a;
  // Sem escala (26/11): a cópia sai exatamente sobre a linha e anda o mesmo que o dedo.
  const andar = useAnimatedStyle(() => (andando ? { transform: [{ translateX: dx.get() }, { translateY: dy.get() }] } : {}));
  // Desconta o quanto o item andou: o contorno e a linha ficam parados no lugar de origem.
  const ficar = useAnimatedStyle(() => (andando ? { transform: [{ translateX: -dx.get() }, { translateY: -dy.get() }] } : {}));
  return (
    <Animated.View ref={(n: View | null) => { no.current = n; }} collapsable={false}
      style={[style, andando ? [estilos.porCima, { backgroundColor: cores.superficie, boxShadow: cores.sombra, opacity: 0.6 }] : null, andar]}>
      {children}
      {andando ? (
        <Animated.View pointerEvents="none" aria-hidden style={[StyleSheet.absoluteFill, estilos.espaco, { borderColor: cores.bordaCampo }, ficar]}>
          {g && o ? <View style={[estilos.guia, { backgroundColor: cores.acao, left: g.x - o.x, top: g.y - o.y, width: g.w, height: g.h }]} /> : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/**
 * A alça ⋮⋮ no começo do item (D3, `cores.textoSuave`). Só para o ponteiro: fica fora da árvore de acessibilidade (o ⋯ do
 * item faz o mesmo pelo teclado e pelo leitor de tela) e fora do botão do item (clicar nela não abre nada; clicar fora
 * dela continua abrindo). Some sem arraste (lista com um item só).
 */
export function AlcaDeArraste<K>({ arraste: a, indice }: { arraste: ArrasteDoItem<K>; indice: K }) {
  const { cores } = useTema();
  if (!a.ativo) return null;
  return (
    <GestureDetector gesture={a.gesto(indice)}>
      <View testID="alca-de-arraste" aria-hidden importantForAccessibility="no-hide-descendants" collapsable={false}
        style={[estilos.alca, WEB ? estilos.agarrar : null]}>
        <GripVertical size={18} color={cores.textoSuave} strokeWidth={2} />
      </View>
    </GestureDetector>
  );
}

/** Largura da alça: o cabeçalho de uma tabela soma esta medida para as colunas caírem sobre os valores. */
export const LARGURA_DA_ALCA = 24;

const estilos = StyleSheet.create({
  porCima: { zIndex: 10, borderRadius: RAIO_CONTROLE },
  espaco: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO_CONTROLE },
  guia: { position: 'absolute', borderRadius: 1 },
  alca: { width: LARGURA_DA_ALCA, minHeight: ALVO_TOQUE, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // Segurar e arrastar com o mouse não seleciona texto nem rola a página por baixo (o "segurando" vai na camada da web).
  agarrar: { cursor: 'grab', userSelect: 'none', touchAction: 'none' } as never,
});
