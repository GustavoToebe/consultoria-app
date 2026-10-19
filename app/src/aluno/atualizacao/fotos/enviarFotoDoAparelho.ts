import { Platform } from 'react-native';

import { enviarFoto, type DestinoDaFoto } from '../../../api/rotas';

/**
 * Sobe uma foto JPEG já reduzida (sem EXIF) para a atualização da pasta ou para a anamnese e devolve o id dela. O nome do arquivo no envio é
 * sempre o mesmo: o nome original não sai do aparelho.
 */
export async function enviarFotoDoAparelho(destino: DestinoDaFoto, uri: string): Promise<string> {
  const dados = new FormData();
  if (Platform.OS === 'web') {
    dados.append('arquivo', await (await fetch(uri)).blob(), 'foto.jpg');
  } else {
    // React Native aceita {uri, name, type} no FormData.
    dados.append('arquivo', { uri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  return (await enviarFoto(destino, dados)).id;
}
