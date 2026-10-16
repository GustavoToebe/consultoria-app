/** Funcionalidades que o plano da consultoria pode ligar ou desligar (códigos da API em `/eu`). */
export const FUNCIONALIDADES = ['MOBILIDADE', 'PDF', 'EQUIPE'] as const;
export type Funcionalidade = (typeof FUNCIONALIDADES)[number];

/** Texto curto para o botão desabilitado e para o aviso de recurso fora do plano. */
export const MOTIVO_FORA_DO_PLANO = 'Disponível em outro plano';

/**
 * Liberada quando a lista não veio (pacote antigo, offline ou API sem o campo) ou quando o código está nela.
 * É só apresentação: a API continua barrando.
 */
export function temFuncionalidade(liberadas: readonly string[] | undefined, codigo: string): boolean {
  return liberadas === undefined || liberadas.includes(codigo);
}
