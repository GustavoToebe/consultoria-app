import type { QuestionarioResumo } from '../api/tipos';
import { paraBusca } from './filtrosComuns';

/**
 * Filtros das abas Atualização e Anamnese do Planejamento (`docs/planos/filtros-nas-listas.md`, D12 e lote 2): a situação
 * (ativos, arquivados ou todos) vai à API (`?arquivados=false|true|todos`); a busca e a publicação filtram a lista que
 * veio inteira. Funções puras.
 */
export type SituacaoDoQuestionario = 'ATIVOS' | 'ARQUIVADOS' | 'TODOS';
export type PublicacaoDoQuestionario = '' | 'PUBLICADOS' | 'NUNCA_PUBLICADOS' | 'ALTERADOS';

export interface FiltrosDeQuestionarios {
  situacao: SituacaoDoQuestionario;
  publicacao: PublicacaoDoQuestionario;
}

export type ChaveDoFiltro = 'situacao' | 'publicacao';

export const SEM_FILTROS: FiltrosDeQuestionarios = { situacao: 'ATIVOS', publicacao: '' };

export const SITUACOES_DO_QUESTIONARIO: readonly { valor: SituacaoDoQuestionario; rotulo: string }[] = [
  { valor: 'ATIVOS', rotulo: 'Ativos' },
  { valor: 'ARQUIVADOS', rotulo: 'Arquivados' },
  { valor: 'TODOS', rotulo: 'Todos' },
];

/** O parâmetro `arquivados` da rota. */
export const arquivadosDaApi = (s: SituacaoDoQuestionario): boolean | 'todos' => (s === 'TODOS' ? 'todos' : s === 'ARQUIVADOS');

export const PUBLICACOES: readonly { valor: PublicacaoDoQuestionario; rotulo: string }[] = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'PUBLICADOS', rotulo: 'Publicados' },
  { valor: 'NUNCA_PUBLICADOS', rotulo: 'Nunca publicados' },
  { valor: 'ALTERADOS', rotulo: 'Alterados desde a publicação' },
];

type Resumo = Pick<QuestionarioResumo, 'nome' | 'descricao' | 'versaoPublicada' | 'alteradoDesdePublicacao'>;

function passaNaPublicacao(q: Resumo, p: PublicacaoDoQuestionario): boolean {
  if (p === 'PUBLICADOS') return q.versaoPublicada > 0;
  if (p === 'NUNCA_PUBLICADOS') return q.versaoPublicada === 0;
  if (p === 'ALTERADOS') return q.alteradoDesdePublicacao;
  return true;
}

/** Busca (nome e descrição, sem acento) e publicação sobre a lista que a API mandou. */
export function filtrarQuestionarios<T extends Resumo>(lista: readonly T[], f: FiltrosDeQuestionarios, busca: string): T[] {
  const termo = paraBusca(busca);
  return lista.filter((q) => (!termo || paraBusca(`${q.nome} ${q.descricao ?? ''}`).includes(termo)) && passaNaPublicacao(q, f.publicacao));
}

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDeQuestionarios): ChipDeFiltro[] {
  return [
    ...(f.situacao !== 'ATIVOS' ? [{ chave: 'situacao' as const, texto: `Situação: ${f.situacao === 'TODOS' ? 'Ativos e arquivados' : 'Arquivados'}` }] : []),
    ...(f.publicacao ? [{ chave: 'publicacao' as const, texto: `Publicação: ${PUBLICACOES.find((p) => p.valor === f.publicacao)?.rotulo ?? ''}` }] : []),
  ];
}

export function semOFiltro(f: FiltrosDeQuestionarios, chave: ChaveDoFiltro): FiltrosDeQuestionarios {
  return chave === 'situacao' ? { ...f, situacao: 'ATIVOS' } : { ...f, publicacao: '' };
}
