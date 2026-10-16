import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import {
  ALTURA_INICIAL,
  erroHttpFatalDoWidget,
  htmlDoWidget,
  lerMensagemDoWidget,
  navegacaoPermitida,
  ORIGEM_DO_WIDGET,
  reagirAoWidget,
  TEXTO_FALHA_AO_CARREGAR,
} from '../dominio/verificacaoHumana';
import { useTema } from '../tema/TemaProvider';
import { MensagemErro } from './Estados';
import type { PropsVerificacaoHumana } from './verificacaoHumanaTipos';

const RENOVAR_NA_PAGINA = 'window.renovarWidget && window.renovarWidget(); true;';
const ORIGENS_PERMITIDAS = ['https://*', 'about:*'];

/**
 * Widget do Turnstile no celular: roda dentro de um WebView com a origem do app na web (`baseUrl`), porque o Turnstile só
 * funciona em página http(s) do hostname cadastrado. A página (`htmlDoWidget`) avisa o app por mensagem; o WebView só
 * navega para a Cloudflare. O token vai só a `onToken`, nunca a log.
 */
export function VerificacaoHumana({ siteKey, onToken, chave }: PropsVerificacaoHumana) {
  const { modo } = useTema();
  const tema = modo === 'CLARO' ? 'light' : 'dark';
  const html = useMemo(() => htmlDoWidget(siteKey, tema), [siteKey, tema]);
  const webview = useRef<WebView>(null);
  const aoToken = useRef(onToken);
  const falhasSeguidas = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chaveAplicada = useRef(chave);
  const [altura, setAltura] = useState(ALTURA_INICIAL);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    aoToken.current = onToken;
  });

  const cancelarEspera = useCallback(() => {
    if (espera.current !== null) {
      clearTimeout(espera.current);
      espera.current = null;
    }
  }, []);

  const renovar = useCallback(
    (atrasoMs: number) => {
      cancelarEspera();
      const pedir = () => {
        espera.current = null;
        webview.current?.injectJavaScript(RENOVAR_NA_PAGINA);
      };
      if (atrasoMs > 0) {
        espera.current = setTimeout(pedir, atrasoMs);
      } else {
        pedir();
      }
    },
    [cancelarEspera],
  );

  // Chave inválida ou tema novo (a página recarrega): o token que a tela tinha não vale mais.
  useEffect(() => {
    aoToken.current(null);
  }, [html]);

  // Depois de cada envio a tela muda `chave`: desafio novo.
  useEffect(() => {
    if (chave === chaveAplicada.current) return;
    chaveAplicada.current = chave;
    falhasSeguidas.current = 0;
    renovar(0);
  }, [chave, renovar]);

  useEffect(() => cancelarEspera, [cancelarEspera]);

  const falhar = useCallback(() => {
    cancelarEspera();
    aoToken.current(null);
    setFalhou(true);
  }, [cancelarEspera]);

  const aoMensagem = useCallback(
    (evento: WebViewMessageEvent) => {
      const mensagem = lerMensagemDoWidget(evento.nativeEvent.data);
      if (!mensagem) return;
      const reacao = reagirAoWidget(mensagem, falhasSeguidas.current);
      falhasSeguidas.current = reacao.falhas;
      if (reacao.token !== undefined) aoToken.current(reacao.token);
      if (reacao.altura !== undefined) setAltura(reacao.altura);
      if (reacao.falhou) setFalhou(true);
      if (reacao.renovar) renovar(reacao.atrasoMs);
    },
    [renovar],
  );

  const tentarDeNovo = () => {
    falhasSeguidas.current = 0;
    setAltura(ALTURA_INICIAL);
    setFalhou(false);
    setTentativa((n) => n + 1);
  };

  if (!html) {
    // Chave que não casa com o formato: nada é montado (a tela fica esperando o token e explica por quê).
    return <MensagemErro texto={TEXTO_FALHA_AO_CARREGAR} />;
  }
  if (falhou) {
    return <MensagemErro texto={TEXTO_FALHA_AO_CARREGAR} tentarDeNovo={tentarDeNovo} />;
  }
  return (
    <View style={estilos.caixa}>
      <WebView
        key={tentativa}
        ref={webview}
        source={{ html, baseUrl: ORIGEM_DO_WIDGET }}
        style={[estilos.webview, { height: altura }]}
        originWhitelist={ORIGENS_PERMITIDAS}
        javaScriptEnabled
        domStorageEnabled
        onShouldStartLoadWithRequest={(pedido) => navegacaoPermitida(pedido.url)}
        onMessage={aoMensagem}
        onError={falhar}
        onHttpError={(e) => {
          if (erroHttpFatalDoWidget(e.nativeEvent.url, e.nativeEvent.statusCode)) falhar();
        }}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        mixedContentMode="never"
        allowsLinkPreview={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="Verificação de segurança"
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { alignSelf: 'stretch', minHeight: ALTURA_INICIAL },
  webview: { backgroundColor: 'transparent', width: '100%' },
});
