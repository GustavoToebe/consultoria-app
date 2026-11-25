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

/** O que o seletor (ou o arquivo solto na web) entrega: o mesmo formato do `asset` do `expo-image-picker`. */
export interface ArquivoDeImagem {
  uri: string;
  width: number;
  height: number;
  mimeType?: string | null;
  fileName?: string | null;
  /** Só na web: o conteúdo do arquivo. */
  file?: Blob | null;
  fileSize?: number | null;
}

/** Abre a galeria e devolve a imagem pronta para enviar (`prepararImagemDoExercicio`). `null` se a pessoa desistiu. */
export async function escolherImagemDoExercicio(): Promise<ImagemDoExercicioEscolhida | null> {
  // `quality: 1` e sem edição: no Android é o que mantém o GIF animado.
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false, allowsEditing: false, exif: false });
  const asset = r.canceled ? undefined : r.assets[0];
  return asset ? prepararImagemDoExercicio(asset) : null;
}

/**
 * Prepara a imagem escolhida para enviar. JPEG e PNG são reduzidos a 800 px e regravados em JPEG (sem EXIF) no aparelho.
 * GIF vai como está, porque reencodar mataria a animação: o servidor confere pelos bytes, tira os metadados e recusa acima
 * de 1 MB e 800 px.
 */
export async function prepararImagemDoExercicio(asset: ArquivoDeImagem): Promise<ImagemDoExercicioEscolhida> {
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

/**
 * Web: o arquivo solto na área da imagem (arrastar e soltar) passa pelas mesmas regras do seletor. As medidas vêm de um
 * `<img>` com o endereço `blob:` (a CSP aceita `blob:` em `img-src`; o conteúdo vai pelo próprio `File`, sem `fetch`).
 */
export async function imagemDoArquivoSolto(arquivo: File): Promise<ImagemDoExercicioEscolhida> {
  const uri = URL.createObjectURL(arquivo);
  try {
    const medidas = tipoDaImagemEscolhida(arquivo.type, arquivo.name) === 'image/gif' ? { width: 0, height: 0 } : await medidasDaImagem(uri);
    return await prepararImagemDoExercicio({ uri, ...medidas, mimeType: arquivo.type, fileName: arquivo.name, file: arquivo, fileSize: arquivo.size });
  } finally {
    URL.revokeObjectURL(uri);
  }
}

async function medidasDaImagem(uri: string): Promise<{ width: number; height: number }> {
  const img = new window.Image();
  img.src = uri;
  try {
    await img.decode();
  } catch {
    throw new FotoRecusada('Não foi possível ler esta imagem. Tente outra.');
  }
  return { width: img.naturalWidth, height: img.naturalHeight };
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
