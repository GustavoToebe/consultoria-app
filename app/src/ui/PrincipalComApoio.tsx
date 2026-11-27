import { type ReactNode, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import {
  arranjoPrincipalComApoio, larguraDoApoioDaFaixa, TOPO_DO_APOIO, VAO_DA_PRINCIPAL,
} from '../dominio/arranjoPrincipalComApoio';
import { espaco } from '../tema/tokens';
import { useFaixaDaTela } from './Tela';

/** `position: sticky` existe no react-native-web (CSS), mas não no tipo do React Native (o mesmo de `MuralComLateral`). */
const grudada = (topo: number) => (Platform.OS === 'web' ? { position: 'sticky', top: topo, overflowY: 'auto' } : {}) as unknown as ViewStyle;

/**
 * Coluna principal (o que se lê em ordem, de cima para baixo) + coluna de apoio (resumos, totais e ações), padrão das telas
 * do aluno na web larga (`docs/planos/orientacoes-de-design-26-11.md`, 0.2). Mede a própria área: com espaço
 * (`arranjoPrincipalComApoio`, a partir de 972) o apoio fica ao lado, com 380, 420 ou 440 pela faixa da `Tela`, grudado ao
 * rolar abaixo da barra (a altura dele não passa da janela e rola por dentro); sem espaço, empilha, com o apoio depois da
 * principal (ou antes, com `apoioNoTopo`, para o que pede ação). No DOM a principal vem SEMPRE primeiro (leitor de tela e
 * Tab leem o conteúdo antes do resumo): o lado visual do apoio vem de `row-reverse`/`column-reverse`. `apoio` nulo não
 * desenha nada, nem o vão. A principal nunca espera o apoio; o apoio só leva resumos, totais, ações e atalhos.
 */
export function PrincipalComApoio({ principal, apoio, rotuloDoApoio, idDoApoio, apoioAEsquerda, apoioNoTopo, larguraDoApoio, topoDoApoio, alturaForaDaRolagem, testID }: {
  principal: ReactNode;
  apoio?: ReactNode;
  /** Nome da região de apoio (leitor de tela). */
  rotuloDoApoio: string;
  idDoApoio?: string;
  /** Lado a lado: apoio à esquerda da principal (ex.: resumo da sessão do dia). Padrão: à direita. */
  apoioAEsquerda?: boolean;
  /** Empilhado: apoio acima da principal. Padrão: abaixo. */
  apoioNoTopo?: boolean;
  /** Padrão: 380, 420 ou 440 pela faixa da `Tela` (`larguraDoApoioDaFaixa`). */
  larguraDoApoio?: number;
  /**
   * Distância do apoio ao topo da ÁREA DE ROLAGEM em que ele gruda. Padrão 80: a barra do app fica dentro da rolagem (a página
   * inteira rola sob ela). Tela que prende barras FORA da rolagem (a do exercício) passa a folga que quer, ex.: 16.
   */
  topoDoApoio?: number;
  /** Altura das barras fixas que ficam fora da rolagem (topo e rodapé). Altura máxima do apoio = janela − isto − `topoDoApoio` − 16. Padrão 0. */
  alturaForaDaRolagem?: number;
  testID?: string;
}) {
  const [area, setArea] = useState<number | null>(null);
  const janela = useWindowDimensions();
  const faixa = useFaixaDaTela();
  const temApoio = apoio !== null && apoio !== undefined && apoio !== false;
  const largura = larguraDoApoio ?? larguraDoApoioDaFaixa(faixa);
  const arranjo = arranjoPrincipalComApoio(area, temApoio, largura);
  const lado = arranjo === 'lado';
  const topo = topoDoApoio ?? TOPO_DO_APOIO;
  return (
    <View onLayout={(e) => setArea(e.nativeEvent.layout.width)}
      style={lado ? [estilos.ladoALado, apoioAEsquerda && estilos.invertido] : [estilos.empilhado, apoioNoTopo && estilos.empilhadoInvertido]}>
      <View testID={testID} style={estilos.principal}>{principal}</View>
      {temApoio ? (
        <View testID={idDoApoio} role="complementary" aria-label={rotuloDoApoio}
          style={lado
            ? [estilos.apoioLateral, { width: largura }, grudada(topo), Platform.OS === 'web' && { maxHeight: janela.height - (alturaForaDaRolagem ?? 0) - topo - espaco(2) }]
            : estilos.apoioEmpilhado}>
          {apoio}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  // `flex-start`: sem ele o apoio estica até a altura da principal e o `sticky` não tem para onde andar.
  ladoALado: { flexDirection: 'row', alignItems: 'flex-start', gap: VAO_DA_PRINCIPAL },
  invertido: { flexDirection: 'row-reverse' },
  empilhado: { gap: espaco(3) },
  empilhadoInvertido: { flexDirection: 'column-reverse' },
  principal: { flex: 1, minWidth: 0, gap: espaco(3) },
  apoioLateral: { flexShrink: 0, alignSelf: 'flex-start', gap: espaco(3) },
  apoioEmpilhado: { gap: espaco(3) },
});
