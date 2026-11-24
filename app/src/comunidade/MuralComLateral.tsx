import { type ReactNode, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { arranjoDoMural, LARGURA_DA_LATERAL, LARGURA_DO_FEED, VAO_DA_LATERAL } from '../dominio/arranjoDoMural';
import { espaco } from '../tema/tokens';

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo de `FormMarca`). */
const GRUDADA = (Platform.OS === 'web' ? { position: 'sticky', top: espaco(2), overflowY: 'auto' } : {}) as unknown as ViewStyle;

/**
 * Feed do mural com a coluna de apoio (`dominio/arranjoDoMural`), igual no treinador e no aluno. Mede a própria área: a
 * partir de 1280 px a coluna fica à direita do feed de ~720 px, grudada ao rolar na web (a altura dela não passa da janela
 * e rola por dentro); abaixo, ela vai para o topo do feed (`lateral(true)`: a tela pode mostrar uma versão mais curta ali,
 * para o feed não sair da primeira dobra). Sem conteúdo (`temLateral` falso) não desenha nada, nem o vão, salvo no topo com
 * `topoSempre` (o aluno: a faixa de altura fixa existe desde o início e se preenche depois). O feed nunca espera a coluna.
 * O feed fica à esquerda, na borda do cabeçalho.
 */
export function MuralComLateral({ lateral, temLateral, topoSempre = false, rotulo, idDaLateral, children }: {
  /** O conteúdo da coluna; `noTopo` verdadeiro quando vai acima do feed. */
  lateral: (noTopo: boolean) => ReactNode;
  temLateral: boolean;
  topoSempre?: boolean;
  /** Nome da região ao lado (leitor de tela). */
  rotulo: string;
  idDaLateral: string;
  children: ReactNode;
}) {
  const [area, setArea] = useState<number | null>(null);
  const janela = useWindowDimensions();
  const arranjo = arranjoDoMural(area, temLateral, topoSempre);
  return (
    <View onLayout={(e) => setArea(e.nativeEvent.layout.width)} style={arranjo === 'lado' ? estilos.ladoALado : undefined}>
      <View testID="coluna-das-publicacoes" style={estilos.feed}>
        {arranjo === 'topo' ? lateral(true) : null}
        {children}
      </View>
      {arranjo === 'lado' ? (
        <View testID={idDaLateral} role="complementary" aria-label={rotulo}
          style={[estilos.lateral, GRUDADA, Platform.OS === 'web' && { maxHeight: janela.height - espaco(4) }]}>
          {lateral(false)}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // `flex-start`: sem ele a coluna estica até a altura do feed e o `sticky` não tem para onde andar.
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DA_LATERAL },
  feed: { width: '100%', maxWidth: LARGURA_DO_FEED, flexShrink: 1, gap: espaco(3) },
  lateral: { width: LARGURA_DA_LATERAL, flexShrink: 0, alignSelf: 'flex-start', gap: espaco(3) },
});
