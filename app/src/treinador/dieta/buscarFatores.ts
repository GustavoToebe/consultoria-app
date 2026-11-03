import { fatoresDosAlimentos } from '../../api/rotas';
import type { FatoresDoAlimento } from '../../api/tipos';

/** Mesmo teto da rota `GET /alimentos/fatores`. */
const IDS_POR_PEDIDO = 200;

/** Fatores atuais dos alimentos, em pedidos de até 200 ids (uma dieta de verdade cabe em um). Só GET. */
export async function buscarFatores(ids: string[]): Promise<FatoresDoAlimento[]> {
  const partes: string[][] = [];
  for (let i = 0; i < ids.length; i += IDS_POR_PEDIDO) partes.push(ids.slice(i, i + IDS_POR_PEDIDO));
  return (await Promise.all(partes.map(fatoresDosAlimentos))).flat();
}
