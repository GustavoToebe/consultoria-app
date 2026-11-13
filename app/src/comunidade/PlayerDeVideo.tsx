import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { ORIGEM_DO_WIDGET } from '../dominio/verificacaoHumana';
import { htmlDoPlayer, navegacaoDoPlayerPermitida } from '../dominio/comunidade';

const ORIGENS_PERMITIDAS = ['https://*', 'about:*'];

/**
 * Player do YouTube no celular (D8): uma página nossa, feita só do id já validado, com o iframe do `youtube-nocookie`; o
 * `baseUrl` (a origem do app) é o que o embed recebe de Referer. Navegação travada nessa página e no `youtube-nocookie.com`
 * (como o WebView do Turnstile), sem janela nova. Montado só depois do toque (`CapaDoVideo`); sem token nem cookie nosso.
 */
export function PlayerDeVideo({ id, titulo }: { id: string; titulo: string }) {
  return (
    <WebView
      source={{ html: htmlDoPlayer(id, titulo), baseUrl: ORIGEM_DO_WIDGET }}
      style={estilos.webview}
      originWhitelist={ORIGENS_PERMITIDAS}
      javaScriptEnabled
      onShouldStartLoadWithRequest={(pedido) => navegacaoDoPlayerPermitida(pedido.url, ORIGEM_DO_WIDGET)}
      setSupportMultipleWindows={false}
      javaScriptCanOpenWindowsAutomatically={false}
      mixedContentMode="never"
      allowsLinkPreview={false}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      accessibilityLabel={`Vídeo: ${titulo}`}
    />
  );
}

const estilos = StyleSheet.create({
  // O fundo preto do vídeo é o da página do player (conteúdo do vídeo, como na `PreviaDaImagem`); aqui fica transparente.
  webview: { flex: 1, backgroundColor: 'transparent' },
});
