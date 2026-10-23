import * as Sharing from 'expo-sharing';

import { novoArquivoTemporario } from '../offline/arquivosTemporarios';

/** Celular: grava o JPEG na pasta dos temporários (apagada no próximo arquivo e no "Sair") e abre o compartilhar. */
export async function baixarComparacao(blob: Blob): Promise<void> {
  const arquivo = novoArquivoTemporario('comparacao.jpg');
  arquivo.write(await blobEmBase64(blob), { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não consegue compartilhar arquivos.');
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'comparacao.jpg' });
}

async function blobEmBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let texto = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    texto += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(texto);
}
