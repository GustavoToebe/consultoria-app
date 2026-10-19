import { Platform } from 'react-native';

import { enviarImagemDeQuestionario } from '../../api/rotas';
import { LIMITES_QUESTIONARIO } from '../../dominio/questionario';
import { escolherFoto } from '../../aluno/atualizacao/fotos/prepararFoto';
import { apagarTemporaria } from '../../aluno/atualizacao/fotos/fotosLocais';

/** Lados tentados (do maior ao menor) até caber no limite do servidor; o reencode tira EXIF. */
export const LIMITES_IMAGEM_DA_PERGUNTA = {
  lados: [LIMITES_QUESTIONARIO.imagemLado, 1200, 900, 640],
  bytesMaximo: LIMITES_QUESTIONARIO.imagemBytes,
} as const;

/**
 * Escolhe uma imagem na galeria, reduz (JPEG, sem EXIF), envia à API e devolve o id; `null` se a pessoa desistiu.
 * O servidor confere de novo e regrava sem metadados. O treinador responde pela licença da imagem.
 */
export async function escolherEEnviarImagem(): Promise<string | null> {
  const pronta = await escolherFoto('galeria', LIMITES_IMAGEM_DA_PERGUNTA);
  if (!pronta) return null;
  try {
    const dados = new FormData();
    if (Platform.OS === 'web') {
      dados.append('arquivo', await (await fetch(pronta.uri)).blob(), 'imagem.jpg');
    } else {
      dados.append('arquivo', { uri: pronta.uri, name: 'imagem.jpg', type: 'image/jpeg' } as unknown as Blob);
    }
    return (await enviarImagemDeQuestionario(dados)).id;
  } finally {
    if (Platform.OS !== 'web') await apagarTemporaria(pronta.uri);
  }
}
