import { ArrowUp } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, RAIO } from '../tema/tokens';
import { useMovimentoReduzido } from './useMovimentoReduzido';

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
  return (
    <View style={[estilos.area, preencher && estilos.preencher]}>
      <ScrollView
        ref={rolagem}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={100}
        onScroll={(e) => setLonge(e.nativeEvent.contentOffset.y > LIMITE_TOPO)}>
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
  );
}

const estilos = StyleSheet.create({
  area: { flexShrink: 1, minHeight: 0 },
  preencher: { flex: 1 },
  botao: { position: 'absolute', right: espaco(2), bottom: espaco(2), width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
