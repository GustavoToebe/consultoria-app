import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO, type ChaveDeIdentificacao } from '../tema/tokens';
import { CamadaDaSerie, fundoDaSerie, useCorDaSerie, usePinturaDaSerie } from '../ui/CamadaDaSerie';
import { LARGURA_DA_FAIXA_DA_SERIE } from '../ui/pinturaDaSerie';

/**
 * A caixa do cartão da série na tela do exercício (25/11): pintada na cor da série (a do tipo ou a de ação, pela
 * preferência "Cor das séries") com a faixa reta à esquerda (`ui/CamadaDaSerie`, a mesma peça das linhas do editor de
 * treino). A ativa (a da vez) ganha a borda de ação por cima, a feita continua na cor (o "feita" é o ✓ verde e o selo) e
 * a pendente fica apagada.
 */
export function CartaoDaSerie({ testID, corDoTipo, feita, ativa, children }: {
  testID: string;
  corDoTipo: ChaveDeIdentificacao | null;
  feita: boolean;
  ativa: boolean;
  children: ReactNode;
}) {
  const { cores } = useTema();
  const daVez = ativa && !feita;
  const p = usePinturaDaSerie(useCorDaSerie(corDoTipo).cor, feita ? 'CHEIA' : daVez ? 'ATIVA' : 'APAGADA');
  return (
    <View testID={testID} style={[estilos.serie, fundoDaSerie(p, cores.superficie), p.faixa ? { paddingLeft: espaco(1.5) + LARGURA_DA_FAIXA_DA_SERIE } : null]}>
      {children}
      <CamadaDaSerie pintura={p} ativa={daVez} raio={RAIO} testID={testID} />
    </View>
  );
}

const estilos = StyleSheet.create({
  serie: { borderRadius: RAIO, padding: espaco(1.5), gap: espaco(1) },
});
