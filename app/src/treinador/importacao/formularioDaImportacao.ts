import { Platform } from 'react-native';

import { anexarArquivoDoAparelho } from '../../api/anexarArquivoDoAparelho';

/** Arquivo escolhido na tela. `tamanho` em bytes, quando o aparelho informa. */
export type ArquivoEscolhido = { nome: string; tamanho?: number; parte: Blob | { uri: string; name: string; type: string } };

/** FormData da importação: o arquivo no campo `arquivo` e, quando há, a configuração como JSON em `configuracao`. */
export async function formulario(arquivo: ArquivoEscolhido, configuracao?: unknown): Promise<FormData> {
  const dados = new FormData();
  if (Platform.OS === 'web') {
    dados.append('arquivo', arquivo.parte as Blob, arquivo.nome);
  } else {
    const { uri, name, type } = arquivo.parte as { uri: string; name: string; type: string };
    await anexarArquivoDoAparelho(dados, 'arquivo', { nome: name, tipo: type, uri });
  }
  if (configuracao !== undefined) {
    const json = JSON.stringify(configuracao);
    dados.append('configuracao', Platform.OS === 'web' ? new Blob([json], { type: 'application/json' }) : json);
  }
  return dados;
}

/**
 * Arquivo levado da entrada única (`/nova`) à planilha completa. Fica só na memória (nunca no aparelho, LGPD) e é lido uma
 * vez: a próxima tela o tira daqui ao montar.
 */
let emEspera: ArquivoEscolhido | null = null;
export function deixarArquivoEmEspera(arquivo: ArquivoEscolhido) {
  emEspera = arquivo;
}
export function pegarArquivoEmEspera(): ArquivoEscolhido | null {
  const arquivo = emEspera;
  emEspera = null;
  return arquivo;
}
