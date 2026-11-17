/**
 * Antecedência dos lembretes do compromisso no formulário do treinador (`docs/planos/lembretes-do-compromisso.md`, D1, D2 e
 * D4): cada notificação é um número e uma unidade (minutos, horas, dias), como no Google Agenda, e a API guarda só os
 * minutos (`lembretesMinutos`, 0 a 5 itens de 1 a 40320, sem repetir; lista vazia = sem lembrete). Regra pura: a tela só
 * mostra. A ordem é a digitada (a API não reordena e o `lembretesMinutos[i]` do 422 aponta a linha `i` enviada).
 */

export type UnidadeDaAntecedencia = 'MINUTOS' | 'HORAS' | 'DIAS';

/** Uma linha do formulário: `id` estável (a `key` da linha), o número como foi digitado e a unidade. */
export interface LinhaDeLembrete {
  id: string;
  valor: string;
  unidade: UnidadeDaAntecedencia;
}

export const LEMBRETES_MAXIMO = 5;
export const ANTECEDENCIA_MINIMA = 1;
/** 28 dias. */
export const ANTECEDENCIA_MAXIMA = 40320;
export const LEMBRETES_PADRAO: readonly number[] = [30];

export const MINUTOS_DA_UNIDADE: Record<UnidadeDaAntecedencia, number> = { MINUTOS: 1, HORAS: 60, DIAS: 1440 };
/** Dígitos do campo: 40320 tem cinco. */
export const DIGITOS_DA_ANTECEDENCIA = 5;

/** Sugestões ao adicionar, na ordem: a primeira que ainda não está na lista. Seis valores para cinco linhas, então sempre sobra uma. */
const SUGESTOES = [10, 30, 60, 120, 1440, 2880];

const ERRO_VAZIO = 'Informe a antecedência.';
const ERRO_FAIXA = 'De 1 minuto a 28 dias antes.';
const ERRO_REPETIDA = 'Igual a outra notificação. Mude ou remova esta.';
export const MOTIVO_SEM_ADICIONAR = `Máximo de ${LEMBRETES_MAXIMO} notificações.`;

/** Só dígitos, até cinco (o campo numérico). */
export function mascaraDaAntecedencia(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, DIGITOS_DA_ANTECEDENCIA);
}

/** Minutos para a tela: a maior unidade que divide exato (1440 → 1 dia, 120 → 2 horas, 90 → 90 minutos). */
export function antecedenciaParaTela(minutos: number): { valor: string; unidade: UnidadeDaAntecedencia } {
  const unidade: UnidadeDaAntecedencia = minutos > 0 && minutos % 1440 === 0 ? 'DIAS' : minutos > 0 && minutos % 60 === 0 ? 'HORAS' : 'MINUTOS';
  return { valor: String(minutos / MINUTOS_DA_UNIDADE[unidade]), unidade };
}

/** A linha em minutos; `null` quando o campo não é um número inteiro (vazio ou com outro caractere). */
export function minutosDaLinha(l: Pick<LinhaDeLembrete, 'valor' | 'unidade'>): number | null {
  const texto = l.valor.trim();
  if (!/^\d+$/.test(texto)) return null;
  return Number(texto) * MINUTOS_DA_UNIDADE[l.unidade];
}

/** Rótulo da unidade concordando com o número ("1 minuto", "2 minutos"). */
export function rotuloDaUnidade(unidade: UnidadeDaAntecedencia, valor: string): string {
  const um = valor.trim() === '1';
  if (unidade === 'MINUTOS') return um ? 'minuto' : 'minutos';
  if (unidade === 'HORAS') return um ? 'hora' : 'horas';
  return um ? 'dia' : 'dias';
}

export const UNIDADES: readonly UnidadeDaAntecedencia[] = ['MINUTOS', 'HORAS', 'DIAS'];

const proximoId = (lista: readonly LinhaDeLembrete[]) =>
  `n${lista.reduce((maior, l) => Math.max(maior, Number(l.id.slice(1)) || 0), 0) + 1}`;

/** As linhas de uma lista em minutos (a do compromisso gravado ou o padrão), na mesma ordem. */
export function linhasDosMinutos(minutos: readonly number[]): LinhaDeLembrete[] {
  return minutos.map((m, i) => ({ id: `n${i + 1}`, ...antecedenciaParaTela(m) }));
}

/** Por que não dá para adicionar outra; `null` = dá. */
export function motivoSemAdicionar(lista: readonly LinhaDeLembrete[]): string | null {
  return lista.length >= LEMBRETES_MAXIMO ? MOTIVO_SEM_ADICIONAR : null;
}

