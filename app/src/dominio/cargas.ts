import type { Configuracao, ExercicioPlano, OrigemDaReferencia, Serie } from '../api/tipos';
import { nomeDaReferencia, textoCardio, textoCarga, textoDasRepeticoes, textoEsforco, textoTecnica } from './agrupamento';

/**
 * Sugestão de carga do aluno. Só aplica o que o treinador escreveu no plano sobre a carga de
 * trabalho que o próprio aluno informa e sobre o que ele já registrou hoje: nunca inventa carga nem repetição.
 * Sugestão é só sugestão; o que o aluno digita é gravado exatamente como digitou.
 *
 * Série de trabalho = `carga.modo === 'CARGA_TRABALHO'` (espelho de `Serie.deTrabalho()` da API). O rótulo
 * `tipoTrabalho` ("WS") só aparece nos textos; nunca se compara com `Serie.tipo`, que é código.
 */

export interface SerieCalculada {
  serie: Serie;
  /** Carga sugerida em kg; `null` quando não há base ou a série não é por carga. */
  sugestao: number | null;
  /** A referência externa usada (WS anterior ou base do dia); `null` nos modos que não têm (ver `referenciaDaSerie`). */
  referencia: ReferenciaDaCarga | null;
  /** Texto da meta: "Meta: 3 a 6 reps · 50% da WS", "Meta: AMRAP reps · 1 RIR". */
  meta: string;
}

/**
 * Arredonda ao múltiplo do passo (0,25 / 0,5 / 1 / 2,5 kg), sem erro de ponto flutuante: ao mais próximo, ou para cima
 * ou para baixo quando a sugestão precisa ficar de um lado da carga de origem ("acima da anterior" nunca sugere a mesma).
 */
export function arredondar(valor: number, passo: number, sentido: 'proximo' | 'cima' | 'baixo' = 'proximo'): number {
  if (!passo || passo <= 0) return valor;
  const q = Math.round((valor / passo) * 1e6) / 1e6;
  const n = sentido === 'cima' ? Math.ceil(q) : sentido === 'baixo' ? Math.floor(q) : Math.round(q);
  return Math.round(n * passo * 1000) / 1000;
}

const modo = (s: Serie) => s.carga?.modo ?? 'NENHUMA';

/** Série de trabalho: a referência da carga do dia. */
export const ehSerieDeTrabalho = (s: Serie): boolean => modo(s) === 'CARGA_TRABALHO';

/**
 * Texto da meta da série, como o aluno vê na tela. `series` (as do exercício) dá o nome da série de referência do back off;
 * série de cardio mostra a prescrição de cardio.
 */
export function metaDaSerie(s: Serie, tipoTrabalho: string, semCarga = false, metodologia?: Configuracao, series: readonly Serie[] = []): string {
  if (s.cardio) return `Meta: ${textoCardio(s.cardio)}`;
  const partes: string[] = [];
  partes.push(s.amrap ? 'AMRAP' : `${textoDasRepeticoes(s)} reps`);
  const esforco = textoEsforco(s.esforco);
  if (!semCarga && modo(s) === 'CARGA_TRABALHO') {
    partes.push('carga de trabalho');
  } else if (!semCarga) {
    const carga = textoCarga(s.carga, tipoTrabalho, nomeDaReferencia(s, series, metodologia));
    if (carga) partes.push(carga);
  }
  if (esforco) partes.push(esforco);
  const tecnica = textoTecnica(s.tecnica, metodologia);
  if (tecnica) partes.push(tecnica);
  const alvo = s.alvoExtra?.trim();
  if (alvo) partes.push(alvo);
  return `Meta: ${partes.join(' · ')}`;
}

export interface ReferenciaDaCarga {
  valor: number;
  origem: OrigemDaReferencia;
}

/**
 * Referência do "% da WS" e da "mesma carga" da série `indice`: a carga registrada hoje na última série de trabalho
 * ANTERIOR a ela no exercício; sem ela (a FS vem antes da WS, ou a WS ainda não foi feita), a carga de trabalho do dia.
 */
function referenciaDaWs(series: readonly Serie[], indice: number, cargaTrabalho: number | null, cargasDoDia: Record<string, number | null | undefined>): ReferenciaDaCarga | null {
  for (let i = indice - 1; i >= 0; i--) {
    if (!ehSerieDeTrabalho(series[i])) continue;
    const registrada = cargasDoDia[series[i].uid];
    if (typeof registrada === 'number') return { valor: registrada, origem: 'WS_ANTERIOR' };
  }
  return cargaTrabalho == null ? null : { valor: cargaTrabalho, origem: 'BASE_DO_DIA' };
}

/**
 * A referência externa da série, a que as etapas congelam ao registrar a primeira (docs/series-etapas.md): carga de
 * trabalho = a base do dia; "% da WS" e "mesma carga" = a referência da WS. Os modos que dependem de outra série do dia
 * ("acima da anterior", "abaixo da referência") e "sem carga" não têm referência externa.
 */
