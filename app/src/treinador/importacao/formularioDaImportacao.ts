import { Platform } from 'react-native';

import { anexarArquivoDoAparelho } from '../../api/anexarArquivoDoAparelho';

export type ArquivoEscolhido = { nome: string; parte: Blob | { uri: string; name: string; type: string } };

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