/** Acrescenta uma linha com a primeira sugestão livre (10 min, 30 min, 1 h, 2 h, 1 dia, 2 dias); no máximo, não muda. */
export function adicionarLembrete(lista: readonly LinhaDeLembrete[]): LinhaDeLembrete[] {
  if (motivoSemAdicionar(lista)) return [...lista];
  const usados = new Set(lista.map(minutosDaLinha));
  const minutos = SUGESTOES.find((s) => !usados.has(s)) ?? SUGESTOES[0];
  return [...lista, { id: proximoId(lista), ...antecedenciaParaTela(minutos) }];
}

export function removerLembrete(lista: readonly LinhaDeLembrete[], id: string): LinhaDeLembrete[] {
  return lista.filter((l) => l.id !== id);
}

/** Muda o número ou a unidade de uma linha. Trocar a unidade mantém o número, como no Google ("29 minutos" → "29 dias"). */
export function mudarLembrete(lista: readonly LinhaDeLembrete[], id: string, mudanca: Partial<Pick<LinhaDeLembrete, 'valor' | 'unidade'>>): LinhaDeLembrete[] {
  return lista.map((l) => (l.id === id
    ? { ...l, ...mudanca, ...(mudanca.valor === undefined ? {} : { valor: mascaraDaAntecedencia(mudanca.valor) }) } : l));
}

/** A lista é a padrão (uma de 30 minutos)? Para dizer no painel rápido que as notificações mudaram. */
export function lembretesSaoOPadrao(lista: readonly LinhaDeLembrete[]): boolean {
  return lista.length === LEMBRETES_PADRAO.length && lista.every((l, i) => minutosDaLinha(l) === LEMBRETES_PADRAO[i]);
}

export interface ConferenciaDosLembretes {
  /** Erro de cada linha, pelo `id`. */
  porLinha: Record<string, string>;
  /** Erro da lista inteira (mais de cinco). */
  lista?: string;
  /** Os minutos na ordem da tela; `null` com qualquer erro. */
  minutos: number[] | null;
}

/**
 * Confere as linhas com a regra da API: vazia, fora de 1 a 40320 minutos (depois de converter a unidade: 28 dias vale,
 * 29 não) ou repetida (a mesma quantidade em minutos: 60 minutos = 1 hora; o erro fica na que vem depois). A mensagem
 * nunca repete o valor (D2).
 */
export function conferirLembretes(lista: readonly LinhaDeLembrete[]): ConferenciaDosLembretes {
  const porLinha: Record<string, string> = {};
  const vistos = new Set<number>();
  const minutos: number[] = [];
  for (const l of lista) {
    const m = minutosDaLinha(l);
    if (m === null) porLinha[l.id] = l.valor.trim() ? ERRO_FAIXA : ERRO_VAZIO;
    else if (m < ANTECEDENCIA_MINIMA || m > ANTECEDENCIA_MAXIMA) porLinha[l.id] = ERRO_FAIXA;
    else if (vistos.has(m)) porLinha[l.id] = ERRO_REPETIDA;
    else { vistos.add(m); minutos.push(m); }
  }
  const erroDaLista = lista.length > LEMBRETES_MAXIMO ? `Até ${LEMBRETES_MAXIMO} notificações.` : undefined;
  const ok = !erroDaLista && Object.keys(porLinha).length === 0;
  return { porLinha, ...(erroDaLista ? { lista: erroDaLista } : {}), minutos: ok ? minutos : null };
}

/**
 * Os erros do 422 `COMPROMISSO_INVALIDO` nos lembretes (`fieldErrors` já por campo): `lembretesMinutos[i]` vai para a
 * linha `i` da lista enviada e `lembretesMinutos`, para a lista. Vazio quando a API não apontou os lembretes.
 */
export function errosDosLembretesDaApi(campos: Readonly<Record<string, string>>, enviadas: readonly LinhaDeLembrete[]):
  { porLinha: Record<string, string>; lista?: string } {
  const porLinha: Record<string, string> = {};
  let lista = campos.lembretesMinutos;
  for (const [campo, mensagem] of Object.entries(campos)) {
    const m = /^lembretesMinutos\[(\d+)\]$/.exec(campo);
    if (!m) continue;
    const linha = enviadas[Number(m[1])];
    // Índice que a tela não tem mais: a mensagem não se perde, vai para a lista.
    if (linha) porLinha[linha.id] = mensagem;
    else lista ??= mensagem;
  }
  return { porLinha, ...(lista ? { lista } : {}) };
}
