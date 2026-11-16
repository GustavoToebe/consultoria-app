import { ErroApi } from '@plataforma/web';

/** Código que a API devolve (503) em toda rota da vitrine quando a vitrine está desligada na plataforma (`TREINOS_VITRINE_HABILITADA`). */
export const CODIGO_VITRINE_DESLIGADA = 'VITRINE_INDISPONIVEL';

/**
 * O erro é "vitrine desligada na plataforma" (503 `VITRINE_INDISPONIVEL`)? Nunca aparece como erro: o cliente avisa a
 * sessão, que põe `vitrineHabilitada` falso, e o menu, o cartão do Início e a tela do aluno somem. (A loja e o
 * marketplace têm chaves e códigos próprios, `LOJA_INDISPONIVEL` e `MARKETPLACE_INDISPONIVEL`, nas fases seguintes.)
 */
export function ehVitrineDesligada(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.status === 503 && erro.codigo === CODIGO_VITRINE_DESLIGADA;
}
