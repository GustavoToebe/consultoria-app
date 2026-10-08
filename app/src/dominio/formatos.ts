/**
 * Datas e números no formato brasileiro. A API usa ISO (`2026-10-11`); a tela usa DD/MM/AAAA digitado (nunca o
 * seletor de data nativo da web). Ausência de dado é "—".
 */

export const SEM_DADO = '—';

/** `2026-10-11` → `11/10/2026`; nulo → "". */
export function dataParaTela(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
}

/**
 * `11/10/2026` → `2026-10-11`. Vazio → `null`. Data impossível (31/02) ou incompleta → `undefined` (a tela mostra
 * o erro e não envia).
 */
export function dataDaTela(texto: string): string | null | undefined {
  const t = texto.trim();
  if (!t) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return undefined;
  const [, d, mes, a] = m;
  const data = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d)));
  if (data.getUTCFullYear() !== Number(a) || data.getUTCMonth() !== Number(mes) - 1 || data.getUTCDate() !== Number(d)) {
    return undefined;
  }
  return `${a}-${mes}-${d}`;
}

/** Máscara enquanto digita: só dígitos, barras nos lugares certos, até 10 caracteres. */
export function mascaraData(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/** Data de hoje (fuso do aparelho) em ISO. */
export function hojeIso(agora: Date = new Date()): string {
  const a = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

/** Soma dias a uma data ISO. */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d + dias));
  return data.toISOString().slice(0, 10);
}

/** Instante ISO → `11/10/2026 16:30` no fuso do aparelho. */
export function dataHoraParaTela(instante: string | null | undefined): string {
  if (!instante) return SEM_DADO;
  const data = new Date(instante);
  if (Number.isNaN(data.getTime())) return SEM_DADO;
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const hh = String(data.getHours()).padStart(2, '0');
  const mi = String(data.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${data.getFullYear()} ${hh}:${mi}`;
}

/** Número com vírgula, até `casas` decimais, sem zeros sobrando (`25,5`, `30`). Nulo → "—". */
export function numeroParaTela(valor: number | null | undefined, casas = 2): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return SEM_DADO;
  const fator = 10 ** casas;
  const arredondado = Math.round(valor * fator) / fator;
  return String(arredondado).replace('.', ',');
}

/**
 * Texto digitado → número. Aceita vírgula ou ponto. Vazio → `null`; texto que não é número → `undefined`.
 * `inteiro` recusa decimais (repetições, percentuais da regra).
 */
export function numeroDaTela(texto: string, inteiro = false): number | null | undefined {
  const t = texto.trim().replace(',', '.');
  if (!t) return null;
  const valido = inteiro ? /^-?\d+$/.test(t) : /^-?\d+(\.\d+)?$/.test(t);
  return valido ? Number(t) : undefined;
}

/** Dia da semana como no plano: 1 = segunda ... 7 = domingo. */
export function diaDaSemana(agora: Date = new Date()): number {
  return ((agora.getDay() + 6) % 7) + 1;
}

/** Dia da semana de uma data ISO (1 = segunda ... 7 = domingo), sem depender do fuso do aparelho. */
export function diaDaSemanaIso(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number);
  return ((new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

/** `2026-10-07` → `07/10` (chips de data). */
export function dataCurta(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return m && d ? `${d}/${m}` : '';
}
