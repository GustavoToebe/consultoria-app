import type { FiltroAtualizacoes } from '../api/agendaTipos';
import { periodoDoEndereco, periodoParaEndereco, SEM_PERIODO, temPeriodo, textoDoPeriodo, type Parametro, type Periodo } from './filtrosComuns';
import {
  lerResponsaveis, MEUS, opcoesDeResponsaveis, responsaveisParaApi, responsaveisParaEndereco, SEM_RESPONSAVEL, textoDosResponsaveis,
} from './responsaveisDoFiltro';

/**
 * Filtros da lista de atualizações (`docs/planos/filtros-nas-listas.md`, D5 e lote 2). A situação continua nas abas
 * (`?situacao=`); a barra traz os responsáveis (vários: Meus alunos, pessoas, Sem responsável) e o período, no endereço
 * (`?meus=true` ou `?responsavel=<id>,nenhum`, `?de=&ate=`), e a busca pelo nome, que vai à API (digitada, na tela).
 * O período só vai em par. As abas contam com os mesmos filtros (`GET /atualizacoes/contagens`). Funções puras.
 */
export { MEUS, SEM_RESPONSAVEL };
/** A rota aceita até 366 dias. */
export const MAXIMO_DIAS = 366;

export interface FiltrosDeAtualizacoes {
  /** `MEUS`, `SEM_RESPONSAVEL` e ids de membros. Vazio = todos. */
  responsaveis: string[];
  periodo: Periodo;
}

export type ChaveDoFiltro = 'responsavel' | 'periodo';

export const SEM_FILTROS: FiltrosDeAtualizacoes = { responsaveis: [], periodo: SEM_PERIODO };

export const CHAVES_DO_ENDERECO = ['meus', 'responsavel', 'de', 'ate'] as const;

export interface ParametrosDoEndereco {
  meus?: Parametro;
  responsavel?: Parametro;
  de?: Parametro;
  ate?: Parametro;
}

export function lerDoEndereco(q: ParametrosDoEndereco): FiltrosDeAtualizacoes {
  return { responsaveis: lerResponsaveis(q.meus, q.responsavel), periodo: periodoDoEndereco(q.de, q.ate, true, MAXIMO_DIAS) };
}

export function paraEndereco(f: FiltrosDeAtualizacoes): Record<string, string> {
  return { ...responsaveisParaEndereco(f.responsaveis), ...periodoParaEndereco(f.periodo) };
}

/** O `meus` e o filtro de `listarAtualizacoes`/`contagensAtualizacoes` (a rota recusa `meus` junto de `responsavel`). */
export function pedidoDaApi(f: FiltrosDeAtualizacoes, busca: string, usuarioId: string | null | undefined): { meus: boolean; filtro: FiltroAtualizacoes } {
  const r = responsaveisParaApi(f.responsaveis, usuarioId);
  const termo = busca.trim();
  return {
    meus: r.meus,
    filtro: {
      ...(r.responsavel.length ? { responsavel: r.responsavel } : {}),
      ...(termo ? { busca: termo } : {}),
      ...(f.periodo.de && f.periodo.ate ? { de: f.periodo.de, ate: f.periodo.ate } : {}),
    },
  };
}

export const chaveDosFiltros = (f: FiltrosDeAtualizacoes, busca = '') =>
  JSON.stringify([[...f.responsaveis].sort(), f.periodo.de, f.periodo.ate, busca.trim()]);

export interface ChipDeFiltro { chave: ChaveDoFiltro; texto: string }

export function chipsDosFiltros(f: FiltrosDeAtualizacoes, nomeDe: (id: string) => string | null = () => null): ChipDeFiltro[] {
  return [
    ...(f.responsaveis.length ? [{ chave: 'responsavel' as const, texto: `Responsável: ${textoDosResponsaveis(f.responsaveis, nomeDe)}` }] : []),
    ...(temPeriodo(f.periodo) ? [{ chave: 'periodo' as const, texto: `Data: ${textoDoPeriodo(f.periodo)}` }] : []),
  ];
}

export function semOFiltro(f: FiltrosDeAtualizacoes, chave: ChaveDoFiltro): FiltrosDeAtualizacoes {
  return chave === 'responsavel' ? { ...f, responsaveis: [] } : { ...f, periodo: SEM_PERIODO };
}

/** Meus alunos, as outras pessoas da equipe (por nome) e Sem responsável; nada marcado = todos. */
export const opcoesDeResponsavel = (pessoas: readonly { id: string; nome: string }[], usuarioId: string | null | undefined) =>
  opcoesDeResponsaveis(pessoas, usuarioId);
