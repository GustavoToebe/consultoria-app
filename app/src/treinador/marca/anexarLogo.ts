import { Platform } from 'react-native';

import { anexarArquivoDoAparelho } from '../../api/anexarArquivoDoAparelho';

/** Logo escolhida na galeria: no celular vale a `uri`; na web, o `file` já em memória. */
export interface LogoEscolhida {
  uri: string;
  fileName?: string | null;
  file?: Blob | null;
}

/** Põe a logo (PNG ou JPEG) no campo `arquivo` do formulário. */
export async function anexarLogo(dados: FormData, logo: LogoEscolhida, tipo: 'image/png' | 'image/jpeg'): Promise<void> {
  if (Platform.OS === 'web' && logo.file) {
    dados.append('arquivo', logo.file);
  } else {
    const nome = logo.fileName ?? (tipo === 'image/png' ? 'logo.png' : 'logo.jpg');
    await anexarArquivoDoAparelho(dados, 'arquivo', { nome, tipo, uri: logo.uri });
  }
}
