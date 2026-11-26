import * as Clipboard from 'expo-clipboard';
import { Copy, ExternalLink } from 'lucide-react-native';
import { useState } from 'react';

import { linkParaChrome, TEXTO_ABRA_NO_NAVEGADOR, TITULO_ABRA_NO_NAVEGADOR } from '../dominio/navegadorEmbutido';
import { useAviso } from './Aviso';
import { Botao } from './Botao';
import { Alerta } from './Estados';
import { LinhaDeAcoes } from './LinhaDeAcoes';
import { Texto } from './Texto';

/**
 * Bloco que o widget da verificação humana mostra, na web, quando falha num navegador de dentro de outro aplicativo (Instagram,
 * WhatsApp...) ou no Android: copiar o link da página e, no Android, abrir no Chrome. A verificação segue obrigatória; "Tentar de
 * novo" continua. É o mesmo nas telas que usam o widget (entrar, cadastro, "esqueci a senha", inscrição). O link nunca vai a log.
 */
export function AbraNoNavegador({ android, tentarDeNovo }: { android: boolean; tentarDeNovo: () => void }) {
  const { avisar } = useAviso();
  const [aMao, setAMao] = useState<string | null>(null);

  const copiar = () => {
    const endereco = window.location.href;
    const recusada = () => {
      setAMao(endereco);
      avisar('Não foi possível copiar. O link apareceu abaixo: selecione e copie à mão.', 'neutro');
    };
    // Na web o `setStringAsync` não rejeita quando o navegador recusa: resolve `false`.
    Clipboard.setStringAsync(endereco).then((ok) => (ok === false ? recusada() : avisar('Link copiado.', 'sucesso')), recusada);
  };
  const abrirNoChrome = () => {
    const intent = linkParaChrome(window.location.href);
    if (intent) window.location.href = intent;
  };

  return (
    <Alerta tom="atencao" titulo={TITULO_ABRA_NO_NAVEGADOR} texto={TEXTO_ABRA_NO_NAVEGADOR}>
      <LinhaDeAcoes>
        <Botao rotulo="Copiar link" tipo="secundario" Icone={Copy} aoTocar={copiar} />
        {android ? <Botao rotulo="Abrir no Chrome" tipo="secundario" Icone={ExternalLink} aoTocar={abrirNoChrome} /> : null}
        <Botao rotulo="Tentar de novo" tipo="fantasma" aoTocar={tentarDeNovo} />
      </LinhaDeAcoes>
      {aMao ? <Texto variante="suave" selectable>{aMao}</Texto> : null}
    </Alerta>
  );
}
