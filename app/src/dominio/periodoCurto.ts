import { dataCurta, dataParaTela } from './formatos';

/** Data sem o ano quando é o ano de `hoje` ("07/10"); de outro ano, completa ("28/12/2025"). Vazio = "—". */
export function dataSemAnoCorrente(iso: string | null | undefined, hoje: string): string {
  if (!iso) return '—';
  return iso.slice(0, 4) === hoje.slice(0, 4) ? dataCurta(iso) : dataParaTela(iso);
}

/** "07/10 a 20/10" (o ano só aparece quando não é o corrente); nulo sem início nem fim. */
export function periodoCurto(p: { inicio: string | null; fim: string | null }, hoje: string): string | null {
  if (!p.inicio && !p.fim) return null;
  return `${dataSemAnoCorrente(p.inicio, hoje)} a ${dataSemAnoCorrente(p.fim, hoje)}`;
}
