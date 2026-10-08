import { urlDaApi } from '../api/cliente';
import type { Marca } from '../api/tipos';

/**
 * Logo da marca como data URI, para ir dentro do PDF (o arquivo do celular não busca imagem na rede). A rota da logo
 * é pública e sem credencial. Falhou (sem internet) → `null` e o PDF usa o nome da consultoria.
 */
export async function logoComoDataUri(marca: Marca | null): Promise<string | null> {
  if (!marca?.logoUrl) return null;
  try {
    const resposta = await fetch(urlDaApi(marca.logoUrl), { credentials: 'omit' });
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    return await new Promise<string | null>((resolver) => {
      const leitor = new FileReader();
      leitor.onload = () => resolver(typeof leitor.result === 'string' ? leitor.result : null);
      leitor.onerror = () => resolver(null);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
