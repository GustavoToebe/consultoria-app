import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import type { ChaveDeIdentificacao, CorDeIdentificacao } from '../tema/tokens';
import { corDaSerie, LARGURA_DA_FAIXA_DA_SERIE, pinturaDaSerie, type EstadoDaSerie, type PinturaDaSerie } from './pinturaDaSerie';
import { fundoPintado } from './superficiePintada';

/** A cor da série (tipo ou ação, pela preferência "Cor das séries") e a cor do selo do tipo (nula no modo de ação). */
export function useCorDaSerie(chave: ChaveDeIdentificacao | null | undefined): { cor: string | null; categoria: CorDeIdentificacao | null } {
  const { cores, identificacao, preferencias } = useTema();
  return corDaSerie(preferencias?.corDasSeries ?? 'TIPO', chave, identificacao, cores);
}

/** A pintura da série com o tema em uso. */
export function usePinturaDaSerie(cor: string | null, estado: EstadoDaSerie): PinturaDaSerie {
  const { cores, variante, bordas } = useTema();
  return pinturaDaSerie(cor, estado, cores, variante, bordas.item);
}

/** O fundo do cartão pintado (degradê; sem cor, a superfície). O canto do cartão já recorta o fundo, sem `overflow`. */
export function fundoDaSerie(p: PinturaDaSerie, superficie: string): ViewStyle {
  return p.pintada ? fundoPintado(p.pintada) : { backgroundColor: superficie };
}

/**
 * A camada por cima do cartão da série: a faixa reta de 4 px à esquerda e a borda, recortadas pelo canto (`overflow:
 * hidden` só nesta camada, que não corta o anel de foco do conteúdo; nada de `borderLeft` com canto arredondado, que faz a
 * curva estranha). A faixa entra a largura da borda a mais: cobre a borda do lado esquerdo (sem emenda de 1 px) e, na
 * ativa, a borda de ação passa por cima dela e ainda sobram 4 px. Fora do fluxo: o conteúdo não se mexe quando a série
 * vira a da vez. Quem usa põe `raio` igual ao do cartão e o recuo da faixa no conteúdo. `semBorda` = só a faixa (a linha
 * aberta do editor, que tem o destaque de edição).
 */
export function CamadaDaSerie({ pintura: p, ativa, raio, semBorda = false, testID }: {
  pintura: PinturaDaSerie;
  ativa: boolean;
  raio: number;
  semBorda?: boolean;
  testID?: string;
}) {
  const borda = semBorda ? null : <View style={[StyleSheet.absoluteFill, { borderRadius: raio, borderWidth: p.larguraDaBorda, borderColor: p.borda }]} />;
  const faixa = p.faixa ? <View testID={testID ? `${testID}-faixa` : undefined} style={[estilos.faixa, { width: LARGURA_DA_FAIXA_DA_SERIE + (semBorda ? 0 : p.larguraDaBorda), backgroundColor: p.faixa }]} /> : null;
  if (!borda && !faixa) return null;
  return (
    <View pointerEvents="none" aria-hidden style={[StyleSheet.absoluteFill, estilos.camada, { borderRadius: raio }]}>
      {ativa ? <>{faixa}{borda}</> : <>{borda}{faixa}</>}
    </View>
  );
}

const estilos = StyleSheet.create({
  camada: { overflow: 'hidden' },
  faixa: { position: 'absolute', left: 0, top: 0, bottom: 0 },
});
