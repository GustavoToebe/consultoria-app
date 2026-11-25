import type { TagDeAluno } from '../api/tipos';
import { resumoDasTagsNaLinha } from './tagsDeAluno';

/**
 * Selos de exceção da linha da lista de alunos, na ordem em que aparecem (primeiro a situação, depois as tags). O texto diz
 * **o que** está vencido: a única fonte do atraso é `GET /financeiro/alunos-em-atraso` (cobrança aberta vencida), então é
 * "Cobrança vencida"; "Vencida" sozinho podia ser a pasta ou o plano. Pasta e plano não têm selo na lista (a atualização
 * atrasada já tem o seu, na coluna "Atualização").
 */
export interface SeloDeExcecao { texto: string; tipo: 'perigo' | 'neutro' }

export const TEXTO_DA_COBRANCA_VENCIDA = 'Cobrança vencida';

export function selosDeExcecaoDoAluno(a: { ativo: boolean; temAcesso: boolean; emAtraso: boolean }): SeloDeExcecao[] {
  return [
    ...(a.emAtraso ? [{ texto: TEXTO_DA_COBRANCA_VENCIDA, tipo: 'perigo' as const }] : []),
    ...(!a.ativo ? [{ texto: 'Inativo', tipo: 'neutro' as const }] : []),
    ...(a.ativo && !a.temAcesso ? [{ texto: 'Sem acesso', tipo: 'neutro' as const }] : []),
  ];
}

/** As tags que não cabem na linha (as duas primeiras ficam visíveis, o resto vira "+N"). */
export function tagsEscondidasDaLinha(tags: readonly TagDeAluno[]): TagDeAluno[] {
  return tags.slice(resumoDasTagsNaLinha(tags).visiveis.length);
}

/** Nome acessível do "+N": "Mais 2 tags: Presencial, Avançado"; sem tags escondidas, `null`. */
export function rotuloDoMaisTags(tags: readonly TagDeAluno[]): string | null {
  const escondidas = tagsEscondidasDaLinha(tags);
  if (!escondidas.length) return null;
  return `Mais ${escondidas.length} ${escondidas.length === 1 ? 'tag' : 'tags'}: ${escondidas.map((t) => t.nome).join(', ')}`;
}

/** Texto do tooltip do "+N" (`title` na web): uma tag por linha. */
export function dicaDoMaisTags(tags: readonly TagDeAluno[]): string | null {
  const escondidas = tagsEscondidasDaLinha(tags);
  return escondidas.length ? escondidas.map((t) => t.nome).join('\n') : null;
}
