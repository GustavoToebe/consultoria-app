import * as Sharing from 'expo-sharing';

import { novoArquivoTemporario } from '../../offline/arquivosTemporarios';

/** Celular: grava na pasta dos temporários (apagada no próximo arquivo e no "Sair") e abre o compartilhar do sistema. */
export async function baixarJson(nome: string, texto: string): Promise<void> {
  const arquivo = novoArquivoTemporario(nome);
  arquivo.write(texto);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não consegue compartilhar arquivos.');
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: nome });
}
