import { ErroApi } from '@plataforma/web';

/** Código que a API devolve (503) em toda rota do ciclo quando o módulo está desligado na plataforma. */
export const CODIGO_CICLO_DESLIGADO = 'CICLO_INDISPONIVEL_NO_APP';

/**
 * O erro é o "módulo do ciclo desligado na plataforma" (503 `CICLO_INDISPONIVEL_NO_APP`)? Não confundir com o 409
 * `CICLO_INDISPONIVEL`, que é o sexo diferente de Feminino ao gravar: esse continua sendo erro de tela. O desligado nunca
 * aparece como erro: o cliente avisa a sessão, que põe `cicloHabilitado` falso, e os cartões somem.
 */
export function ehCicloDesligado(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.status === 503 && erro.codigo === CODIGO_CICLO_DESLIGADO;
}
