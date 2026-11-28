import { erroDoTelefone, mascaraTelefone } from './cadastroDoAluno';

/** Erro do campo quando chega texto que não é telefone (o preenchimento automático pondo o e-mail no lugar, 28/11). */
export const NAO_E_TELEFONE = 'Isto não é um telefone. Digite só o DDD e o número, como (45) 99999-9999.';

/**
 * Entrada do campo Telefone: com letra ou "@" (um e-mail colado ou preenchido pelo navegador) a digitação é recusada, o
 * valor anterior fica e o campo mostra o erro; senão vale a máscara de sempre (`mascaraTelefone`, a do `@plataforma/web`).
 * A conferência é no texto cru, antes da máscara: a máscara tira tudo que não é dígito e transformaria o e-mail em vazio,
 * e salvar depois apagaria o telefone.
 */
export function entradaDoTelefone(digitado: string, anterior: string): { valor: string; erro: string | null } {
  if (/[@\p{L}]/u.test(digitado)) return { valor: anterior, erro: NAO_E_TELEFONE };
  return { valor: mascaraTelefone(digitado), erro: null };
}

/** O erro que o campo mostra: a recusa da digitação vale mais; depois, o telefone incompleto ou inválido (vazio é válido). */
export const erroDoCampoTelefone = (recusa: string | null, valor: string, conferir: boolean): string | null =>
  recusa ?? (conferir ? erroDoTelefone(valor) ?? null : null);
