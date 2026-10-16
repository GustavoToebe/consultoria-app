/**
 * Web: não guarda imagem no navegador (nem localStorage nem IndexedDB). A foto só é anexada com internet e sobe na hora;
 * o que o rascunho guarda são os ids.
 */
export const fotosLocaisDisponiveis = false;

const semArquivoLocal = () => new Error('A web não guarda fotos no aparelho.');

export async function guardarFotoLocal(_usuarioId: string, _origemUri: string): Promise<string> {
  throw semArquivoLocal();
}
export const uriDaFotoLocal = (_usuarioId: string, _nome: string): string => {
  throw semArquivoLocal();
};
export const fotoLocalExiste = (_usuarioId: string, _nome: string) => false;
export async function apagarFotoLocal(_usuarioId: string, _nome: string): Promise<void> {}
export async function apagarTemporaria(_uri: string): Promise<void> {}
export async function apagarTodasAsFotosLocais(_usuarioId: string): Promise<void> {}
