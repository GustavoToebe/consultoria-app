import { Platform } from 'react-native';

import { enviarFoto, type DestinoDaFoto } from '../../../api/rotas';

/** Foto a enviar: no celular basta a `uri` (`file://`); na web vai o `arquivo` já em memória (`FotoPronta.arquivo`). */
export interface FotoParaEnviar {
  uri: string;
  arquivo?: Blob | null;
}

/**
 * Põe a foto no campo `arquivo` do formulário, sempre com o mesmo nome (o nome original não sai do aparelho). Na web
 * nunca faz `fetch` da `blob:`/`data:`: a CSP (`connect-src 'self'`) recusa.
 */
export function anexarFoto(dados: FormData, foto: FotoParaEnviar): void {
  if (Platform.OS === 'web') {
    if (!foto.arquivo) throw new Error('Foto sem conteúdo para enviar.');
    dados.append('arquivo', foto.arquivo, 'foto.jpg');
  } else {
    // React Native aceita {uri, name, type} no FormData.
    dados.append('arquivo', { uri: foto.uri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
}

/** Sobe uma foto JPEG já reduzida (sem EXIF) para a atualização da pasta ou para a anamnese e devolve o id dela. */
export async function enviarFotoDoAparelho(destino: DestinoDaFoto, foto: FotoParaEnviar): Promise<string> {
  const dados = new FormData();
  anexarFoto(dados, foto);
  return (await enviarFoto(destino, dados)).id;
}
