import { lista, ehId, type Parametro } from './filtrosComuns';

/**
 * Filtro de responsável de várias opções (lote 2 de `docs/planos/filtros-nas-listas.md`), comum a Atualizações e
 * Interessados, com a mesma regra da lista de alunos: "Meus" (o usuário da sessão), pessoas da equipe e "Sem
 * responsável", vários de uma vez; nada marcado = todos. No endereço: só Meus = `meus=true`; o resto vai em
 * `responsavel=` numa vírgula. Na API: só Meus = `meus=true`; Meus junto de outros vira o id do usuário (a API recusa
 * `meus` com `responsavel`). Funções puras.
 */
export const MEUS = 'meus';
export const SEM_RESPONSAVEL = 'nenhum';

/** `meus=true` = só Meus; `responsavel=` = pessoas, `meus` e/ou `nenhum` (valor estranho é ignorado). */
export function lerResponsaveis(meus: Parametro, responsavel: Parametro): string[] {
  if (lista(meus)[0] === 'true') return [MEUS];
  const valores = lista(responsavel).map((v) => (v.toLowerCase() === MEUS || v.toLowerCase() === SEM_RESPONSAVEL ? v.toLowerCase() : v))
    .filter((v) => v === MEUS || v === SEM_RESPONSAVEL || ehId(v));
  return [...new Set(valores)];
}

export const soMeus = (r: readonly string[]) => r.length === 1 && r[0] === MEUS;

export function responsaveisParaEndereco(r: readonly string[]): Record<string, string> {
  if (!r.length) return {};
  return soMeus(r) ? { meus: 'true' } : { responsavel: r.join(',') };
}

/** O que vai à API. Sem o id do usuário, "Meus" junto de outros é ignorado. */
export function responsaveisParaApi(r: readonly string[], usuarioId: string | null | undefined): { meus: boolean; responsavel: string[] } {
  if (soMeus(r)) return { meus: true, responsavel: [] };
  const ids = r.flatMap((v) => (v === MEUS ? (usuarioId ? [usuarioId] : []) : [v]));
  return { meus: false, responsavel: [...new Set(ids)] };
}

/** "Meus alunos, Bia Fictícia, Sem responsável" (Meus primeiro, Sem responsável por último). */
export function textoDosResponsaveis(r: readonly string[], nomeDe: (id: string) => string | null, rotuloDeMeus = 'Meus alunos'): string {
  const ordem = [MEUS, ...r.filter((v) => v !== MEUS && v !== SEM_RESPONSAVEL), SEM_RESPONSAVEL].filter((v) => r.includes(v));
  return ordem.map((v) => (v === MEUS ? rotuloDeMeus : v === SEM_RESPONSAVEL ? 'Sem responsável' : nomeDe(v) ?? 'Outro membro')).join(', ');
}

/** Opções do seletor: Meus, as outras pessoas da equipe (por nome) e Sem responsável. */
export function opcoesDeResponsaveis(pessoas: readonly { id: string; nome: string }[], usuarioId: string | null | undefined, rotuloDeMeus = 'Meus alunos') {
  const outras = pessoas.filter((p) => p.id !== usuarioId).map((p) => ({ valor: p.id, rotulo: p.nome }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  return [{ valor: MEUS, rotulo: rotuloDeMeus }, ...outras, { valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' }];
}
