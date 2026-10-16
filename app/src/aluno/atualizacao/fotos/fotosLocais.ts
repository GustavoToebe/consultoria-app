import { Directory, File, Paths } from 'expo-file-system';

import { novoUid } from '../../../dominio/uid';

/**
 * Celular: a foto tirada sem internet fica na pasta privada do app (nunca na galeria) até a atualização ser enviada. Uma
 * pasta por usuário; sair da conta apaga tudo. O nome do arquivo é só um identificador sorteado.
 */
export const fotosLocaisDisponiveis = true;

const pasta = (usuarioId: string) => new Directory(Paths.document, 'fotos', usuarioId);

/** Move a foto já reduzida (sem EXIF) para a pasta privada do usuário e devolve o nome guardado. */
export async function guardarFotoLocal(usuarioId: string, origemUri: string): Promise<string> {
  const destino = pasta(usuarioId);
  destino.create({ intermediates: true, idempotent: true });
  const nome = `${novoUid()}.jpg`;
  new File(origemUri).move(new File(destino, nome));
  return nome;
}

export const uriDaFotoLocal = (usuarioId: string, nome: string) => new File(pasta(usuarioId), nome).uri;

export const fotoLocalExiste = (usuarioId: string, nome: string) => new File(pasta(usuarioId), nome).exists;

export async function apagarFotoLocal(usuarioId: string, nome: string): Promise<void> {
  const arquivo = new File(pasta(usuarioId), nome);
  if (arquivo.exists) arquivo.delete();
}

/** Apaga o arquivo de uma origem temporária (cache do seletor ou da câmera). Falha não importa. */
export async function apagarTemporaria(uri: string): Promise<void> {
  try {
    const arquivo = new File(uri);
    if (arquivo.exists) arquivo.delete();
  } catch {
    // Arquivo que já saiu do cache.
  }
}

export async function apagarTodasAsFotosLocais(usuarioId: string): Promise<void> {
  const destino = pasta(usuarioId);
  if (destino.exists) destino.delete();
}
