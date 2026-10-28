import { ErroApi } from '@plataforma/web';

/** Código que a API devolve (503) nas rotas de conclusão do treino quando "Concluir treino" está desligado na plataforma. */
export const CODIGO_RETORNO_DESLIGADO = 'RETORNO_INDISPONIVEL';

/**
 * O erro é o "Concluir treino desligado na plataforma" (503 `RETORNO_INDISPONIVEL`)? Nunca aparece como erro: o cliente
 * avisa a sessão, que põe `retornoHabilitado` falso, o botão some e as conclusões que estão na fila ficam como estão
 * (LOCAL, sem envio) até a chave voltar.
 */
export function ehRetornoDesligado(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.status === 503 && erro.codigo === CODIGO_RETORNO_DESLIGADO;
}
