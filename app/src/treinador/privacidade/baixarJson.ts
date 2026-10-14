import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Celular: grava no cache do app e abre o compartilhar do sistema (salvar em Arquivos, e-mail). */
export async function baixarJson(nome: string, texto: string): Promise<void> {
  const arquivo = new File(Paths.cache, nome);
  if (arquivo.exists) arquivo.delete();
  arquivo.create();
  arquivo.write(texto);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não consegue compartilhar arquivos.');
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: nome });
}
