import * as Sharing from 'expo-sharing';

import { novoArquivoTemporario } from '../offline/arquivosTemporarios';

/** Celular: grava o arquivo na pasta dos temporários (apagada no próximo arquivo e no "Sair") e abre o compartilhar. */
export async function baixarComparacao(blob: Blob, nome: string): Promise<void> {
  const zip = nome.endsWith('.zip');
  const arquivo = novoArquivoTemporario(nome);
  arquivo.write(await blobEmBase64(blob), { encoding: 'base64' });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não consegue compartilhar arquivos.');
  await Sharing.shareAsync(arquivo.uri, {
    mimeType: zip ? 'application/zip' : 'image/jpeg',
    UTI: zip ? 'public.zip-archive' : 'public.jpeg',
    dialogTitle: nome,
  });
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
