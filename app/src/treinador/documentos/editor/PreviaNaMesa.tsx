import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { folhaNaTela, LARGURA_DA_FOLHA, type ZoomDaFolha } from '../../../dominio/editorDoPdf';
import type { Documento } from '../../../pdf/html';
import { useTema } from '../../../tema/TemaProvider';
import { espaco, MESA_DA_PREVIA, RAIO } from '../../../tema/tokens';
import { Abas } from '../../../ui/Abas';
import { Escolha } from '../../../ui/Escolha';
import { Texto } from '../../../ui/Texto';
import { useFaixaDeLargura } from '../../../ui/useFaixaDeLargura';
import { PreviaDoDocumento } from '../PreviaDoDocumento';

export type DocumentoDeExemplo = 'treino' | 'dieta';

const ABAS: { valor: DocumentoDeExemplo; rotulo: string }[] = [
  { valor: 'treino', rotulo: 'Treino' },
  { valor: 'dieta', rotulo: 'Dieta' },
];
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
  rotulo: string;
  aba: DocumentoDeExemplo;
  aoMudarAba: (aba: DocumentoDeExemplo) => void;
  zoom: ZoomDaFolha;
  aoMudarZoom: (zoom: ZoomDaFolha) => void;
}

/**
 * A prévia do editor (orientações 3.2): Treino | Dieta de exemplo e a folha numa mesa (`MESA_DA_PREVIA`, o mesmo cinza em todos os temas) com sombra leve, para
 * o papel, sempre branco, se destacar em qualquer tema. O zoom é a largura que a folha recebe (a prévia se reduz para caber
 * nela): "Ajustar" ao espaço, com piso de 60%, ou "100%" (a A4 real, rolando de lado quando não cabe). O controle só
 * aparece quando os dois dão folhas diferentes. A folha é trocada no lugar a cada opção: a página não volta ao topo.
 */
export function PreviaNaMesa({ documento, rotulo, aba, aoMudarAba, zoom, aoMudarZoom }: Props) {
  const { cores } = useTema();
  const { largura: mesa, aoMedir } = useFaixaDeLargura();
  const espacoDaFolha = Math.max(0, mesa - 2 * RECUO);
  const folha = folhaNaTela(espacoDaFolha, zoom);
  return (
    <View style={estilos.area}>
    <View role="region" aria-label="Prévia com dados de exemplo" style={estilos.coluna}>
      <View style={estilos.topo}>
        <View style={estilos.abas}><Abas abas={ABAS} ativa={aba} aoMudar={aoMudarAba} /></View>
        {folha.zoomMuda ? <Escolha descricao="Tamanho da prévia" opcoes={ZOOMS} valor={zoom} aoMudar={aoMudarZoom} /> : null}
      </View>
      <Texto variante="pequeno">Dados de exemplo, nenhum é real. A folha é contínua: as quebras de página só aparecem no PDF.</Texto>
      {/* Rolando de lado, a mesa entra no Tab: dá para rolar pelas setas sem mouse (WCAG 2.1.1). */}
      <View onLayout={aoMedir} focusable={folha.rolaDeLado} style={[estilos.mesa, { backgroundColor: MESA_DA_PREVIA }, folha.rolaDeLado ? ROLA_DE_LADO : null]}>
        {mesa > 0 ? (
          <View style={[estilos.folha, { width: folha.largura, boxShadow: cores.sombra, alignSelf: folha.rolaDeLado ? 'flex-start' : 'center' }]}>
            <PreviaDoDocumento documento={documento} rotulo={rotulo} chave="editor-do-pdf" />
          </View>
        ) : null}
      </View>
    </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  // O teto é a folha a 100% com a mesa em volta: a sobra da tela larga vira margem dos dois lados, não mesa vazia.
  area: { flex: 1, minWidth: 0, alignItems: 'center' },
  coluna: { width: '100%', maxWidth: LARGURA_DA_FOLHA + 2 * RECUO, gap: espaco(1.5) },
  topo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  abas: { flexGrow: 1, flexShrink: 1, minWidth: 200 },
  mesa: { padding: RECUO, borderRadius: RAIO },
  // Na rolagem lateral a folha encosta à esquerda (`flex-start`): centrada, a borda esquerda ficaria fora do alcance da rolagem.
  folha: { flexShrink: 0 },
});
