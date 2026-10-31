import type { FiltroDeSituacao } from '../api/financeiroTipos';
import {
  lista, periodoDoEndereco, periodoParaEndereco, SEM_PERIODO, temPeriodo, textoDoPeriodo, um, type Parametro, type Periodo,
} from './filtrosComuns';
import { FILTROS_DE_SITUACAO } from './financeiro';
import { dataParaTela, somarDias } from './formatos';

/**
 * Filtros do Financeiro (`docs/planos/filtros-nas-listas.md`, D7 e D8): Cobranças (responsável, situação e vencimento) e
 * Lançamentos (período). Tudo no endereço, junto do `?aba=`. A rota de cobranças filtra o vencimento por `de`/`ate`; os
 * "próximos 7 dias" (`?vencimento=PROXIMOS_7_DIAS`, o mini-cartão "Vencendo" do Início) são de hoje a hoje + 7, a mesma
 * janela do painel. Funções puras.
 */
export const PROXIMOS_7_DIAS = 'PROXIMOS_7_DIAS';
export const DIAS_DA_JANELA = 7;

export interface FiltrosDeCobrancas {
  situacao: FiltroDeSituacao;
  meus: boolean;
  /** Vencimento de hoje a hoje + 7 (vale mais que o período). */
  proximos7Dias: boolean;
  /** Vencimento entre estas datas. */
  periodo: Periodo;
}

export type ChaveDoFiltroDeCobrancas = 'responsavel' | 'situacao' | 'vencimento';

export const SEM_FILTROS_DE_COBRANCAS: FiltrosDeCobrancas = { situacao: 'TODAS', meus: false, proximos7Dias: false, periodo: SEM_PERIODO };

export const CHAVES_DE_COBRANCAS = ['situacao', 'meus', 'vencimento', 'de', 'ate'] as const;

export interface ParametrosDeCobrancas {
  situacao?: Parametro;
  meus?: Parametro;
  vencimento?: Parametro;
  de?: Parametro;
  ate?: Parametro;
}

export function lerCobrancasDoEndereco(q: ParametrosDeCobrancas): FiltrosDeCobrancas {
  const proximos7Dias = lista(q.vencimento)[0] === PROXIMOS_7_DIAS;
  return {
    situacao: um(q.situacao, FILTROS_DE_SITUACAO) ?? 'TODAS',
    meus: lista(q.meus)[0] === 'true',
    proximos7Dias,
    periodo: proximos7Dias ? SEM_PERIODO : periodoDoEndereco(q.de, q.ate),
  };
}

export function cobrancasParaEndereco(f: FiltrosDeCobrancas): Record<string, string> {
  return {
    ...(f.situacao !== 'TODAS' ? { situacao: f.situacao } : {}),
    ...(f.meus ? { meus: 'true' } : {}),
    ...(f.proximos7Dias ? { vencimento: PROXIMOS_7_DIAS } : periodoParaEndereco(f.periodo)),
  };
}

/** O vencimento que vai à API (`de`/`ate`), com a data de hoje de Brasília. */
export function vencimentoDaApi(f: FiltrosDeCobrancas, hoje: string): { de?: string; ate?: string } {
  if (f.proximos7Dias) return { de: hoje, ate: somarDias(hoje, DIAS_DA_JANELA) };
  return { ...(f.periodo.de ? { de: f.periodo.de } : {}), ...(f.periodo.ate ? { ate: f.periodo.ate } : {}) };
}

export const chaveDasCobrancas = (f: FiltrosDeCobrancas) => JSON.stringify([f.situacao, f.meus, f.proximos7Dias, f.periodo.de, f.periodo.ate]);

export const temVencimento = (f: FiltrosDeCobrancas) => f.proximos7Dias || temPeriodo(f.periodo);

/** "próximos 7 dias (até 26/10/2026)" ou o período. */
export function textoDoVencimento(f: FiltrosDeCobrancas, hoje: string): string {
  if (f.proximos7Dias) return `de hoje até ${dataParaTela(somarDias(hoje, DIAS_DA_JANELA))}`;
  return textoDoPeriodo(f.periodo);
}

export interface ChipDoFinanceiro<C extends string> { chave: C; texto: string }

export function chipsDasCobrancas(f: FiltrosDeCobrancas, hoje: string): ChipDoFinanceiro<ChaveDoFiltroDeCobrancas>[] {
  return [
    ...(f.meus ? [{ chave: 'responsavel' as const, texto: 'Responsável: Meus' }] : []),
    ...(f.situacao !== 'TODAS' ? [{ chave: 'situacao' as const, texto: `Situação: ${FILTROS_DE_SITUACAO.find((o) => o.valor === f.situacao)?.rotulo ?? f.situacao}` }] : []),
    ...(temVencimento(f) ? [{ chave: 'vencimento' as const, texto: `Vencimento: ${textoDoVencimento(f, hoje)}` }] : []),
  ];
}

export function semOFiltroDeCobrancas(f: FiltrosDeCobrancas, chave: ChaveDoFiltroDeCobrancas): FiltrosDeCobrancas {
  if (chave === 'responsavel') return { ...f, meus: false };
  if (chave === 'situacao') return { ...f, situacao: 'TODAS' };
  return { ...f, proximos7Dias: false, periodo: SEM_PERIODO };
}

/** Texto da contagem do cartão ("Em aberto, vencimento de hoje até 26/10/2026: 3 cobranças"). */
export function descricaoDasCobrancas(f: FiltrosDeCobrancas, hoje: string, total: number): string {
  const situacao = FILTROS_DE_SITUACAO.find((o) => o.valor === f.situacao)?.rotulo ?? 'Todas';
  const vencimento = temVencimento(f) ? `, vencimento ${textoDoVencimento(f, hoje)}` : '';
  return `${situacao}${vencimento}: ${total} ${total === 1 ? 'cobrança' : 'cobranças'}, por vencimento. Toque na linha para abrir.`;
}

// ---- Lançamentos ----

export interface FiltrosDeLancamentos { periodo: Periodo }
export const SEM_FILTROS_DE_LANCAMENTOS: FiltrosDeLancamentos = { periodo: SEM_PERIODO };
export const CHAVES_DE_LANCAMENTOS = ['de', 'ate'] as const;

export function lerLancamentosDoEndereco(q: { de?: Parametro; ate?: Parametro }): FiltrosDeLancamentos {
  return { periodo: periodoDoEndereco(q.de, q.ate) };
}

export const lancamentosParaEndereco = (f: FiltrosDeLancamentos) => periodoParaEndereco(f.periodo);

export function chipsDosLancamentos(f: FiltrosDeLancamentos): ChipDoFinanceiro<'periodo'>[] {
  return temPeriodo(f.periodo) ? [{ chave: 'periodo', texto: `Data: ${textoDoPeriodo(f.periodo)}` }] : [];
}
