import type { FiltroAtualizacoes } from '../api/agendaTipos';
import {
  lista, paraBusca, periodoDoEndereco, periodoParaEndereco, SEM_PERIODO, temPeriodo, textoDoPeriodo, umId,
  type Parametro, type Periodo,
} from './filtrosComuns';

/**
 * Filtros da lista de atualizações (`docs/planos/filtros-nas-listas.md`, D5). A situação continua nas abas
 * (`?situacao=`); a barra traz o responsável e o período, no endereço (`?meus=true` ou `?responsavel=<id>`, `?de=&ate=`),
 * e a busca pelo nome, local (a lista vem inteira). A rota aceita um responsável só (e não junto de `meus`) e o período
 * só em par. Funções puras.
 */
export const TODOS = 'TODOS';
export const MEUS = 'meus';
/** A rota aceita até 366 dias. */
export const MAXIMO_DIAS = 366;

export interface FiltrosDeAtualizacoes {
  /** `TODOS`, `MEUS` ou o id de um membro. */
  responsavel: string;
  periodo: Periodo;
}

export type ChaveDoFiltro = 'responsavel' | 'periodo';

export const SEM_FILTROS: FiltrosDeAtualizacoes = { responsavel: TODOS, periodo: SEM_PERIODO };

export const CHAVES_DO_ENDERECO = ['meus', 'responsavel', 'de', 'ate'] as const;

export interface ParametrosDoEndereco {
  meus?: Parametro;
  responsavel?: Parametro;
  de?: Parametro;
  ate?: Parametro;
}

export function lerDoEndereco(q: ParametrosDoEndereco): FiltrosDeAtualizacoes {
  const pessoa = umId(q.responsavel);
  return {
    responsavel: lista(q.meus)[0] === 'true' ? MEUS : pessoa ?? TODOS,
    periodo: periodoDoEndereco(q.de, q.ate, true, MAXIMO_DIAS),
  };
}

export function paraEndereco(f: FiltrosDeAtualizacoes): Record<string, string> {
  return {
    ...(f.responsavel === MEUS ? { meus: 'true' } : f.responsavel !== TODOS ? { responsavel: f.responsavel } : {}),
    ...periodoParaEndereco(f.periodo),
  };
}

/** O `meus` e o filtro de `listarAtualizacoes` (a rota recusa `meus` junto de `responsavel`). */
export function pedidoDaApi(f: FiltrosDeAtualizacoes): { meus: boolean; filtro: FiltroAtualizacoes } {
  const pessoa = f.responsavel !== TODOS && f.responsavel !== MEUS ? f.responsavel : undefined;
  return {
    meus: f.responsavel === MEUS,
    filtro: { ...(pessoa ? { responsavel: pessoa } : {}), ...(f.periodo.de && f.periodo.ate ? { de: f.periodo.de, ate: f.periodo.ate } : {}) },
  };
}

export const chaveDosFiltros = (f: FiltrosDeAtualizacoes) => JSON.stringify([f.responsavel, f.periodo.de, f.periodo.ate]);

/**
 * O número de cada aba vem do `/painel`, que só conhece Todos/Meus e nenhum período: com uma pessoa ou um período ele
 * não bate com a lista, então a aba fica sem número (ausência não vira número errado).
 */
export const contagensValem = (f: FiltrosDeAtualizacoes) => (f.responsavel === TODOS || f.responsavel === MEUS) && !temPeriodo(f.periodo);

export function rotuloDoResponsavel(valor: string, nomeDe: (id: string) => string | null): string {
  if (valor === MEUS) return 'Meus alunos';
  if (valor === TODOS) return 'Todos';
  return nomeDe(valor) ?? 'Outro membro';
}

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDeAtualizacoes, nomeDe: (id: string) => string | null = () => null): ChipDeFiltro[] {
  return [
    ...(f.responsavel !== TODOS ? [{ chave: 'responsavel' as const, texto: `Responsável: ${rotuloDoResponsavel(f.responsavel, nomeDe)}` }] : []),
    ...(temPeriodo(f.periodo) ? [{ chave: 'periodo' as const, texto: `Data: ${textoDoPeriodo(f.periodo)}` }] : []),
  ];
}

export function semOFiltro(f: FiltrosDeAtualizacoes, chave: ChaveDoFiltro): FiltrosDeAtualizacoes {
  return chave === 'responsavel' ? { ...f, responsavel: TODOS } : { ...f, periodo: SEM_PERIODO };
}

/** Todos, Meus alunos e as outras pessoas da equipe (por nome). */
export function opcoesDeResponsavel(pessoas: readonly { id: string; nome: string }[], usuarioId: string | null | undefined) {
  const outras = pessoas.filter((p) => p.id !== usuarioId).map((p) => ({ valor: p.id, rotulo: p.nome }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  return [{ valor: TODOS, rotulo: 'Todos' }, { valor: MEUS, rotulo: 'Meus alunos' }, ...outras];
}

/** Busca local pelo nome do aluno (sem acento). */
export function filtrarPorNome<T extends { nomeAluno: string | null }>(itens: readonly T[], busca: string): T[] {
  const termo = paraBusca(busca);
  return termo ? itens.filter((a) => paraBusca(a.nomeAluno).includes(termo)) : [...itens];
}
