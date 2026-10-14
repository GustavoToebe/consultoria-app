import { ArrowUp } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../tema/tokens';
import { useMovimentoReduzido } from './useMovimentoReduzido';

/** Quem está dentro de uma rolagem registra pontos (`AlvoDeRolagem`) e pede para rolar até eles. */
export interface Rolagem {
  registrar: (chave: string, vista: View | null) => void;
  /** Rola até o primeiro da lista que estiver na tela (depois de um instante, para a tela redesenhar antes). */
  rolarAte: (chaves: readonly string[]) => void;
}

const RolagemContexto = createContext<Rolagem | null>(null);

/** Sem rolagem por perto (teste, tela sem `Tela`), `rolarAte` não faz nada. */
export function useRolagem(): Rolagem {
  return useContext(RolagemContexto) ?? SEM_ROLAGEM;
}
const SEM_ROLAGEM: Rolagem = { registrar: () => undefined, rolarAte: () => undefined };

/** Rolagem (px) a partir da qual aparece o botão de voltar ao início. */
const LIMITE_TOPO = 400;

interface Props {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Ocupa a altura toda do pai (telas); sem isto encolhe junto com o conteúdo (folhas com altura máxima). */
  preencher?: boolean;
}

/** ScrollView com o botão flutuante "Voltar ao início da página", usado nas telas e nas folhas. */
export function RolagemComTopo({ children, contentContainerStyle, preencher }: Props) {
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const rolagem = useRef<ScrollView>(null);
  const [longe, setLonge] = useState(false);
  const area = useRef<View>(null);
  const deslocamento = useRef(0);
  const alvos = useRef(new Map<string, View>());
  const registrar = useCallback((chave: string, vista: View | null) => {
    if (vista) alvos.current.set(chave, vista);
    else alvos.current.delete(chave);
  }, []);
  const rolarAte = useCallback((chaves: readonly string[]) => {
    setTimeout(() => {
      const alvo = chaves.map((c) => alvos.current.get(c)).find((v) => v !== undefined);
      alvo?.measureInWindow((_x, y) => area.current?.measureInWindow((_sx, sy) => {
        rolagem.current?.scrollTo({ y: Math.max(0, deslocamento.current + y - sy - espaco(2)), animated: !reduzido });
      }));
    }, 80);
  }, [reduzido]);
  const contexto = useMemo(() => ({ registrar, rolarAte }), [registrar, rolarAte]);
  return (
    <RolagemContexto.Provider value={contexto}>
    <View ref={area} style={[estilos.area, preencher && estilos.preencher]}>
      <ScrollView
        ref={rolagem}
        contentContainerStyle={[contentContainerStyle, estilos.fim]}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={100}
        onScroll={(e) => { deslocamento.current = e.nativeEvent.contentOffset.y; setLonge(e.nativeEvent.contentOffset.y > LIMITE_TOPO); }}>
        {children}
      </ScrollView>
      {longe ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar ao início da página"
          onPress={() => rolagem.current?.scrollTo({ y: 0, animated: !reduzido })}
          style={({ pressed }) => [estilos.botao, { backgroundColor: cores.superficie, borderColor: cores.borda, opacity: pressed ? 0.7 : 1 }]}>
          <ArrowUp size={20} color={cores.texto} />
        </Pressable>
      ) : null}
    </View>
    </RolagemContexto.Provider>
  );
}

const estilos = StyleSheet.create({
  area: { flexShrink: 1, minHeight: 0 },
  preencher: { flex: 1 },
  // Espaço no fim da rolagem: o botão flutuante nunca cobre o último botão ou item da tela.
  fim: { paddingBottom: espaco(2) + ALVO_TOQUE + espaco(1) },
  botao: { position: 'absolute', right: espaco(2), bottom: espaco(2), width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
