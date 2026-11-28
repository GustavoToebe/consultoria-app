import { Linking, Platform } from 'react-native';

import { mailtoDoSuporte } from '../dominio/emailDeEntrada';
import { CONTATO_DO_SUPORTE } from '../dominio/produto';

/**
 * Abre o e-mail para o suporte do produto: só o endereço fixo de `CONTATO_DO_SUPORTE` e o assunto fixo, nunca texto
 * digitado (o `abrirLinkExterno` só abre https). Web: um link `mailto:` clicado (o `window.open` do `Linking` abria aba
 * vazia); nativo: `Linking.openURL`. `false` sem contato ou quando o aparelho recusa (sem app de e-mail no celular). Na web
 * o navegador não diz se havia programa de e-mail: `true` depois de entregar o link.
 */
export async function abrirEmailDoSuporte(): Promise<boolean> {
  const link = mailtoDoSuporte(CONTATO_DO_SUPORTE);
  if (!link) return false;
  try {
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = link;
      a.rel = 'noopener';
      a.click();
      return true;
    }
    await Linking.openURL(link);
    return true;
  } catch {
    return false;
  }
}
