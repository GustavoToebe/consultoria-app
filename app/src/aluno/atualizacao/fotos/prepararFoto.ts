import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import {
  LIMITES_FOTO, MENSAGEM_FOTO_GRANDE, MENSAGEM_FOTO_NAO_LIDA, redimensionamento, reducoesDeFoto,
} from '../../../dominio/fotosAtualizacao';
import { apagarTemporaria } from './fotosLocais';

export type OrigemDaFoto = 'galeria' | 'camera';

export interface FotoPronta {
  /** JPEG novo, sem EXIF (reencodado), com no máximo `LIMITES_FOTO.bytesMaximo` bytes. */
  uri: string;
  bytes: number;
}

/** Falha que a pessoa pode entender e resolver (foto ilegível, grande demais, câmera sem permissão). */
export class FotoRecusada extends Error {}

async function tamanhoDe(uri: string): Promise<number> {
  const resposta = await fetch(uri);
  return (await resposta.blob()).size;
}

/**
 * Reencoda em JPEG com o maior lado em 1600 px (descendo a qualidade e o lado até caber no limite do servidor). O
 * reencode joga fora o EXIF (local, data, aparelho); o servidor ainda confere e limpa de novo.
 */
export async function prepararFoto(uri: string, largura: number, altura: number): Promise<FotoPronta> {
  let tentativas = reducoesDeFoto(largura, altura);
  if (!tentativas.length) {
    // O seletor não informou o tamanho: tenta os lados padrão a partir do máximo.
    tentativas = reducoesDeFoto(LIMITES_FOTO.ladoMaximo, LIMITES_FOTO.ladoMaximo);
  }
  for (const { lado, qualidade } of tentativas) {
    const contexto = ImageManipulator.manipulate(uri);
    const acao = redimensionamento(largura, altura, lado);
    const redimensionado = acao ? contexto.resize(acao) : contexto;
    const imagem = await redimensionado.renderAsync();
    const salvo = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: qualidade });
    const bytes = await tamanhoDe(salvo.uri);
    if (bytes > 0 && bytes <= LIMITES_FOTO.bytesMaximo) return { uri: salvo.uri, bytes };
    await apagarTemporaria(salvo.uri);
  }
  throw new FotoRecusada(MENSAGEM_FOTO_GRANDE);
}

/** Abre a galeria (ou a câmera, no celular) e devolve a foto já reduzida; `null` se a pessoa desistiu. */
export async function escolherFoto(origem: OrigemDaFoto): Promise<FotoPronta | null> {
  if (origem === 'camera') {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) throw new FotoRecusada('Sem permissão para usar a câmera. Libere nos ajustes do aparelho.');
  }
  const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false, exif: false };
  const r = origem === 'camera' ? await ImagePicker.launchCameraAsync(opcoes) : await ImagePicker.launchImageLibraryAsync(opcoes);
  const asset = r.canceled ? undefined : r.assets[0];
  if (!asset) return null;
  try {
    return await prepararFoto(asset.uri, asset.width, asset.height);
  } catch (erro) {
    if (erro instanceof FotoRecusada) throw erro;
    throw new FotoRecusada(MENSAGEM_FOTO_NAO_LIDA);
  } finally {
    // A cópia do seletor tem o EXIF original: não fica no cache.
    if (Platform.OS !== 'web') await apagarTemporaria(asset.uri);
  }
}
