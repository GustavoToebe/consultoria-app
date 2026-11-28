import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { folhaNaTela, LARGURA_DA_FOLHA, type ZoomDaFolha } from '../../../dominio/editorDoPdf';
import type { Documento } from '../../../pdf/html';
import { useTema } from '../../../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../../../tema/tokens';
import { Escolha } from '../../../ui/Escolha';
import { useFaixaDeLargura } from '../../../ui/useFaixaDeLargura';
import { PreviaDoDocumento } from '../PreviaDoDocumento';
import { Ampliada } from './Ampliada';

const ZOOMS: { valor: ZoomDaFolha; rotulo: string }[] = [
  { valor: 'AJUSTAR', rotulo: 'Ajustar' },
  { valor: 'CEM', rotulo: '100%' },
];
/** Respiro da folha na coluna (dos lados e embaixo): sem mesa cinza, é só o espaço para a sombra e entre as folhas. */
export const RESPIRO_DA_FOLHA = espaco(2);
/** `overflow-x` existe no react-native-web (CSS), mas não no tipo do React Native. */
const ROLA_DE_LADO = (Platform.OS === 'web' ? { overflowX: 'auto' } : {}) as unknown as ViewStyle;

interface Props {
  documento: Documento;
  /** Nome acessível da folha ("Prévia do PDF de treino no modelo Clássico, com dados de exemplo"). */
  rotulo: string;
  /** Nome da região ("Prévia do treino"). */
  regiao: string;
  /** Prende o CSS da prévia a esta instância (prévias lado a lado não trocam de CSS). */
  chave: string;
  /** O topo da coluna, à esquerda do zoom: o segmento do documento ou o título (três prévias). */
  cabeca: ReactNode;
  zoom: ZoomDaFolha;
  aoMudarZoom: (zoom: ZoomDaFolha) => void;
}

/**
 * Uma prévia do editor (28/11): o topo e a folha, sem mesa. O papel é sempre branco (`PAPEL_DA_FOLHA`, o `.previa-pdf`), com
 * o contorno fino `divisor` da `PreviaDoDocumento` e a sombra do cartão (`sombra` do tema), num respiro de 16 px. A folha
 * ocupa a largura da coluna em proporção A4 (`folhaNaTela`: "Ajustar" de 60% a 125%, ou "100%", a A4 real rolando de lado,
 * quando a ajustada fica menor que ela; só então o controle aparece) e encosta à esquerda, alinhada ao topo. A folha é
 * trocada no lugar a cada opção: a página não volta ao topo.
 */
export function PreviaNaMesa({ documento, rotulo, regiao, chave, cabeca, zoom, aoMudarZoom }: Props) {
  const { cores } = useTema();
  const { largura: coluna, aoMedir } = useFaixaDeLargura();
  const folha = folhaNaTela(Math.max(0, coluna - 2 * RESPIRO_DA_FOLHA), zoom);
  return (
    <View role="region" aria-label={regiao} onLayout={aoMedir} style={estilos.coluna}>
      <View style={estilos.topo}>
        <View style={estilos.cabeca}>{cabeca}</View>
        {folha.zoomMuda ? <Escolha descricao="Tamanho da prévia" opcoes={ZOOMS} valor={zoom} aoMudar={aoMudarZoom} /> : null}
      </View>
      {/* Rolando de lado, a caixa entra no Tab: dá para rolar pelas setas sem mouse (WCAG 2.1.1). */}
      <View focusable={folha.rolaDeLado} style={folha.rolaDeLado ? ROLA_DE_LADO : null}>
        {coluna > 0 ? (
          <View style={[estilos.folha, { width: folha.largura, boxShadow: cores.sombra }]}>
            <Ampliada escala={folha.largura / LARGURA_DA_FOLHA}>
              <PreviaDoDocumento documento={documento} rotulo={rotulo} chave={chave} />
            </Ampliada>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { flex: 1, minWidth: 0, gap: espaco(1.5), paddingHorizontal: RESPIRO_DA_FOLHA, paddingBottom: RESPIRO_DA_FOLHA },
  // A altura do `Escolha` (alvo de 44 mais a trilha): lado a lado, os topos têm a mesma altura e as folhas começam na mesma linha.
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', justifyContent: 'space-between', gap: espaco(1.5), minHeight: ALVO_TOQUE + espaco(1) },
  cabeca: { flexGrow: 1, flexShrink: 1, minWidth: 200 },
  // À esquerda (`flex-start`), sob o segmento; na rolagem lateral, centrada, a borda esquerda ficaria fora do alcance.
  folha: { flexShrink: 0, alignSelf: 'flex-start' },
});
