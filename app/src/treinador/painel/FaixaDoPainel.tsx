import { createContext, forwardRef, useCallback, useContext, useId, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL, LINHA_DA_FAIXA } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';

type Medida = 'titulo' | 'faixa';

interface AlturasDaLinha {
  titulo: number;
  faixa: number;
  informar: (medida: Medida, id: string, altura: number) => void;
}

const AlturasDaLinhaContexto = createContext<AlturasDaLinha | null>(null);

const maior = (a: Record<string, number>) => Math.max(0, ...Object.values(a));

/**
 * Uma linha da grade do painel. Os blocos lado a lado têm faixas de alturas diferentes ("Treinos" leva "Últimos 7 dias"
 * embaixo do título; num bloco estreito os ícones descem para a segunda linha e no largo não), e sem acerto os
 * mini-cartões de cada um começariam numa altura. A linha guarda a maior altura natural dos títulos e das faixas, e
 * todas as faixas dela usam as duas como mínimas.
 */
export function LinhaDeBlocos({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [alturas, setAlturas] = useState<Record<Medida, Record<string, number>>>({ titulo: {}, faixa: {} });
  const informar = useCallback((medida: Medida, id: string, altura: number) => {
    setAlturas((a) => (a[medida][id] === altura ? a : { ...a, [medida]: { ...a[medida], [id]: altura } }));
  }, []);
  const titulo = maior(alturas.titulo);
  const faixa = maior(alturas.faixa);
  const valor = useMemo(() => ({ titulo, faixa, informar }), [titulo, faixa, informar]);
  return <AlturasDaLinhaContexto.Provider value={valor}><View style={style}>{children}</View></AlturasDaLinhaContexto.Provider>;
}

/**
 * Faixa de título dos blocos do painel (a mesma do `Cartao`: `superficie3`, linha de 3 px embaixo), com o título e a
 * linha pequena embaixo dele à esquerda e as ações à direita na mesma linha; num bloco estreito (1 coluna, celular) as
 * ações descem para uma segunda linha, à direita (os ícones continuam com 44 px). `ref`: o passeio aponta para a faixa
 * dos Primeiros passos.
 */
export const FaixaDoPainel = forwardRef<View, { titulo: string; descricao?: string | null; acoes?: ReactNode; meio?: ReactNode }>(
  function FaixaDoPainel({ titulo, descricao, acoes, meio }, ref) {
    const { cores } = useTema();
    const { width } = useWindowDimensions();
    const linha = useContext(AlturasDaLinhaContexto);
    const id = useId();
    const informar = linha?.informar;
    // Mede sempre a caixa de dentro (altura natural), nunca a que recebe a mínima: assim a medida não se realimenta.
    const medirTitulo = useCallback((e: LayoutChangeEvent) => informar?.('titulo', id, Math.ceil(e.nativeEvent.layout.height)), [informar, id]);
    const medirFaixa = useCallback((e: LayoutChangeEvent) => informar?.('faixa', id, Math.ceil(e.nativeEvent.layout.height)), [informar, id]);
    const recuo = espaco(width >= LARGURA_MENU_LATERAL ? 2.5 : 2);
    return (
      <View ref={ref} collapsable={false}
        style={[estilos.faixa, { backgroundColor: cores.superficie3, borderBottomColor: cores.bordaCampo, paddingHorizontal: recuo },
          linha ? { minHeight: Math.max(MINIMA, linha.faixa + 2 * VERTICAL + LINHA_DA_FAIXA) } : null]}>
        <View onLayout={linha ? medirFaixa : undefined} style={estilos.conteudo}>
          <View style={[estilos.titulo, linha ? { minHeight: linha.titulo } : null]}>
            <View onLayout={linha ? medirTitulo : undefined} style={estilos.textos}>
              <Texto variante="bloco" nivel={2}>{titulo}</Texto>
              {descricao ? <Texto variante="pequeno" cor={cores.textoSuave}>{descricao}</Texto> : null}
            </View>
          </View>
          {meio}
          {acoes ? <View style={estilos.acoes}>{acoes}</View> : null}
        </View>
      </View>
    );
  },
);

const VERTICAL = espaco(1);
const MINIMA = 60;

const estilos = StyleSheet.create({
  faixa: { justifyContent: 'center', paddingVertical: VERTICAL, minHeight: MINIMA, borderBottomWidth: LINHA_DA_FAIXA },
  conteudo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: espaco(1), rowGap: espaco(0.5) },
  // O título reserva 150 px antes de dividir a linha com as ações: num bloco estreito as ações descem para a linha de
  // baixo em vez de espremer o título letra por letra.
  titulo: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0 },
  textos: { gap: 2 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 'auto' },
});
