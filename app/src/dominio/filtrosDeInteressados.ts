import type { FiltroInscricoes, Origem } from '../api/inscricoesTipos';
import { lista, um, umId, type Parametro } from './filtrosComuns';
import { FILTROS_INSCRICOES, OPCOES_ORIGEM } from './inscricoes';

/**
 * Filtros de Interessados (`docs/planos/filtros-nas-listas.md`, D6): situação (só na Lista), responsável e origem, no
 * endereço (`?situacao=&meus=true&responsavel=<id|nenhum>&origem=`); a busca vai à API mas mora na tela (digitada). A
 * rota aceita um responsável só e não junto de `meus`. Funções puras.
 */
export const TODOS = 'TODOS';
export const MEUS = 'meus';
export const SEM_RESPONSAVEL = 'nenhum';

export type FiltroDeOrigem = '' | Origem | 'NAO_INFORMADA';

export interface FiltrosDeInteressados {
  situacao: FiltroInscricoes;
  /** `TODOS`, `MEUS`, `SEM_RESPONSAVEL` ou o id de um membro. */
  responsavel: string;
  origem: FiltroDeOrigem;
}

export type ChaveDoFiltro = 'situacao' | 'responsavel' | 'origem';
export type VisaoDosFiltros = 'lista' | 'kanban';

export const SEM_FILTROS: FiltrosDeInteressados = { situacao: 'ABERTAS', responsavel: TODOS, origem: '' };

export const CHAVES_DO_ENDERECO = ['situacao', 'meus', 'responsavel', 'origem'] as const;

export const OPCOES_FILTRO_ORIGEM: { valor: FiltroDeOrigem; rotulo: string }[] = [
  { valor: '', rotulo: 'Todas' },
  ...OPCOES_ORIGEM,
  { valor: 'NAO_INFORMADA', rotulo: 'Não informada' },
];

const ORIGENS_VALIDAS = OPCOES_FILTRO_ORIGEM.filter((o): o is { valor: Origem | 'NAO_INFORMADA'; rotulo: string } => o.valor !== '');

export interface ParametrosDoEndereco {
  situacao?: Parametro;
  meus?: Parametro;
  responsavel?: Parametro;
  origem?: Parametro;
}

export function lerDoEndereco(q: ParametrosDoEndereco): FiltrosDeInteressados {
  const pedido = lista(q.responsavel)[0]?.toLowerCase();
  const responsavel = lista(q.meus)[0] === 'true' ? MEUS : pedido === SEM_RESPONSAVEL ? SEM_RESPONSAVEL : umId(q.responsavel) ?? TODOS;
  return {
    situacao: um(q.situacao, FILTROS_INSCRICOES) ?? 'ABERTAS',
    responsavel,
    origem: um(q.origem, ORIGENS_VALIDAS) ?? '',
  };
}

/** Os filtros que não são de uma visão só (responsável e origem): vão junto quando muda a visão. */
export function paraEnderecoSemSituacao(f: FiltrosDeInteressados): Record<string, string> {
  return {
    ...(f.responsavel === MEUS ? { meus: 'true' } : f.responsavel !== TODOS ? { responsavel: f.responsavel } : {}),
    ...(f.origem ? { origem: f.origem } : {}),
  };
}

export function paraEndereco(f: FiltrosDeInteressados): Record<string, string> {
  return { ...(f.situacao !== 'ABERTAS' ? { situacao: f.situacao } : {}), ...paraEnderecoSemSituacao(f) };
}

/** Os filtros da lista, das contagens e do Kanban (`FiltrosDoQuadro`), com a busca digitada. */
export function filtrosDaFila(f: FiltrosDeInteressados, busca: string) {
  const meus = f.responsavel === MEUS;
  return {
    meus,
    busca: busca.trim() || undefined,
    responsavel: !meus && f.responsavel !== TODOS ? f.responsavel : undefined,
    origem: f.origem || undefined,
  };
}

export const chaveDosFiltros = (f: FiltrosDeInteressados, busca: string) => JSON.stringify([f.responsavel, f.origem, busca.trim()]);

/** A situação só vale na Lista; o Kanban já separa por etapa. */
export function filtrosVisiveis(visao: VisaoDosFiltros): ChaveDoFiltro[] {
  return visao === 'lista' ? ['situacao', 'responsavel', 'origem'] : ['responsavel', 'origem'];
}

/** Há filtro além da situação e da busca? (estado vazio). */
export const temOutrosFiltros = (f: FiltrosDeInteressados) => (f.responsavel !== TODOS && f.responsavel !== MEUS) || !!f.origem;

export function rotuloDoResponsavel(valor: string, nomeDe: (id: string) => string | null): string {
  if (valor === MEUS) return 'Meus';
  if (valor === TODOS) return 'Toda a equipe';
  if (valor === SEM_RESPONSAVEL) return 'Sem responsável';
  return nomeDe(valor) ?? 'Outro membro';
}

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDeInteressados, visao: VisaoDosFiltros, nomeDe: (id: string) => string | null = () => null): ChipDeFiltro[] {
  const visiveis = filtrosVisiveis(visao);
  const chips: ChipDeFiltro[] = [];
  if (visiveis.includes('situacao') && f.situacao !== 'ABERTAS') {
    chips.push({ chave: 'situacao', texto: `Situação: ${FILTROS_INSCRICOES.find((o) => o.valor === f.situacao)?.rotulo ?? f.situacao}` });
  }
  if (f.responsavel !== TODOS) chips.push({ chave: 'responsavel', texto: `Responsável: ${rotuloDoResponsavel(f.responsavel, nomeDe)}` });
  if (f.origem) chips.push({ chave: 'origem', texto: `Origem: ${OPCOES_FILTRO_ORIGEM.find((o) => o.valor === f.origem)?.rotulo ?? f.origem}` });
  return chips;
}

export function semOFiltro(f: FiltrosDeInteressados, chave: ChaveDoFiltro): FiltrosDeInteressados {
  if (chave === 'situacao') return { ...f, situacao: SEM_FILTROS.situacao };
  if (chave === 'responsavel') return { ...f, responsavel: TODOS };
  return { ...f, origem: '' };
}

/** "Limpar filtros" tira o que a visão mostra; na Kanban a situação da Lista fica como estava. */
export function limpos(f: FiltrosDeInteressados, visao: VisaoDosFiltros): FiltrosDeInteressados {
  return visao === 'lista' ? SEM_FILTROS : { ...SEM_FILTROS, situacao: f.situacao };
}

/** Toda a equipe, Meus, as outras pessoas (por nome) e Sem responsável. */
export function opcoesDeResponsavel(pessoas: readonly { id: string; nome: string }[], usuarioId: string | null | undefined) {
  const outras = pessoas.filter((p) => p.id !== usuarioId).map((p) => ({ valor: p.id, rotulo: p.nome }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  return [{ valor: TODOS, rotulo: 'Toda a equipe' }, { valor: MEUS, rotulo: 'Meus' }, ...outras, { valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' }];
}
