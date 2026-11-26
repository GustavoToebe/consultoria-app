import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { LIMITES_DO_CONTRATO, type PdfEscolhido } from '../api/contratos';
import { erroDoPdfEscolhido } from '../dominio/contratos';

/**
 * Abre o seletor do sistema (só PDF) e confere o arquivo pela regra de `dominio/contratos` (tipo, tamanho e os primeiros
 * bytes `%PDF-`). Nulo = a pessoa cancelou. Nada é guardado: o arquivo fica só na memória da folha.
 */
/**
 * Celular: o seletor copia o PDF para o cache do app, e o contrato leva CPF e endereço. Apaga a cópia ao trocar o arquivo e
 * ao fechar a folha. Na web o arquivo é só um `File` na memória: nada a apagar.
 */
export function descartarPdf(arquivo: PdfEscolhido | null): void {
  if (!arquivo || Platform.OS === 'web' || !('uri' in arquivo.parte)) return;
  try {
    const copia = new File(arquivo.parte.uri);
    if (copia.exists) copia.delete();
  } catch {
    // Já apagado ou fora do alcance do app: nada a fazer.
  }
}

export async function escolherPdf(): Promise<{ arquivo: PdfEscolhido; erro: string | null } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  const a = r.canceled ? undefined : r.assets[0];
  if (!a) return null;
  const web = Platform.OS === 'web' && a.file;
  const tamanho = web ? a.file!.size : a.size ?? null;
  // No celular só dá para ler o arquivo inteiro: não lê o que já passou do teto.
  const grande = tamanho != null && tamanho > LIMITES_DO_CONTRATO.arquivoPdf;
  const inicio = web ? new Uint8Array(await a.file!.slice(0, 5).arrayBuffer()) : grande ? null : (await new File(a.uri).bytes()).subarray(0, 5);
  const arquivo: PdfEscolhido = { nome: a.name, tamanho, parte: web ? a.file! : { uri: a.uri } };
  return { arquivo, erro: erroDoPdfEscolhido({ nome: a.name, tipo: web ? a.file!.type : a.mimeType, tamanho, inicio }) };
}
