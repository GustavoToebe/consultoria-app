import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { anexarArquivoDoAparelho } from '../../api/anexarArquivoDoAparelho';
import { apagarTemporaria } from '../../aluno/atualizacao/fotos/fotosLocais';
import { FotoRecusada, prepararFoto } from '../../aluno/atualizacao/fotos/prepararFoto';
import {
  LIMITES_IMAGEM_EXERCICIO,
  problemaDoGif,
  tipoDaImagemEscolhida,
  type TipoDeImagemDoExercicio,
} from '../../dominio/demonstracaoExercicio';

export interface ImagemDoExercicioEscolhida {
  uri: string;
  /** Só na web: o conteúdo já em memória, para enviar sem `fetch` (a CSP recusa `blob:`/`data:`). */
  arquivo: Blob | null;
  tipo: TipoDeImagemDoExercicio;
  /** Cópia temporária no celular que deve ser apagada depois do envio. */
  temporaria: boolean;
}

const NOME_DO_ARQUIVO: Record<TipoDeImagemDoExercicio, string> = {
  'image/jpeg': 'imagem.jpg',
  'image/png': 'imagem.png',
  'image/gif': 'imagem.gif',
};

/**
 * Abre a galeria e devolve a imagem pronta para enviar. JPEG e PNG são reduzidos a 800 px e regravados em JPEG
 * (sem EXIF) no aparelho. GIF vai como está, porque reencodar mataria a animação: o servidor confere pelos bytes,
 * tira os metadados e recusa acima de 1 MB e 800 px. `null` se a pessoa desistiu.
 */
export async function escolherImagemDoExercicio(): Promise<ImagemDoExercicioEscolhida | null> {
  // `quality: 1` e sem edição: no Android é o que mantém o GIF animado.
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false, allowsEditing: false, exif: false });
  const asset = r.canceled ? undefined : r.assets[0];
  if (!asset) return null;
  const tipo = tipoDaImagemEscolhida(asset.mimeType, asset.fileName);
  const nativo = Platform.OS !== 'web';
  try {
    if (!tipo) throw new FotoRecusada('Escolha uma imagem JPEG, PNG ou GIF.');
    if (tipo === 'image/gif') {
      const arquivo = nativo ? null : (asset.file ?? null);
      if (!nativo && !arquivo) throw new FotoRecusada('Não foi possível ler o GIF.');
      const bytes = arquivo?.size ?? asset.fileSize ?? (await tamanhoDe(asset.uri));
      const problema = problemaDoGif(bytes);
      if (problema) throw new FotoRecusada(problema);
      return { uri: asset.uri, arquivo, tipo, temporaria: nativo };
    }
    const pronta = await prepararFoto(asset.uri, asset.width, asset.height, {
      lados: LIMITES_IMAGEM_EXERCICIO.lados,
      bytesMaximo: LIMITES_IMAGEM_EXERCICIO.bytesMaximo,
    });
    // A cópia do seletor tem os metadados originais: não fica no cache.
    if (nativo) await apagarTemporaria(asset.uri);
    return { uri: pronta.uri, arquivo: pronta.arquivo, tipo: 'image/jpeg', temporaria: nativo };
  } catch (erro) {
    if (nativo) await apagarTemporaria(asset.uri);
    if (erro instanceof FotoRecusada) throw erro;
    throw new FotoRecusada('Não foi possível ler esta imagem. Tente outra.');
  }
}

async function tamanhoDe(uri: string): Promise<number> {
  return (await (await fetch(uri)).blob()).size;
}

/** Põe a imagem no campo `arquivo`, com nome fixo (o nome original não sai do aparelho). */
export async function anexarImagemDoExercicio(dados: FormData, imagem: ImagemDoExercicioEscolhida): Promise<void> {
  const nome = NOME_DO_ARQUIVO[imagem.tipo];
  if (Platform.OS === 'web') {
    if (!imagem.arquivo) throw new Error('Imagem sem conteúdo para enviar.');
    dados.append('arquivo', imagem.arquivo, nome);
  } else {
    await anexarArquivoDoAparelho(dados, 'arquivo', { nome, tipo: imagem.tipo, uri: imagem.uri });
  }
}

export async function descartarImagemEscolhida(imagem: ImagemDoExercicioEscolhida | null): Promise<void> {
  if (imagem?.temporaria) await apagarTemporaria(imagem.uri);
}
