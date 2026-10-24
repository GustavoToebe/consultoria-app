import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import {
  LIMITES_FOTO, MENSAGEM_FOTO_GRANDE, MENSAGEM_FOTO_NAO_LIDA, redimensionamento, reducoesDeFoto, selecaoDeFotos,
} from '../../../dominio/fotosAtualizacao';
import { apagarTemporaria } from './fotosLocais';
import { blobDeBase64 } from './jpegDaWeb';

export type OrigemDaFoto = 'galeria' | 'camera';

export interface FotoPronta {
  /** JPEG novo, sem EXIF (reencodado), com no máximo `LIMITES_FOTO.bytesMaximo` bytes. */
  uri: string;
  bytes: number;
  /** Só na web: o JPEG já em memória, para enviar sem `fetch` (veja `jpegDaWeb`). No celular é nulo e vale a `uri`. */
  arquivo: Blob | null;
}

/** Falha que a pessoa pode entender e resolver (foto ilegível, grande demais, câmera sem permissão). */
export class FotoRecusada extends Error {}

/** Lados (do maior para o menor) e teto de bytes; o padrão é o da foto de atualização. */
export interface LimitesDaReducao { lados?: readonly number[]; bytesMaximo?: number }

/** Tamanho do arquivo no celular (`file://`, fora da CSP). Na web o tamanho vem do próprio `Blob`. */
async function tamanhoDe(uri: string): Promise<number> {
  const resposta = await fetch(uri);
  return (await resposta.blob()).size;
}

/**
 * Reencoda em JPEG com o maior lado em 1600 px (descendo a qualidade e o lado até caber no limite do servidor). O
 * reencode joga fora o EXIF (local, data, aparelho); o servidor ainda confere e limpa de novo.
 */
export async function prepararFoto(uri: string, largura: number, altura: number, limites: LimitesDaReducao = {}): Promise<FotoPronta> {
  const bytesMaximo = limites.bytesMaximo ?? LIMITES_FOTO.bytesMaximo;
  let tentativas = reducoesDeFoto(largura, altura, limites.lados);
  if (!tentativas.length) {
    // O seletor não informou o tamanho: tenta os lados padrão a partir do máximo.
    const maior = limites.lados?.[0] ?? LIMITES_FOTO.ladoMaximo;
    tentativas = reducoesDeFoto(maior, maior, limites.lados);
  }
  for (const { lado, qualidade } of tentativas) {
    const contexto = ImageManipulator.manipulate(uri);
    const acao = redimensionamento(largura, altura, lado);
    const redimensionado = acao ? contexto.resize(acao) : contexto;
    const imagem = await redimensionado.renderAsync();
    const web = Platform.OS === 'web';
    const salvo = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: qualidade, base64: web });
    const arquivo = web && salvo.base64 ? blobDeBase64(salvo.base64) : null;
    if (web && !arquivo) throw new FotoRecusada(MENSAGEM_FOTO_NAO_LIDA);
    const bytes = arquivo ? arquivo.size : await tamanhoDe(salvo.uri);
    if (bytes > 0 && bytes <= bytesMaximo) return { uri: salvo.uri, bytes, arquivo };
    await apagarTemporaria(salvo.uri);
  }
  throw new FotoRecusada(MENSAGEM_FOTO_GRANDE);
}

export interface FotosEscolhidas {
  fotos: FotoPronta[];
  /** Fotos que não couberam ou não foram lidas. As que deram certo continuam em `fotos`. */
  recusa: string | null;
}

/** Abre a galeria (ou a câmera, no celular) e devolve a foto já reduzida; `null` se a pessoa desistiu. */
export async function escolherFoto(origem: OrigemDaFoto, limites: LimitesDaReducao = {}): Promise<FotoPronta | null> {
  const { fotos, recusa } = await escolherFotos(origem, 1, limites);
  if (recusa) throw new FotoRecusada(recusa);
  return fotos[0] ?? null;
}

/**
 * Abre a galeria para marcar até `quantidade` fotos de uma vez (a câmera continua uma). Devolve as que couberam;
 * `recusa` explica as que ficaram de fora. Lista vazia e sem recusa = a pessoa desistiu.
 */
export async function escolherFotos(origem: OrigemDaFoto, quantidade: number, limites: LimitesDaReducao = {}): Promise<FotosEscolhidas> {
  if (origem === 'camera') {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) throw new FotoRecusada('Sem permissão para usar a câmera. Libere nos ajustes do aparelho.');
  }
  const { varias, limite } = selecaoDeFotos(origem, quantidade);
  const opcoes: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'], quality: 1, allowsMultipleSelection: varias, selectionLimit: limite, exif: false,
  };
  const r = origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
  const assets = r.canceled ? [] : r.assets.slice(0, limite);
  const fotos: FotoPronta[] = [];
  const recusas: string[] = [];
  for (const asset of assets) {
    try {
      fotos.push(await prepararFoto(asset.uri, asset.width, asset.height, limites));
    } catch (erro) {
      recusas.push(erro instanceof FotoRecusada ? erro.message : MENSAGEM_FOTO_NAO_LIDA);
    } finally {
      // A cópia do seletor tem o EXIF original: não fica no cache.
      if (Platform.OS !== 'web') await apagarTemporaria(asset.uri);
    }
  }
  const recusa = recusas.length === 0 ? null : recusas.length === 1 ? recusas[0] : `${recusas.length} fotos não entraram. ${recusas[0]}`;
  return { fotos, recusa };
}
