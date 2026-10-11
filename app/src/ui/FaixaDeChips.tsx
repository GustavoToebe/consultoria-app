import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../tema/tokens';

interface Props {
  children: ReactNode;
  /** Cor do fundo atrás da faixa (fundo da tela ou superfície do cartão), para o esmaecido casar. */
  fundo?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: 'tablist' | 'radiogroup';
  accessibilityLabel?: string;
  /**
   * No PC (janela ≥ 768 px) os chips quebram linha em vez de rolar: com mouse a rolagem horizontal é escondida e
   * a faixa parece cortada. No celular continua rolando. Só para faixas curtas (sessões, tipos), não para datas.
   */
  quebrar?: boolean;
}

/** Largura do esmaecido em cada borda. */
const LARGURA_ESMAECIDO = 28;

/**
 * Chips em linha única com rolagem horizontal e, quando há mais do que cabe, um esmaecido na borda que indica que
 * continua (sem isso a faixa parecia cortada). Quatro faixas do fundo com opacidades crescentes fazem as vezes do
 * gradiente, sem biblioteca.
 */
export function FaixaDeChips({ children, fundo, contentContainerStyle, accessibilityRole, accessibilityLabel, quebrar }: Props) {
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  const cor = fundo ?? cores.fundo;
  const [visivel, setVisivel] = useState(0);
  const [total, setTotal] = useState(0);
  const [posicao, setPosicao] = useState(0);
  const sobra = total - visivel;
  const direita = sobra > 1 && posicao < sobra - 1;
  const esquerda = sobra > 1 && posicao > 1;
  if (quebrar && width >= LARGURA_MENU_LATERAL) {
    return (
      <View accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} style={[estilos.chips, estilos.quebrada, contentContainerStyle]}>
        {children}
      </View>
    );
  }
  return (
    <View style={estilos.area}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        onLayout={(e) => setVisivel(e.nativeEvent.layout.width)}
        onContentSizeChange={(w) => setTotal(w)}
        scrollEventThrottle={50}
        onScroll={(e) => setPosicao(e.nativeEvent.contentOffset.x)}
        contentContainerStyle={[estilos.chips, contentContainerStyle]}>
        {children}
      </ScrollView>
      {direita ? <Esmaecido cor={cor} lado="direita" /> : null}
      {esquerda ? <Esmaecido cor={cor} lado="esquerda" /> : null}
    </View>
  );
}

function Esmaecido({ cor, lado }: { cor: string; lado: 'esquerda' | 'direita' }) {
  const faixas = lado === 'direita' ? [0.25, 0.5, 0.75, 1] : [1, 0.75, 0.5, 0.25];
  return (
    <View pointerEvents="none" style={[estilos.esmaecido, lado === 'direita' ? estilos.direita : estilos.esquerda]}>
      {faixas.map((opacidade, i) => (
        <View key={i} style={[estilos.faixa, { backgroundColor: cor, opacity: opacidade }]} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { position: 'relative', maxWidth: '100%' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75), paddingRight: espaco(1) },
  quebrada: { flexWrap: 'wrap', paddingRight: 0 },
  esmaecido: { position: 'absolute', top: 0, bottom: 0, width: LARGURA_ESMAECIDO, flexDirection: 'row' },
  direita: { right: 0 },
  esquerda: { left: 0 },
  faixa: { flex: 1 },
});
