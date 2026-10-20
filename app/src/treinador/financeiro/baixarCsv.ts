import * as Sharing from 'expo-sharing';

import { novoArquivoTemporario } from '../../offline/arquivosTemporarios';

/** Celular: grava na pasta dos temporários (apagada no próximo arquivo e no "Sair") e abre o compartilhar do sistema. */
export async function baixarCsv(nome: string, texto: string): Promise<void> {
  const arquivo = novoArquivoTemporario(nome);
  arquivo.write(`\uFEFF${texto}`); // o BOM que a leitura da resposta descarta; o Excel precisa dele para os acentos
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não consegue compartilhar arquivos.');
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: nome });
}
