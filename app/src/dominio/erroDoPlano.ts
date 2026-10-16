import { MOTIVO_FORA_DO_PLANO } from './funcionalidadesDoPlano';

export const CODIGO_LIMITE_DO_PLANO = 'LIMITE_DO_PLANO';
export const CODIGO_FORA_DO_PLANO = 'FUNCIONALIDADE_FORA_DO_PLANO';

/** Parte do `ErroApi` que importa aqui (estrutural, para a regra não depender do pacote). */
interface ErroComCodigo {
  codigo?: string | null;
  message?: string;
}

/** O erro é de limite ou de funcionalidade fora do plano da consultoria? */
export function erroDoPlano(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  const codigo = (erro as ErroComCodigo).codigo;
  return codigo === CODIGO_LIMITE_DO_PLANO || codigo === CODIGO_FORA_DO_PLANO;
}

/**
 * Mensagem de um erro do plano; `null` quando o erro é de outro tipo. Limite usa a mensagem pronta da API
 * ("Seu plano permite até N alunos ativos."); funcionalidade fora do plano diz sempre o mesmo texto curto.
 */
export function mensagemDoErroDoPlano(erro: unknown): string | null {
  if (!erroDoPlano(erro)) return null;
  const { codigo, message } = erro as ErroComCodigo;
  if (codigo === CODIGO_FORA_DO_PLANO) return `${MOTIVO_FORA_DO_PLANO}.`;
  const texto = message?.trim();
  return texto ? texto : 'Seu plano atingiu o limite.';
}
