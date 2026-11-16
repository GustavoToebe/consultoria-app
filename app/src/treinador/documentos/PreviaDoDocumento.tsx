import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { documentoCompleto, type Documento } from '../../pdf/html';
import { useTema } from '../../tema/TemaProvider';

export interface PropsDaPrevia {
  documento: Documento;
  /** Nome acessível da prévia ("Prévia do PDF de treino no tema Clássico"). */
  rotulo: string;
}

/** O documento vem do próprio app (`source={{ html }}`): no Android e no iPhone ele abre como `about:blank`. */
const ORIGENS = ['about:*'];
/** Folha em largura A4 (210 mm a 96 px por polegada), reduzida pelo WebView para caber na tela. */
const VIEWPORT = '<meta name="viewport" content="width=794">';
/** A margem de 14 mm que a impressão põe pelo `@page`, que a tela não usa. */
const MARGEM_DO_PAPEL = 'body { padding: 14mm; }';

/**
 * Prévia no celular (D10 de `docs/planos/documentos-pdf-motor.md`): o mesmo `documentoCompleto` do PDF num WebView sem
 * JavaScript e sem nenhuma navegação além do próprio documento (link tocado não abre). Altura fixa, porque sem script não
 * há como medir a folha: ela rola por dentro.
 */
export function PreviaDoDocumento({ documento, rotulo }: PropsDaPrevia) {
  const { height } = useWindowDimensions();
  const { cores } = useTema();
  const html = useMemo(
    () => documentoCompleto({ ...documento, css: `${documento.css}\n${MARGEM_DO_PAPEL}` }).replace('<head>', `<head>${VIEWPORT}`),
    [documento],
  );
  return (
    <View style={[estilos.caixa, { height: Math.round(height * 0.7), borderColor: cores.divisor }]}>
      <WebView
        source={{ html }}
        originWhitelist={ORIGENS}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        onShouldStartLoadWithRequest={(pedido) => pedido.url === 'about:blank'}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        allowFileAccess={false}
        mixedContentMode="never"
        allowsLinkPreview={false}
        nestedScrollEnabled
        accessibilityLabel={rotulo}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  // Contorno de 1 px (`divisor`): a folha branca não some sobre o cartão claro, como na web.
  caixa: { alignSelf: 'stretch', overflow: 'hidden', borderWidth: 1 },
});
