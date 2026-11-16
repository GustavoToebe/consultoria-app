import { ErroApi } from '@plataforma/web';

/** Código que a API devolve (503) em `GET /publico/lojas` quando a lista de consultorias está desligada (chave `TREINOS_MARKETPLACE_HABILITADO`, ou loja/vitrine desligadas). */
export const CODIGO_MARKETPLACE_DESLIGADO = 'MARKETPLACE_INDISPONIVEL';

/**
 * O erro é "lista de consultorias desligada na plataforma" (503 `MARKETPLACE_INDISPONIVEL`)? Nunca aparece como erro para o
 * treinador: o cliente avisa a sessão, que põe `marketplaceHabilitado` falso, e o interruptor da consultoria e a escolha por
 * item somem (molde de `ehLojaDesligada`). Para o visitante da lista vira "Página não encontrada." (`estadoDaLista`).
 */
export function ehMarketplaceDesligado(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.status === 503 && erro.codigo === CODIGO_MARKETPLACE_DESLIGADO;
}
