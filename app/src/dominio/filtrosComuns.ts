import { dataParaTela } from './formatos';

/**
 * Peças comuns dos filtros das listas (`docs/planos/filtros-nas-listas.md`): ler o endereço sem confiar nele (valor
 * desconhecido é ignorado, nunca vai para a API), o período De/Até e o texto dos chips. Funções puras; cada tela tem o
 * seu `filtrosDe<Tela>.ts` com o que é dela.
 */
export type Parametro = string | string[] | undefined;

/** Os valores de um parâmetro: repetido (`?a=1&a=2`) ou numa vírgula só (`?a=1,2`), sem vazios. */
export function lista(valor: Parametro): string[] {
  const partes = (Array.isArray(valor) ? valor : valor ? [valor] : []).flatMap((v) => v.split(','));
  return partes.map((v) => v.trim()).filter(Boolean);
}

/** Só os valores conhecidos (sem diferença de caixa), sem repetir, na ordem do endereço. */
export function validos<T extends string>(valor: Parametro, opcoes: readonly { valor: T }[]): T[] {
  const porChave = new Map(opcoes.map((o) => [o.valor.toUpperCase(), o.valor]));
  const achados = lista(valor).map((v) => porChave.get(v.toUpperCase())).filter((v): v is T => v !== undefined);
  return [...new Set(achados)];
}

/** O primeiro valor conhecido, ou `null`. */
export function um<T extends string>(valor: Parametro, opcoes: readonly { valor: T }[]): T | null {
  return validos(valor, opcoes)[0] ?? null;
}

/** Id de membro, aluno etc. no endereço (UUID ou parecido); o resto é ignorado. */
export const ehId = (v: string) => /^[0-9a-z-]{8,64}$/i.test(v);

/** O primeiro id do parâmetro, ou `null`. */
export function umId(valor: Parametro): string | null {
  return lista(valor).find(ehId) ?? null;
}

/** `AAAA-MM-DD` de verdade (31/02 não), ou `null`. */
export function dataIso(valor: Parametro): string | null {
  const v = lista(valor)[0];
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [a, m, d] = v.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d ? v : null;
}

export interface Periodo {
  de: string | null;
  ate: string | null;
}

export const SEM_PERIODO: Periodo = { de: null, ate: null };

/**
 * Período do endereço. Data inválida é ignorada; fim antes do início = sem período (a API recusaria). Com `osDois`, só
 * vale com as duas datas (a rota de atualizações só aceita o par); com `maximoDias`, mais longo que isso = sem período.
 */
export function periodoDoEndereco(de: Parametro, ate: Parametro, osDois = false, maximoDias?: number): Periodo {
  const p = { de: dataIso(de), ate: dataIso(ate) };
  if (p.de && p.ate && p.ate < p.de) return SEM_PERIODO;
  if (osDois && (!p.de || !p.ate)) return SEM_PERIODO;
  if (maximoDias && p.de && p.ate && diasDoPeriodo({ de: p.de, ate: p.ate }) > maximoDias) return SEM_PERIODO;
  return p;
}

export const temPeriodo = (p: Periodo) => !!(p.de || p.ate);

/** "01/10/2026 a 31/10/2026", "a partir de 01/10/2026" ou "até 31/10/2026"; vazio sem período. */
export function textoDoPeriodo(p: Periodo): string {
  if (p.de && p.ate) return p.de === p.ate ? dataParaTela(p.de) : `${dataParaTela(p.de)} a ${dataParaTela(p.ate)}`;
  if (p.de) return `a partir de ${dataParaTela(p.de)}`;
  if (p.ate) return `até ${dataParaTela(p.ate)}`;
  return '';
}

/** Parâmetros do endereço do período (`de`/`ate` só quando preenchidos). */
export function periodoParaEndereco(p: Periodo): Record<string, string> {
  return { ...(p.de ? { de: p.de } : {}), ...(p.ate ? { ate: p.ate } : {}) };
}

/**
 * O que o par de campos De/Até digitado vira: o período (para aplicar) ou o porquê de não aplicar. Vazio = sem data;
 * data pela metade ou impossível não aplica (o filtro em vigor fica até os dois campos fazerem sentido).
 */
export function periodoDigitado(de: string | null | undefined, ate: string | null | undefined, osDois = false, maximoDias?: number):
  { periodo: Periodo } | { problema: 'data' | 'ordem' | 'par' | 'longo' } {
  if (de === undefined || ate === undefined) return { problema: 'data' };
  if (de && ate && ate < de) return { problema: 'ordem' };
  if (osDois && !!de !== !!ate) return { problema: 'par' };
  if (maximoDias && de && ate && diasDoPeriodo({ de, ate }) > maximoDias) return { problema: 'longo' };
  return { periodo: { de, ate } };
}

/** Quantos dias o período cobre, com as duas pontas (01/10 a 01/10 = 1). */
export function diasDoPeriodo(p: { de: string; ate: string }): number {
  return Math.round((Date.parse(`${p.ate}T00:00:00Z`) - Date.parse(`${p.de}T00:00:00Z`)) / 86_400_000) + 1;
}

/** Texto curto de várias opções marcadas ("Ativos, Inativos"), na ordem das opções. */
export function rotulos<T extends string>(valores: readonly T[], opcoes: readonly { valor: T; rotulo: string }[]): string {
  return opcoes.filter((o) => valores.includes(o.valor)).map((o) => o.rotulo).join(', ');
}

/** Tira do conjunto o que não está nas opções (filtro de várias opções vindo de um seletor). */
export function naOrdem<T extends string>(marcados: ReadonlySet<string>, opcoes: readonly { valor: T }[]): T[] {
  return opcoes.map((o) => o.valor).filter((v) => marcados.has(v));
}

/** Sem acento e em minúsculas, para a busca local. */
export function paraBusca(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Todas as chaves do endereço que a tela usa, `undefined` nas que saíram (o `router.setParams` junta com as de antes). */
export function paraSetParams(chaves: readonly string[], params: Record<string, string>): Record<string, string | undefined> {
  return Object.fromEntries(chaves.map((k) => [k, params[k]]));
}
