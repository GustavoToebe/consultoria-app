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

/**
 * Máscara de número enquanto digita (pergunta NUMERO): só dígitos e uma vírgula, no máximo `casas` decimais (ponto vira
 * vírgula). Sem casas, vale a parte antes da vírgula (nunca junta os dígitos: "2,5" não vira 25). O `-` só passa no começo e
 * só com `negativo` (pergunta que aceita mínimo abaixo de zero). Em metros (`emMetros`, para altura) basta digitar os
 * algarismos: `175` vira `1,75` (um dígito antes da vírgula).
 */
export function mascaraDeNumero(texto: string, casas: number, opcoes: { emMetros?: boolean; negativo?: boolean } = {}): string {
  const sinal = opcoes.negativo && texto.trimStart().startsWith('-') ? '-' : '';
  if (casas <= 0) return sinal + (texto.split(/[.,]/)[0] ?? '').replace(/\D/g, '');
  if (opcoes.emMetros) {
    const digitos = texto.replace(/\D/g, '').slice(0, 1 + casas);
    return sinal + (digitos.length <= 1 ? digitos : `${digitos[0]},${digitos.slice(1)}`);
  }
  const [inteiro, ...resto] = texto.replace(/[^\d.,]/g, '').split(/[.,]/);
  if (resto.length === 0) return sinal + inteiro;
  return `${sinal}${inteiro},${resto.join('').slice(0, casas)}`;
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

/** `1234.5` → `R$ 1.234,50`. Nulo → "—". Não depende de `Intl` (o Hermes do celular pode não ter pt-BR). */
export function moedaParaTela(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return SEM_DADO;
  const [inteiro, centavos] = Math.abs(valor).toFixed(2).split('.');
  const milhares = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${valor < 0 ? '-' : ''}R$ ${milhares},${centavos}`;
}

/**
 * Dinheiro do financeiro: a API manda **centavos** inteiros (`12345` → `R$ 123,45`). Conta só com inteiros, sem passar
 * por ponto flutuante. Nulo → "—" (sem dado nunca vira `R$ 0,00`).
 */
export function centavosParaTela(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return SEM_DADO;
  const total = Math.round(Math.abs(centavos));
  const reais = Math.floor(total / 100);
  const resto = String(total % 100).padStart(2, '0');
  const milhares = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${centavos < 0 && total > 0 ? '-' : ''}R$ ${milhares},${resto}`;
}

/** Centavos como o campo mostra ao editar: `12345` → `123,45` (sem "R$" nem milhar). Nulo → "". */
export function centavosParaCampo(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return '';
  const total = Math.round(Math.abs(centavos));
  return `${Math.floor(total / 100)},${String(total % 100).padStart(2, '0')}`;
}

/**
 * Valor digitado em reais → centavos inteiros. Aceita `150`, `150,5`, `1.234,50`, `R$ 99,90` e `12.50` (ponto com uma
 * ou duas casas). Parte inteira e parte decimal são lidas separadas (nada de `parseFloat * 100`). Vazio, mais de duas
 * casas, zero, negativo ou número grande demais → `null` (a API só aceita valor positivo).
 */
export function centavosDaTela(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/i, '').trim();
  if (!t) return null;
  let inteiro: string;
  let decimal = '';
  const virgula = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(t);
  const ponto = /^(\d+)\.(\d{1,2})$/.exec(t);
  if (virgula) {
    inteiro = virgula[1].replace(/\./g, '');
    decimal = virgula[2] ?? '';
  } else if (ponto) {
    [, inteiro, decimal] = ponto;
  } else {
    return null;
  }
  if (inteiro.length > 10) return null;
  const centavos = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0') || '0');
  return Number.isSafeInteger(centavos) && centavos > 0 ? centavos : null;
}
