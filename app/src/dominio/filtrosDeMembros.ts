import type { MembroEquipe } from '../api/equipeTipos';
import { paraBusca, rotulos } from './filtrosComuns';

/**
 * Filtros dos membros da equipe (`docs/planos/filtros-nas-listas.md`, D11): a lista vem inteira da API, então busca,
 * situação e perfil filtram aqui, no que já veio. Várias situações e vários perfis = "ou"; vazio = todos. Funções puras.
 */
export type SituacaoDoMembro = 'ATIVO' | 'INATIVO' | 'CONVITE';

export interface FiltrosDeMembros {
  situacoes: SituacaoDoMembro[];
  /** Ids de perfil. */
  perfis: string[];
}

export type ChaveDoFiltro = 'situacao' | 'perfil';

export const SEM_FILTROS: FiltrosDeMembros = { situacoes: [], perfis: [] };

export const SITUACOES_DO_MEMBRO: readonly { valor: SituacaoDoMembro; rotulo: string }[] = [
  { valor: 'ATIVO', rotulo: 'Ativos' },
  { valor: 'INATIVO', rotulo: 'Inativos' },
  { valor: 'CONVITE', rotulo: 'Convite pendente' },
];

/** A situação do membro como a lista mostra no selo: convite pendente vem antes de ativo/inativo. */
export function situacaoDoMembro(m: Pick<MembroEquipe, 'ativo' | 'convitePendente'>): SituacaoDoMembro {
  return m.convitePendente ? 'CONVITE' : m.ativo ? 'ATIVO' : 'INATIVO';
}

export function filtrarMembros<T extends Pick<MembroEquipe, 'nome' | 'email' | 'perfilId' | 'ativo' | 'convitePendente'>>(
  membros: readonly T[], f: FiltrosDeMembros, busca: string,
): T[] {
  const termo = paraBusca(busca);
  return membros.filter((m) => (!termo || paraBusca(`${m.nome} ${m.email}`).includes(termo))
    && (!f.situacoes.length || f.situacoes.includes(situacaoDoMembro(m)))
    && (!f.perfis.length || f.perfis.includes(m.perfilId)));
}

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDeMembros, perfis: readonly { id: string; nome: string }[]): ChipDeFiltro[] {
  const nomes = f.perfis.map((id) => perfis.find((p) => p.id === id)?.nome ?? 'Outro perfil');
  return [
    ...(f.situacoes.length ? [{ chave: 'situacao' as const, texto: `Situação: ${rotulos(f.situacoes, SITUACOES_DO_MEMBRO)}` }] : []),
    ...(nomes.length ? [{ chave: 'perfil' as const, texto: `Perfil: ${nomes.join(', ')}` }] : []),
  ];
}

export function semOFiltro(f: FiltrosDeMembros, chave: ChaveDoFiltro): FiltrosDeMembros {
  return chave === 'situacao' ? { ...f, situacoes: [] } : { ...f, perfis: [] };
}
