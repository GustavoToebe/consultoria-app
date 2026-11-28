import { type ReactNode, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { apoioGruda, VAO_DA_PRINCIPAL } from '../../dominio/arranjoPrincipalComApoio';
import { espaco } from '../../tema/tokens';

/** Topo do apoio grudado: no PC o cabeçalho rola com a página (não há barra fixa), então 16 da borda da área de rolagem. */
const TOPO = espaco(2);
/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native. Sem `overflowY`: nunca rola por dentro. */
const grudada = { position: 'sticky', top: TOPO } as unknown as ViewStyle;

/**
 * Aba Dieta do aluno na web larga (28/11): refeições na principal e, à direita, o apoio (ações, Total do dia, água) com a
 * largura da faixa da `Tela`. Diferente da `ui/PrincipalComApoio` (que gruda sempre e, mais alta que a janela, rola por
 * dentro), o apoio aqui NÃO tem rolagem própria: gruda ao rolar só quando cabe inteiro na janela (`apoioGruda`, a regra da
 * coluna do treino) e, mais alto, rola com a página. Principal primeiro no DOM (leitor e Tab leem o conteúdo antes do resumo).
 */
export function DietaComApoio({ principal, apoio, largura }: { principal: ReactNode; apoio: ReactNode; largura: number }) {
  const [altura, setAltura] = useState(0);
  const janela = useWindowDimensions();
  const gruda = Platform.OS === 'web' && apoioGruda(altura, janela.height - TOPO - espaco(2));
  return (
    <View style={estilos.linha}>
      <View style={estilos.principal}>{principal}</View>
      <View testID="apoio-da-dieta" role="complementary" aria-label="Resumo da dieta" onLayout={(e) => setAltura(e.nativeEvent.layout.height)}
        style={[estilos.apoio, { width: largura }, gruda && grudada]}>
        {apoio}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // `flex-start`: sem ele o apoio estica até a altura da principal e o `sticky` não tem para onde andar.
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DA_PRINCIPAL },
  principal: { flex: 1, minWidth: 0, gap: espaco(3) },
  apoio: { flexShrink: 0, alignSelf: 'flex-start', gap: espaco(3) },
});
