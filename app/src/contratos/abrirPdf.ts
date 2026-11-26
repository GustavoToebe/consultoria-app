import * as Sharing from 'expo-sharing';

import { novoArquivoTemporario } from '../offline/arquivosTemporarios';
import { ErroDoPdf } from './erroDoPdf';

/** No celular o PDF abre no visualizador do sistema. */
export const ROTULO_DO_PDF = 'Abrir o PDF';
export const VERBO_DO_PDF = 'Abra';

/**
 * Celular: grava o PDF do contrato na pasta dos temporários (apagada no próximo arquivo e no "Sair") e o abre pelo
 * compartilhar do sistema, que oferece o visualizador de PDF. Nada mais fica no aparelho.
 */
export async function abrirPdf(baixar: () => Promise<Blob>): Promise<void> {
  const blob = await baixar();
  const arquivo = novoArquivoTemporario('contrato.pdf');
  arquivo.write(new Uint8Array(await blob.arrayBuffer()));
  if (!(await Sharing.isAvailableAsync())) throw new ErroDoPdf('Este aparelho não consegue abrir o PDF.');
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Contrato' });
}
