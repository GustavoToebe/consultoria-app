import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { apagarArquivo, novoArquivoTemporario } from '../offline/arquivosTemporarios';
import { documentoCompleto, type Documento } from './html';

/** Nome de arquivo seguro: sem acento, barra ou símbolo, que o sistema de arquivos ou o compartilhar poderiam recusar. */
function nomeDoArquivo(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'documento'}.pdf`;
}

/**
 * O arquivo que o `expo-print` gera nem sempre passa na checagem de leitura do compartilhar ("Not allowed to read file
 * under given URL", visto no Expo Go). Por isso o PDF é pedido em base64 e gravado no cache do próprio app, o que
 * também dá um nome legível; o arquivo do `expo-print` não é lido e sai na hora. A cópia fica na pasta dos temporários
 * (`offline/arquivosTemporarios`), que o próximo PDF e o "Sair" apagam.
 */
function gravarNoCache(base64: string, titulo: string): string {
  const arquivo = novoArquivoTemporario(nomeDoArquivo(titulo));
  arquivo.write(base64, { encoding: 'base64' });
  return arquivo.uri;
}

/** Celular: gera o arquivo PDF e abre o compartilhar do sistema (salvar, WhatsApp, e-mail). */
export async function imprimir(d: Documento): Promise<void> {
  let etapa = 'montar o HTML';
  try {
    const html = documentoCompleto(d);
    etapa = 'gerar o arquivo PDF';
    const { uri, base64 } = await Print.printToFileAsync({ html, width: 595, height: 842, base64: true });
    etapa = 'abrir o compartilhar';
    if (await Sharing.isAvailableAsync()) {
      const arquivo = base64 ? gravarNoCache(base64, d.titulo) : uri;
      if (base64) apagarArquivo(uri);
      await Sharing.shareAsync(arquivo, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: d.titulo,
      });
    } else {
      await Print.printAsync({ uri });
    }
  } catch (e) {
    // Aparece no terminal do Metro; o texto do erro (sem o conteúdo do documento) ajuda a achar a etapa que falhou.
    console.error(`PDF: falhou ao ${etapa}:`, e instanceof Error ? e.message : e);
    throw e;
  }
}
