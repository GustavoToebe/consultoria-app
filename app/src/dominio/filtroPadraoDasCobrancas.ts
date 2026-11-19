import {
  CHAVES_DE_COBRANCAS, cobrancasParaEndereco, lerCobrancasDoEndereco, SEM_FILTROS_DE_COBRANCAS, SITUACOES_ATIVAS,
  type FiltrosDeCobrancas, type ParametrosDeCobrancas,
} from './filtrosDoFinanceiro';
import { rotuloDoMesNumerico } from './mesDaCompetencia';

/**
 * Filtro padrão das cobranças (Gustavo, 19/11): a aba abre em Situação = Ativas e Competência = mês atual de Brasília.
 * Só no app, sem mudar a API: a competência vai como vencimento do dia 1 ao último dia do mês (`vencimentoDaApi`), então
 * a avulsa e a parcela de acordo (sem competência) entram pelo mês em que vencem e a avulsa recém-criada para este mês
 * não some. O padrão só vale com o endereço sem nenhuma chave das cobranças: quem chega com filtro próprio (Vencidas e
 * Vencendo do Início, "Ver no Financeiro" da ficha) fica com o dele, mesmo com valor desconhecido. Tirar todos os filtros
 * grava `filtro=nenhum`, para o recarregar e o voltar continuarem sem filtro. Funções puras.
 */
export const MARCA_SEM_FILTRO = { filtro: 'nenhum' } as const;

/** Situação: Ativas; Competência: o mês de `hoje` (`AAAA-MM-DD` de Brasília, `hojeEmBrasilia`). */
export function filtroPadraoDasCobrancas(hoje: string): FiltrosDeCobrancas {
  return { ...SEM_FILTROS_DE_COBRANCAS, situacoes: [...SITUACOES_ATIVAS], competencia: hoje.slice(0, 7) };
}

/** O endereço traz alguma chave das cobranças (presença, não validade: `?situacao=QUALQUER` também conta). */
export function temChaveDasCobrancas(q: ParametrosDeCobrancas): boolean {
  return CHAVES_DE_COBRANCAS.some((k) => q[k] !== undefined);
}

/** Os filtros em vigor na aba: os do endereço ou, sem nenhuma chave lá, o padrão. */
export function filtrosDaAbaDeCobrancas(q: ParametrosDeCobrancas, hoje: string): FiltrosDeCobrancas {
  return temChaveDasCobrancas(q) ? lerCobrancasDoEndereco(q) : filtroPadraoDasCobrancas(hoje);
}

/** O endereço dos filtros aplicados; sem nenhum, a marca `filtro=nenhum` (senão o padrão voltaria). */
export function enderecoDasCobrancas(f: FiltrosDeCobrancas): Record<string, string> {
  const e = cobrancasParaEndereco(f);
  return Object.keys(e).length > 0 ? e : { ...MARCA_SEM_FILTRO };
}

/**
 * As competências do painel de filtros, da mais nova para a mais antiga: o mês seguinte (a cobrança do próximo mês já
 * pode ter sido gerada), o atual e os 11 anteriores. A escolhida que ficou fora (veio do endereço) entra também.
 */
export function competenciasDoFiltro(hoje: string, escolhida: string | null = null): { valor: string; rotulo: string }[] {
  const [ano, mes] = hoje.split('-').map(Number);
  const meses = Array.from({ length: 13 }, (_, i) => {
    const indice = ano * 12 + (mes - 1) + 1 - i;
    return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`;
  });
  if (escolhida && !meses.includes(escolhida)) meses.push(escolhida);
  return meses.map((valor) => ({ valor, rotulo: rotuloDoMesNumerico(valor) }));
}
