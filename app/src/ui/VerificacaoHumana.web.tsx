import { useEffect, useRef, useState } from 'react';

import {
  ALTURA_INICIAL,
  reagirAoWidget,
  siteKeyValida,
  TEXTO_FALHA_AO_CARREGAR,
  URL_DO_SCRIPT_TURNSTILE,
  type MensagemDoWidget,
} from '../dominio/verificacaoHumana';
import { useTema } from '../tema/TemaProvider';
import { MensagemErro } from './Estados';
import type { PropsVerificacaoHumana } from './verificacaoHumanaTipos';

interface TurnstileApi {
  render: (container: HTMLElement, opcoes: Record<string, unknown>) => string | undefined;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

const ATRIBUTO_DO_SCRIPT = 'data-turnstile-api';

function api(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

let promessaDoScript: Promise<TurnstileApi> | null = null;

/** Carrega o `api.js` do Turnstile uma vez só (a mesma promessa para todos); falha não fica guardada e a tag some, para tentar de novo. */
function carregarScript(): Promise<TurnstileApi> {
  const pronta = api();
  if (pronta) return Promise.resolve(pronta);
  if (promessaDoScript) return promessaDoScript;
  const promessa = new Promise<TurnstileApi>((resolver, rejeitar) => {
    let tag = document.querySelector<HTMLScriptElement>(`script[${ATRIBUTO_DO_SCRIPT}]`);
    if (!tag) {
      tag = document.createElement('script');
      tag.src = URL_DO_SCRIPT_TURNSTILE;
      tag.async = true;
      tag.defer = true;
      tag.setAttribute(ATRIBUTO_DO_SCRIPT, '');
      document.head.appendChild(tag);
    }
    const script = tag;
    script.addEventListener('load', () => {
      const carregada = api();
      if (carregada) {
        resolver(carregada);
      } else {
        script.remove();
        rejeitar(new Error('turnstile indisponível'));
      }
    });
    script.addEventListener('error', () => {
      script.remove();
      rejeitar(new Error('script do turnstile não carregou'));
    });
  });
  promessaDoScript = promessa;
  promessa.catch(() => {
    if (promessaDoScript === promessa) promessaDoScript = null;
  });
  return promessa;
}

/**
 * Widget do Turnstile na web: script da Cloudflare injetado uma vez, `render` explícito e `remove` ao desmontar. O tema
 * acompanha o do app (muda o tema, o widget é desenhado de novo). O token vai só a `onToken`, nunca a log.
 */
export function VerificacaoHumana({ siteKey, onToken, chave }: PropsVerificacaoHumana) {
  const { modo } = useTema();
  const tema = modo === 'CLARO' ? 'light' : 'dark';
  const chaveValida = siteKeyValida(siteKey);
  const container = useRef<HTMLDivElement>(null);
  const aoToken = useRef(onToken);
  const widget = useRef<string | null>(null);
  const falhasSeguidas = useRef(0);
  const chaveAplicada = useRef(chave);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    aoToken.current = onToken;
  });

  useEffect(() => {
    if (!chaveValida) {
      aoToken.current(null);
      return;
    }
    if (falhou) return;
    let cancelado = false;
    let id: string | null = null;
    let espera: ReturnType<typeof setTimeout> | null = null;

    const tratar = (mensagem: MensagemDoWidget) => {
      // Callback atrasado de um widget que já saiu da tela não mexe no token da tela.
      if (cancelado) return;
      const reacao = reagirAoWidget(mensagem, falhasSeguidas.current);
      falhasSeguidas.current = reacao.falhas;
      if (reacao.token !== undefined) aoToken.current(reacao.token);
      if (reacao.falhou) setFalhou(true);
      if (reacao.renovar) {
        espera = setTimeout(() => {
          espera = null;
          if (!cancelado && id !== null) api()?.reset(id);
        }, reacao.atrasoMs);
      }
    };

    carregarScript().then(
      (turnstile) => {
        if (cancelado || !container.current) return;
        aoToken.current(null);
        id =
          turnstile.render(container.current, {
            sitekey: siteKey,
            theme: tema,
            size: 'flexible',
            language: 'pt-br',
            retry: 'never',
            'refresh-expired': 'manual',
            'refresh-timeout': 'manual',
            callback: (token: unknown) => {
              if (typeof token === 'string' && token.length > 0) tratar({ tipo: 'token', token });
            },
            'expired-callback': () => tratar({ tipo: 'expirou' }),
            'timeout-callback': () => tratar({ tipo: 'expirou' }),
            'error-callback': () => {
              tratar({ tipo: 'erro' });
              return true;
            },
          }) ?? null;
        widget.current = id;
        if (id === null) {
          aoToken.current(null);
          setFalhou(true);
        }
      },
      () => {
        if (cancelado) return;
        aoToken.current(null);
        setFalhou(true);
      },
    );

    return () => {
      cancelado = true;
      if (espera !== null) clearTimeout(espera);
      if (id !== null) {
        try {
          api()?.remove(id);
        } catch {
          // O widget já tinha saído da página.
        }
        if (widget.current === id) widget.current = null;
      }
    };
  }, [chaveValida, siteKey, tema, tentativa, falhou]);

  // Depois de cada envio a tela muda `chave`: o token foi gasto, desafio novo.
  useEffect(() => {
    if (chave === chaveAplicada.current) return;
    chaveAplicada.current = chave;
    falhasSeguidas.current = 0;
    if (widget.current !== null) api()?.reset(widget.current);
  }, [chave]);

  const tentarDeNovo = () => {
    falhasSeguidas.current = 0;
    setFalhou(false);
    setTentativa((n) => n + 1);
  };

  if (!chaveValida) {
    return <MensagemErro texto={TEXTO_FALHA_AO_CARREGAR} />;
  }
  if (falhou) {
    return <MensagemErro texto={TEXTO_FALHA_AO_CARREGAR} tentarDeNovo={tentarDeNovo} />;
  }
  return <div ref={container} style={{ width: '100%', minHeight: ALTURA_INICIAL }} />;
}
