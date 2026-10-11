import { Linking } from 'react-native';

import { linkParaAbrir } from '../dominio/links';

/**
 * Abre um link de produto fora do app (navegador), sem token nem cookie, como o vídeo. Só abre `https` que passa em
 * `linkExternoSeguro`; devolve `false` se não abriu (link ruim ou o sistema recusou), para a tela avisar.
 */
export async function abrirLinkExterno(url: string | null | undefined): Promise<boolean> {
  const seguro = linkParaAbrir(url);
  if (!seguro) return false;
  try {
    await Linking.openURL(seguro);
    return true;
  } catch {
    return false;
  }
}
