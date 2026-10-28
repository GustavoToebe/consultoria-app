import * as Sharing from 'expo-sharing';
import type Svg from 'react-native-svg';

import { ErroDoCartao } from './erroDoCartao';
import { ALTURA_DO_CARTAO, LARGURA_DO_CARTAO } from '../../dominio/cartaoDoTreino';
import { novoArquivoTemporario } from '../../offline/arquivosTemporarios';

export type ModoDeSaida = 'compartilhar' | 'baixar';

/** Celular: só "Compartilhar" (o próprio menu do sistema tem "Salvar imagem"). */
export function modosDeSaida(): ModoDeSaida[] {
  return ['compartilhar'];
}

function pngEmBase64(svg: Svg): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    try {
      svg.toDataURL((base64) => (base64 ? resolver(base64) : rejeitar(new Error('vazio'))), { width: LARGURA_DO_CARTAO, height: ALTURA_DO_CARTAO });
    } catch (erro) {
      rejeitar(erro);
    }
  });
}

/**
 * Celular: o `Svg` da prévia vira PNG 1080 × 1920 (`toDataURL`), gravado na pasta dos temporários (apagada no próximo
 * arquivo e no "Sair") e aberto no compartilhar do sistema. Nada vai ao servidor.
 */
export async function exportarCartao(svg: Svg | null, nome: string, _modo: ModoDeSaida): Promise<void> {
  if (!svg) throw new ErroDoCartao('O cartão ainda não está pronto.');
  if (!(await Sharing.isAvailableAsync())) throw new ErroDoCartao('Este aparelho não consegue compartilhar arquivos.');
  const base64 = await pngEmBase64(svg);
  const arquivo = novoArquivoTemporario(nome);
  arquivo.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(arquivo.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Compartilhar treino' });
}
