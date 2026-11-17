import { Platform } from 'react-native';

import {
  apagarFotoPendenteDaEquipe, apagarFotoPendenteDoMural, baixarFotoDoMuralDaEquipe, baixarFotoDoMuralDoAluno, enviarCapa,
  enviarFotoDoMural, enviarFotoDoMuralDaEquipe,
} from '../api/comunidade';
import { anexarFoto } from '../aluno/atualizacao/fotos/enviarFotoDoAparelho';
import { apagarTemporaria } from '../aluno/atualizacao/fotos/fotosLocais';
import { escolherFoto, type OrigemDaFoto } from '../aluno/atualizacao/fotos/prepararFoto';
import { LIMITES_FOTO_DO_MURAL, type PapelNoMural } from '../dominio/comunidade';

/**
 * Escolhe uma foto (galeria ou câmera), reduz (JPEG, sem EXIF), envia como pendente e devolve o id; `null` se a pessoa
 * desistiu. `FotoRecusada` e os 422 da API sobem para a tela mostrar junto das fotos. Nada fica no aparelho.
 */
async function escolherEEnviar(origem: OrigemDaFoto, enviar: (dados: FormData) => Promise<{ id: string }>): Promise<string | null> {
  const pronta = await escolherFoto(origem, LIMITES_FOTO_DO_MURAL);
  if (!pronta) return null;
  try {
    const dados = new FormData();
    // Sem fetch da blob: na web (a CSP recusa): o JPEG já vem em memória.
    await anexarFoto(dados, pronta);
    return (await enviar(dados)).id;
  } finally {
    if (Platform.OS !== 'web') await apagarTemporaria(pronta.uri);
  }
}

/** As rotas da foto pendente do mural por papel (C36): enviar, apagar e ver a miniatura. */
export const rotasDaFotoDoMural = {
  aluno: { enviar: enviarFotoDoMural, apagar: apagarFotoPendenteDoMural, baixar: baixarFotoDoMuralDoAluno },
  equipe: { enviar: enviarFotoDoMuralDaEquipe, apagar: apagarFotoPendenteDaEquipe, baixar: baixarFotoDoMuralDaEquipe },
} as const satisfies Record<PapelNoMural, unknown>;

export const escolherEEnviarFotoDoMural = (origem: OrigemDaFoto, papel: PapelNoMural) =>
  escolherEEnviar(origem, rotasDaFotoDoMural[papel].enviar);

/** A capa do vídeo (post ou aulão) segue as mesmas regras da foto do mural: JPEG, 1600 px, 300 KB. */
export const escolherEEnviarCapa = (origem: OrigemDaFoto) => escolherEEnviar(origem, enviarCapa);
