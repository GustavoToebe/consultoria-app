import { ErroApi } from '@plataforma/web';

/** Código que a API devolve (503) nas rotas da página pública da loja (configuração, `GET /publico/loja/...` e a foto) quando a chave da loja está desligada (`TREINOS_LOJA_HABILITADA`). */
export const CODIGO_LOJA_DESLIGADA = 'LOJA_INDISPONIVEL';

/**
 * O erro é "loja desligada na plataforma" (503 `LOJA_INDISPONIVEL`)? Nunca aparece como erro para o treinador: o cliente
 * avisa a sessão, que põe `lojaHabilitada` falso, e a configuração da página e o interruptor do item somem (molde de
 * `ehVitrineDesligada`). Para o visitante da página pública vira "Página não encontrada." (`estadoDaLoja`).
 */
export function ehLojaDesligada(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.status === 503 && erro.codigo === CODIGO_LOJA_DESLIGADA;
}
