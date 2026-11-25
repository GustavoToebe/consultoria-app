import { FotoRecusada, prepararFoto, type FotoPronta } from '../../aluno/atualizacao/fotos/prepararFoto';
import { MENSAGEM_FOTO_NAO_LIDA } from '../../dominio/fotosAtualizacao';
import { LIMITES_FOTO_DA_VITRINE } from '../../dominio/vitrine';

/**
 * Só na web: a foto solta sobre a área, reduzida como a da galeria. As medidas vêm da própria imagem: sem elas o
 * `prepararFoto` não reduz o lado e uma foto grande nunca caberia nos 300 KB.
 */
export async function fotoDoArquivo(arquivo: File): Promise<FotoPronta> {
  if (!arquivo.type.startsWith('image/')) throw new FotoRecusada('Este arquivo não é uma foto. Escolha uma imagem.');
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = new Image();
    imagem.src = url;
    await imagem.decode();
    return await prepararFoto(url, imagem.naturalWidth, imagem.naturalHeight, LIMITES_FOTO_DA_VITRINE);
  } catch (e) {
    throw e instanceof FotoRecusada ? e : new FotoRecusada(MENSAGEM_FOTO_NAO_LIDA);
  } finally {
    URL.revokeObjectURL(url);
  }
}
