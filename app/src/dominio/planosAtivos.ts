import type { TipoPlano } from '../api/tipos';

/**
 * "O que inclui" do plano comercial e "Planos ativos" do aluno (D13, `docs/planos/planos-ativos-do-aluno.md`). Só
 * informação: nada é bloqueado nem escondido. Sem o dado (nulo, ausente ou os dois desligados) nada é dito: a tela nunca
 * conclui "não contratou" por falta de dado. A mobilidade segue com o treino e não tem texto próprio (D6).
 */
export interface QueInclui {
  incluiTreino?: boolean | null;
  incluiDieta?: boolean | null;
}

/** Ajuda do grupo "O que inclui" no formulário do plano. */
export const AJUDA_DO_QUE_INCLUI = 'Marque o que este plano inclui. Pelo menos um.';
export const ERRO_DO_QUE_INCLUI = 'Marque pelo menos um: treino ou dieta.';

/** Texto neutro da lista de planos: "Treino e dieta", "Só treino" ou "Só dieta"; sem nenhum dos dois, nada. */
export function textoDoQueInclui(p: QueInclui | null | undefined): string | null {
  const treino = p?.incluiTreino === true;
  const dieta = p?.incluiDieta === true;
  if (treino && dieta) return 'Treino e dieta';
  if (treino) return 'Só treino';
  if (dieta) return 'Só dieta';
  return null;
}

/** Valor da linha "Planos ativos" da ficha: "Treino · Dieta", "Treino" ou "Dieta". Nulo = a linha não aparece. */
export function linhaDosPlanosAtivos(pa: QueInclui | null | undefined): string | null {
  const partes = [pa?.incluiTreino === true ? 'Treino' : null, pa?.incluiDieta === true ? 'Dieta' : null].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : null;
}

/**
 * Alerta do editor do plano do aluno quando o item não é incluído no plano atual. Só com `planosAtivos` presente e com
 * pelo menos um item incluído (os dois desligados é dado que não fecha: nada se diz); a mobilidade não tem aviso.
 */
export function avisoDoEditor(tipo: TipoPlano, pa: QueInclui | null | undefined): string | null {
  if (tipo === 'mobilidade' || !linhaDosPlanosAtivos(pa)) return null;
  if (tipo === 'treino' && pa?.incluiTreino !== true) return 'Este aluno não contratou treino no plano atual.';
  if (tipo === 'dieta' && pa?.incluiDieta !== true) return 'Este aluno não contratou dieta no plano atual.';
  return null;
}

/** Erro do grupo no formulário: os dois desligados (a API responde 422 `PLANO_INVALIDO` no `incluiTreino`). */
export function erroDoQueInclui(incluiTreino: boolean, incluiDieta: boolean): string | null {
  return incluiTreino || incluiDieta ? null : ERRO_DO_QUE_INCLUI;
}
