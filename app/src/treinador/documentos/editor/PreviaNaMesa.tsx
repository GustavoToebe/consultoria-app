import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { folhaNaTela, LARGURA_DA_FOLHA, type ZoomDaFolha } from '../../../dominio/editorDoPdf';
import type { Documento } from '../../../pdf/html';
import { useTema } from '../../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, MESA_DA_PREVIA, RAIO } from '../../../tema/tokens';
import { Escolha } from '../../../ui/Escolha';
import { useFaixaDeLargura } from '../../../ui/useFaixaDeLargura';
import { PreviaDoDocumento } from '../PreviaDoDocumento';
import { Ampliada } from './Ampliada';

export type DocumentoDeExemplo = 'treino' | 'dieta' | 'mobilidade';

const ZOOMS: { valor: ZoomDaFolha; rotulo: string }[] = [
  { valor: 'AJUSTAR', rotulo: 'Ajustar' },
  { valor: 'CEM', rotulo: '100%' },
];
/** Recuo da mesa em volta da folha. */
const RECUO = espaco(3);
/** `overflow-x` existe no react-native-web (CSS), mas não no tipo do React Native. */
const ROLA_DE_LADO = (Platform.OS === 'web' ? { overflowX: 'auto' } : {}) as unknown as ViewStyle;

interface Props {
  documento: Documento;
  /** Nome acessível da folha ("Prévia do PDF de treino no modelo Clássico, com dados de exemplo"). */
  rotulo: string;
  /** Nome da região (uma prévia: "Prévia com dados de exemplo"; duas: "Prévia do treino"). */
  regiao: string;
  /** Prende o CSS da prévia a esta instância (duas prévias lado a lado não trocam de CSS). */
  chave: string;
  /** O topo da coluna, à esquerda do zoom: as abas (uma prévia) ou o título (duas). */
  cabeca: ReactNode;
  zoom: ZoomDaFolha;
  aoMudarZoom: (zoom: ZoomDaFolha) => void;
}

/**
 * Uma prévia do editor (orientações 3.2): o topo e a folha numa mesa (`MESA_DA_PREVIA`, o mesmo cinza em todos os temas)
 * com sombra leve, para o papel, sempre branco, se destacar em qualquer tema. A mesa ocupa a coluna inteira (27/11: sem a
 * faixa vazia dos lados) e a folha, centralizada nela, segue `folhaNaTela`: "Ajustar" de 60% a 125%, ou "100%" (a A4 real,
 * rolando de lado) quando a ajustada fica menor que ela; só então o controle aparece. A folha é trocada no lugar a cada
 * opção: a página não volta ao topo.
 */
export function PreviaNaMesa({ documento, rotulo, regiao, chave, cabeca, zoom, aoMudarZoom }: Props) {
  const { cores } = useTema();
  const { largura: mesa, aoMedir } = useFaixaDeLargura();
  const folha = folhaNaTela(Math.max(0, mesa - 2 * RECUO), zoom);
  return (
    <View role="region" aria-label={regiao} style={estilos.coluna}>
      <View style={estilos.topo}>
        <View style={estilos.cabeca}>{cabeca}</View>
        {folha.zoomMuda ? <Escolha descricao="Tamanho da prévia" opcoes={ZOOMS} valor={zoom} aoMudar={aoMudarZoom} /> : null}
      </View>
      {/* Rolando de lado, a mesa entra no Tab: dá para rolar pelas setas sem mouse (WCAG 2.1.1). */}
      <View onLayout={aoMedir} focusable={folha.rolaDeLado} style={[estilos.mesa, { backgroundColor: MESA_DA_PREVIA }, folha.rolaDeLado ? ROLA_DE_LADO : null]}>
        {mesa > 0 ? (
          <View style={[estilos.folha, { width: folha.largura, boxShadow: cores.sombra, alignSelf: folha.rolaDeLado ? 'flex-start' : 'center' }]}>
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
  coluna: { flex: 1, minWidth: 0, gap: espaco(1.5) },
  // A altura do `Escolha` (alvo de 44 mais a trilha): lado a lado, o topo com o controle e o sem ele começam a mesa na mesma linha.
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center', justifyContent: 'space-between', gap: espaco(1.5), minHeight: ALVO_TOQUE + espaco(1) },
  cabeca: { flexGrow: 1, flexShrink: 1, minWidth: 200 },
  mesa: { flexGrow: 1, padding: RECUO, borderRadius: RAIO },
  // Na rolagem lateral a folha encosta à esquerda (`flex-start`): centrada, a borda esquerda ficaria fora do alcance da rolagem.
  folha: { flexShrink: 0 },
});
