import type { MesDeNumeros } from '../api/tipos';
import { SEM_DADO } from './formatos';

/**
 * Regras puras da tela Números (`GET /numeros`): só contagens da consultoria, sem nomes. `null` da API é "sem dado" e
 * aparece como "—"; zero só quando a API manda 0. Nenhuma soma ou resumo sai com valor faltando (nada de média com buraco).
 */

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

/** Marca do mês corrente, que ainda não terminou. */
export const MARCA_PARCIAL = 'até hoje';

/** Explicações da tela, em linguagem simples. */
export const REGRA_ALUNOS_ATIVOS = 'Alunos ativos no fim do mês: quem já estava cadastrado e não tinha sido inativado até o último dia do mês.';
export const REGRA_ATUALIZACOES = 'Atualização no prazo: enviada até a data limite. Atrasada: enviada depois dela ou ainda não enviada com a data já vencida.';

/** Só número finito conta como dado; qualquer outra coisa (nulo, ausente, texto) é "sem dado". */
function valor(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Contagem na tela: o número inteiro, ou "—" quando não há dado. Zero é zero. */
export function contagemParaTela(v: number | null | undefined): string {
  const n = valor(v);
  return n === null ? SEM_DADO : String(Math.round(n));
}

/** `2026-05` → `mai/2026`; mês fora do formato → "—". */
export function rotuloDoMes(mes: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(mes ?? '');
  const indice = m ? Number(m[2]) - 1 : -1;
  return m && indice >= 0 && indice < 12 ? `${MESES_CURTOS[indice]}/${m[1]}` : SEM_DADO;
}

/** Rótulo do mês com a marca "até hoje" no corrente: `jun/2026 (até hoje)`. */
export function rotuloDoMesCompleto(m: Pick<MesDeNumeros, 'mes' | 'parcial'>): string {
  const rotulo = rotuloDoMes(m.mes);
  return m.parcial ? `${rotulo} (${MARCA_PARCIAL})` : rotulo;
}

/** No prazo + atrasadas do mês, só quando as duas existem; senão `null` (um lado faltando não vira total). */
export function totalDoMes(m: Pick<MesDeNumeros, 'atualizacoesNoPrazo' | 'atualizacoesAtrasadas'>): number | null {
  const noPrazo = valor(m.atualizacoesNoPrazo);
  const atrasadas = valor(m.atualizacoesAtrasadas);
  return noPrazo === null || atrasadas === null ? null : noPrazo + atrasadas;
}

export interface ResumoDasAtualizacoes {
  /** Meses fechados somados. */
  meses: number;
  noPrazo: number;
  atrasadas: number;
  total: number;
}

/**
 * Soma das atualizações dos meses **fechados** (o corrente está pela metade e não entra). Só existe quando há ao menos um
 * mês fechado e todos eles trazem os dois números: com um buraco, `null` (a tela não mostra resumo).
 */
export function resumoDasAtualizacoes(meses: readonly MesDeNumeros[]): ResumoDasAtualizacoes | null {
  const fechados = meses.filter((m) => !m.parcial);
  if (fechados.length === 0) return null;
  let noPrazo = 0;
  let atrasadas = 0;
  for (const m of fechados) {
    const a = valor(m.atualizacoesNoPrazo);
    const b = valor(m.atualizacoesAtrasadas);
    if (a === null || b === null) return null;
    noPrazo += a;
    atrasadas += b;
  }
  return { meses: fechados.length, noPrazo, atrasadas, total: noPrazo + atrasadas };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "Nos 5 meses fechados: 20 atualizações (17 no prazo, 3 atrasadas)." */
export function textoDoResumo(r: ResumoDasAtualizacoes): string {
  const periodo = r.meses === 1 ? 'No mês fechado' : `Nos ${r.meses} meses fechados`;
  return `${periodo}: ${plural(r.total, 'atualização', 'atualizações')} (${r.noPrazo} no prazo, ${plural(r.atrasadas, 'atrasada', 'atrasadas')}).`;
}
