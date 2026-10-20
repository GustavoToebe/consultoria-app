import { Linking } from 'react-native';

import { linkParaAbrir } from '../dominio/links';
import type { BuscarLinkDePagamento, ResultadoDoPagamento } from './abrirPagamentoTipos';

/**
 * Celular (Android e iOS): só é chamada quando a chave da plataforma está ligada (`pagarPermitidoNaPlataforma`); sem ela
 * a tela nem mostra o botão. Pede o link à API, confere que é `https` seguro (`linkParaAbrir`, a mesma regra da web) e o
 * abre no navegador do aparelho, fora do app e sem token. A baixa vem do servidor; a lista recarrega quando o app volta
 * ao primeiro plano. A web tem o `abrirPagamento.web.ts`.
 */
export async function abrirPagamento(buscar: BuscarLinkDePagamento): Promise<ResultadoDoPagamento> {
  const { url } = await buscar();
  const seguro = linkParaAbrir(url);
  if (!seguro) return 'link-invalido';
  try {
    await Linking.openURL(seguro);
    return 'aberta';
  } catch {
    return 'indisponivel';
  }
}
