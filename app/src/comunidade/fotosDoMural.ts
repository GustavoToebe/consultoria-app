import { Platform } from 'react-native';

import { enviarFotoDoMural } from '../api/comunidade';
import { anexarFoto } from '../aluno/atualizacao/fotos/enviarFotoDoAparelho';
import { apagarTemporaria } from '../aluno/atualizacao/fotos/fotosLocais';
import { escolherFoto, type OrigemDaFoto } from '../aluno/atualizacao/fotos/prepararFoto';
import { LIMITES_FOTO_DO_MURAL } from '../dominio/comunidade';

/**
 * Escolhe uma foto (galeria ou câmera), reduz (JPEG, sem EXIF), envia como pendente e devolve o id; `null` se a pessoa
 * desistiu. `FotoRecusada` e os 422 da API sobem para a tela mostrar junto das fotos. Nada fica no aparelho.
 */
export async function escolherEEnviarFotoDoMural(origem: OrigemDaFoto): Promise<string | null> {
  const pronta = await escolherFoto(origem, LIMITES_FOTO_DO_MURAL);
  if (!pronta) return null;
  try {
    const dados = new FormData();
    // Sem fetch da blob: na web (a CSP recusa): o JPEG já vem em memória.
    await anexarFoto(dados, pronta);
    return (await enviarFotoDoMural(dados)).id;
  } finally {
    if (Platform.OS !== 'web') await apagarTemporaria(pronta.uri);
  }
}
