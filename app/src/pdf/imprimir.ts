import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { documentoCompleto, type Documento } from './html';

/** Celular: gera o arquivo PDF e abre o compartilhar do sistema (salvar, WhatsApp, e-mail). */
export async function imprimir(d: Documento): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: documentoCompleto(d), width: 595, height: 842 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: d.titulo });
  } else {
    await Print.printAsync({ uri });
  }
}
