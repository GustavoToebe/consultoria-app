import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { enviarFoto, type DestinoDaFoto } from '../../../api/rotas';

/** Foto a enviar: no celular basta a `uri` (`file://`); na web vai o `arquivo` já em memória (`FotoPronta.arquivo`). */
export interface FotoParaEnviar {
  uri: string;
  arquivo?: Blob | null;
}

/**
 * Põe a foto no campo `arquivo` do formulário, sempre com o mesmo nome (o nome original não sai do aparelho). Na web
 * nunca faz `fetch` da `blob:`/`data:`: a CSP (`connect-src 'self'`) recusa. No celular os bytes vão no corpo: o
 * atalho `{ uri, name, type }` do FormData falha no Android com "sem conexão" e a foto nem sai do aparelho.
 */
export async function anexarFoto(dados: FormData, foto: FotoParaEnviar): Promise<void> {
  if (Platform.OS === 'web') {
    if (!foto.arquivo) throw new Error('Foto sem conteúdo para enviar.');
    dados.append('arquivo', foto.arquivo, 'foto.jpg');
    return;
  }
  const bytes = foto.arquivo ? await foto.arquivo.arrayBuffer() : await new File(foto.uri).arrayBuffer();
  dados.append('arquivo', new Blob([bytes], { type: 'image/jpeg' }), 'foto.jpg');
}

/** Sobe uma foto JPEG já reduzida (sem EXIF) para a atualização da pasta ou para a anamnese e devolve o id dela. */
export async function enviarFotoDoAparelho(destino: DestinoDaFoto, foto: FotoParaEnviar): Promise<string> {
  const dados = new FormData();
  await anexarFoto(dados, foto);
  return (await enviarFoto(destino, dados)).id;
}
