import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, RAIO, type ChaveDeIdentificacao } from '../tema/tokens';
import { fundoPintado } from '../ui/superficiePintada';
import { LARGURA_DA_FAIXA_DA_SERIE, pinturaDaSerie, type EstadoDaSerie } from './coresDoMarcarSerie';

/**
 * A caixa do cartão da série na tela do exercício (25/11): pintada na cor do tipo (`pinturaDaSerie`) com a faixa reta de
 * 4 px à esquerda. A faixa e a borda são camadas por cima do conteúdo, recortadas pelo canto do cartão (`overflow:
 * hidden`): nada de `borderLeft` com canto arredondado (a curva estranha). A faixa cobre a borda do lado esquerdo (sem
 * emenda de 1 px); só a borda de ação da série ativa passa por cima dela. A borda fora do fluxo não mexe no conteúdo
 * quando a série vira a da vez.
 */
export function CartaoDaSerie({ testID, corDoTipo, estado, children }: {
  testID: string;
  corDoTipo: ChaveDeIdentificacao | null;
  estado: EstadoDaSerie;
  children: ReactNode;
}) {
  const { cores, variante, bordas, identificacao } = useTema();
  const p = pinturaDaSerie(corDoTipo ? identificacao[corDoTipo].cor : null, estado, cores, variante, bordas.item);
  const borda = <View pointerEvents="none" style={[StyleSheet.absoluteFill, estilos.borda, { borderWidth: p.larguraDaBorda, borderColor: p.borda }]} />;
  const faixa = p.faixa ? <View pointerEvents="none" testID={`${testID}-faixa`} style={[estilos.faixa, { width: LARGURA_DA_FAIXA_DA_SERIE + p.larguraDaBorda, backgroundColor: p.faixa }]} /> : null;
  return (
    <View
      testID={testID}
      style={[
        estilos.serie,
        p.pintada ? fundoPintado(p.pintada) : { backgroundColor: cores.superficie },
        p.faixa ? { paddingLeft: espaco(1.5) + LARGURA_DA_FAIXA_DA_SERIE } : null,
      ]}>
      {children}
      {estado === 'ATIVA' ? <>{faixa}{borda}</> : <>{borda}{faixa}</>}
    </View>
  );
}

const estilos = StyleSheet.create({
  serie: { borderRadius: RAIO, overflow: 'hidden', padding: espaco(1.5), gap: espaco(1) },
  borda: { borderRadius: RAIO },
  // A faixa entra a largura da borda a mais: cobre a borda (sem emenda) e, na ativa, sobram 4 px depois da borda de ação.
  faixa: { position: 'absolute', left: 0, top: 0, bottom: 0 },
});
