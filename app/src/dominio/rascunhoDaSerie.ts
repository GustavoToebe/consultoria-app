/**
 * Rascunho local da série: o que o aluno digitou (carga e repetições) ANTES de marcar o ✓. Vive só no aparelho, num
 * documento próprio do repositório local (`rascunhosDeSerie`), fora da fila de envio: nunca vira registro no servidor.
 * Só o ✓ cria o registro idempotente de sempre (`RepositorioLocal.registrar`), e é nesse momento que o rascunho da série
 * sai. O repositório já é separado por aluno (um banco ou prefixo por usuário), então o aluno não entra na chave.
 *
 * Regra pura: a leitura e a gravação no aparelho ficam em `offline/`. Carga e repetições são dado do aluno: nunca em log.
 */

export interface RascunhoDaSerie {
  carga: number | null;
  repeticoes: number | null;
  /** Dia (AAAA-MM-DD) da última digitação: o rascunho sai no dia seguinte (`podarRascunhos`). */
  dia: string;
}

/** Por `chaveDoRascunhoDaSerie`. */
export type RascunhosDeSerie = Record<string, RascunhoDaSerie>;

/** Quais valores mudaram; ausente = não mexeu. Os dois nulos apagam o rascunho. */
export type MudancaDoRascunho = { carga?: number | null; repeticoes?: number | null };

/** Onde a série vive: versão do plano, exercício (do plano e o do dia, se trocado), série e a data do treino. */
export interface ReferenciaDaSerie {
  planoVersaoId: string;
  exercicioUid: string;
  /** Exercício da biblioteca do dia: sem ele o peso digitado no principal passaria para a alternativa do "Trocar só hoje". */
  exercicioId: string | null;
  serieUid: string;
  data: string;
}

export const chaveDoRascunhoDaSerie = (r: ReferenciaDaSerie): string =>
  [r.data, r.planoVersaoId, r.exercicioUid, r.exercicioId ?? '', r.serieUid].join('|');

const numeroOuNulo = (v: unknown): number | null | undefined =>
  v === null ? null : typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;

/**
 * Aplica a mudança: junta ao que já havia, e com carga e repetições nulas o rascunho some. `mudanca` nulo apaga.
 * Devolve outro objeto (o estado da tela troca por identidade).
 */
export function aplicarRascunho(mapa: RascunhosDeSerie, chave: string, mudanca: MudancaDoRascunho | null, hoje: string): RascunhosDeSerie {
  const { [chave]: antes, ...resto } = mapa;
  if (!mudanca) return resto;
  const carga = 'carga' in mudanca ? (mudanca.carga ?? null) : (antes?.carga ?? null);
  const repeticoes = 'repeticoes' in mudanca ? (mudanca.repeticoes ?? null) : (antes?.repeticoes ?? null);
  return carga === null && repeticoes === null ? resto : { ...resto, [chave]: { carga, repeticoes, dia: hoje } };
}

/**
 * O que sobra ao ler do aparelho: o rascunho digitado em dia anterior a `hoje` sai (decisão do pedido: "limpo no dia
 * seguinte"), assim como entrada ilegível. Vale o dia da DIGITAÇÃO, não o da data do treino: quem abre um treino de
 * ontem e digita hoje não perde o que digitou.
 */
export function podarRascunhos(mapa: unknown, hoje: string): RascunhosDeSerie {
  if (!mapa || typeof mapa !== 'object') return {};
  const saida: RascunhosDeSerie = {};
  for (const [chave, r] of Object.entries(mapa as Record<string, Partial<RascunhoDaSerie> | null>)) {
    const carga = numeroOuNulo(r?.carga);
    const repeticoes = numeroOuNulo(r?.repeticoes);
    if (carga === undefined || repeticoes === undefined || (carga === null && repeticoes === null)) continue;
    if (typeof r?.dia !== 'string' || r.dia < hoje) continue;
    saida[chave] = { carga, repeticoes, dia: r.dia };
  }
  return saida;
}

/** O que a tela põe nos campos da série ainda não marcada; `null` = nada digitado. */
export function rascunhoDaSerie(mapa: RascunhosDeSerie, ref: ReferenciaDaSerie): Pick<RascunhoDaSerie, 'carga' | 'repeticoes'> | null {
  const r = mapa[chaveDoRascunhoDaSerie(ref)];
  return r ? { carga: r.carga, repeticoes: r.repeticoes } : null;
}