export function referenciaDaSerie(series: readonly Serie[], indice: number, cargaTrabalho: number | null, cargasDoDia: Record<string, number | null | undefined>): ReferenciaDaCarga | null {
  const s = series[indice];
  if (!s || s.cardio) return null;
  switch (modo(s)) {
    case 'CARGA_TRABALHO':
      return cargaTrabalho == null ? null : { valor: cargaTrabalho, origem: 'BASE_DO_DIA' };
    case 'PERCENTUAL_WS':
    case 'MESMA_CARGA':
      return referenciaDaWs(series, indice, cargaTrabalho, cargasDoDia);
    default:
      return null;
  }
}

/** Sugestão da série sobre uma referência externa (a calculada agora ou a congelada nas etapas). */
export function sugestaoSobreReferencia(s: Serie, referencia: number | null, passo: number): number | null {
  if (referencia == null) return null;
  switch (modo(s)) {
    case 'CARGA_TRABALHO':
    case 'MESMA_CARGA':
      return referencia;
    case 'PERCENTUAL_WS': {
      const percentual = s.carga?.percentualMin ?? null;
      return percentual == null ? null : arredondar((referencia * percentual) / 100, passo);
    }
    default:
      return null;
  }
}

/**
 * @param cargaTrabalho base do dia que o aluno digitou (ou `null`).
 * @param cargasDoDia cargas já registradas hoje, por `serieUid` (para a referência das séries em %).
 *
 * Por forma de carga: `CARGA_TRABALHO` = a carga de trabalho do dia; `PERCENTUAL_WS` = % da referência da WS (acima);
 * `MESMA_CARGA` = a própria referência da WS; `ACIMA_DA_ANTERIOR` = a série imediatamente anterior mais o percentual;
 * `ABAIXO_DA_REFERENCIA` = a carga registrada hoje na série `referenciaUid` (anterior no exercício) menos o percentual,
 * e sem registro dela não há sugestão; `NENHUMA` = nada. Em faixa ("85 a 90%", "1 a 5%") vale o percentual MÍNIMO.
 * Resultado arredondado pelo passo da metodologia (exceto carga de trabalho e mesma carga, que repetem o número).
 */
export function calcularCargasDoExercicio(
  exercicio: ExercicioPlano,
  cargaTrabalho: number | null,
  cargasDoDia: Record<string, number | null | undefined>,
  config: { arredondamentoKg: number; tipoTrabalho: string; metodologia?: Configuracao },
): SerieCalculada[] {
  const semCarga = exercicio.unidade === 'nenhuma';
  const series = exercicio.series;

  return series.map((serie, indice) => {
    let sugestao: number | null = null;
    const carga = serie.carga;
    const percentual = carga?.percentualMin ?? null;
    const referencia = semCarga ? null : referenciaDaSerie(series, indice, cargaTrabalho, cargasDoDia);
    if (!semCarga && !serie.cardio) {
      switch (modo(serie)) {
        case 'CARGA_TRABALHO':
        case 'MESMA_CARGA':
        case 'PERCENTUAL_WS':
          sugestao = sugestaoSobreReferencia(serie, referencia?.valor ?? null, config.arredondamentoKg);
          break;
        case 'ACIMA_DA_ANTERIOR': {
          const anterior = indice > 0 ? cargasDoDia[series[indice - 1].uid] : null;
          if (percentual != null && typeof anterior === 'number') sugestao = arredondar(anterior * (1 + percentual / 100), config.arredondamentoKg, 'cima');
          break;
        }
        case 'ABAIXO_DA_REFERENCIA': {
          const posicao = carga?.referenciaUid ? series.findIndex((x) => x.uid === carga.referenciaUid) : -1;
          const registrada = posicao >= 0 && posicao < indice ? cargasDoDia[series[posicao].uid] : null;
          if (percentual != null && typeof registrada === 'number') sugestao = Math.max(0, arredondar(registrada * (1 - percentual / 100), config.arredondamentoKg, 'baixo'));
          break;
        }
        default:
          break;
      }
    }
    return { serie, sugestao, referencia, meta: metaDaSerie(serie, config.tipoTrabalho, semCarga, config.metodologia, series) };
  });
}

/** O exercício usa a carga de trabalho do dia (tem série de trabalho ou em % dela)? */
export function usaCargaDeTrabalho(exercicio: ExercicioPlano): boolean {
  return (
    exercicio.unidade !== 'nenhuma' &&
    !exercicio.series.some((s) => s.cardio) &&
    exercicio.series.some((s) => ['CARGA_TRABALHO', 'PERCENTUAL_WS', 'MESMA_CARGA'].includes(modo(s)))
  );
}

/**
 * Botões "+" e "−" da carga: andam de passo em passo do arredondamento da metodologia (a mesma fonte da sugestão).
 * Sem botões quando o exercício não usa carga ou o passo não é positivo. Nunca abaixo de 0; sem número digitado, parte
 * da sugestão e, sem ela, do 0.
 */
export function passoDaCarga(exercicio: Pick<ExercicioPlano, 'unidade'>, arredondamentoKg: number): number | null {
  if (exercicio.unidade === 'nenhuma') return null;
  return Number.isFinite(arredondamentoKg) && arredondamentoKg > 0 ? arredondamentoKg : null;
}

export function ajustarCarga(atual: number | null, sugestao: number | null, passo: number, sentido: 1 | -1): number {
  const base = atual ?? sugestao ?? 0;
  return Math.max(0, Math.round((base + sentido * passo) * 1000) / 1000);
}
