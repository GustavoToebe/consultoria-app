import type { Configuracao, ExercicioPlano, Serie } from '../api/tipos';
import { textoDasRepeticoes, textoIntensidade, textoRir, textoTecnica } from './agrupamento';

/**
 * Sugestão de carga do aluno. Só aplica o que o treinador escreveu no plano sobre a carga de
 * trabalho que o próprio aluno informa: nunca inventa carga nem repetição. Sugestão é só sugestão; o que o aluno
 * digita é gravado exatamente como digitou.
 */

export interface SerieCalculada {
  serie: Serie;
  /** Carga sugerida em kg; `null` quando não há base ou a série não é por carga. */
  sugestao: number | null;
  /** Texto da meta: "Meta: 3 a 6 reps · 50% da WS", "— reps · 1 RIR". */
  meta: string;
}

/** Arredonda ao múltiplo mais próximo do passo (0,25 / 0,5 / 1 / 2,5 kg), sem erro de ponto flutuante. */
export function arredondar(valor: number, passo: number): number {
  if (!passo || passo <= 0) return valor;
  const n = Math.round(valor / passo);
  return Math.round(n * passo * 1000) / 1000;
}

const modo = (s: Serie) => s.intensidade?.modo ?? 'NENHUMA';

/** Texto da meta da série, como o aluno vê na tela. */
export function metaDaSerie(s: Serie, tipoTrabalho: string, semCarga = false, metodologia?: Configuracao): string {
  const partes: string[] = [];
  partes.push(`${textoDasRepeticoes(s)} reps`);
  if (semCarga && ['PERCENTUAL_WS', 'CARGA_TRABALHO', 'MESMA_CARGA', 'ACIMA_DA_ANTERIOR'].includes(modo(s))) {
    const rir = textoRir(s.intensidade);
    if (rir) partes.push(rir);
  } else if (modo(s) === 'CARGA_TRABALHO') {
    partes.push('carga de trabalho');
    const rir = textoRir(s.intensidade);
    if (rir) partes.push(rir);
  } else {
    const t = textoIntensidade(s.intensidade, tipoTrabalho);
    if (t) partes.push(t);
  }
  const tecnica = textoTecnica(s.tecnica, metodologia);
  if (tecnica) partes.push(tecnica);
  return `Meta: ${partes.join(' · ')}`;
}

/**
 * @param cargaTrabalho base do dia que o aluno digitou (ou `null`).
 * @param cargasDoDia cargas já registradas hoje, por `serieUid` (para a referência das séries em %).
 */
export function calcularCargasDoExercicio(
  exercicio: ExercicioPlano,
  cargaTrabalho: number | null,
  cargasDoDia: Record<string, number | null | undefined>,
  config: { arredondamentoKg: number; tipoTrabalho: string; metodologia?: Configuracao },
): SerieCalculada[] {
  const semCarga = exercicio.unidade === 'nenhuma';
  const registradasTrabalho = exercicio.series
    .filter((s) => modo(s) === 'CARGA_TRABALHO')
    .map((s) => cargasDoDia[s.uid])
    .filter((c): c is number => typeof c === 'number');
  // Referência da WS: última série de trabalho com carga registrada hoje, na ordem do exercício.
  const referencia = registradasTrabalho.at(-1) ?? cargaTrabalho;

  return exercicio.series.map((serie, indice) => {
    let sugestao: number | null = null;
    if (!semCarga) {
      if (modo(serie) === 'CARGA_TRABALHO') {
        sugestao = cargaTrabalho;
      } else if (modo(serie) === 'MESMA_CARGA') {
        sugestao = referencia;
      } else if (modo(serie) === 'PERCENTUAL_WS' && serie.intensidade?.percentualMin != null && referencia != null) {
        sugestao = arredondar((referencia * serie.intensidade.percentualMin) / 100, config.arredondamentoKg);
      } else if (modo(serie) === 'ACIMA_DA_ANTERIOR' && serie.intensidade?.percentualMin != null && indice > 0) {
        const anterior = cargasDoDia[exercicio.series[indice - 1].uid];
        if (anterior != null) sugestao = arredondar(anterior * (1 + serie.intensidade.percentualMin / 100), config.arredondamentoKg);
      }
    }
    return { serie, sugestao, meta: metaDaSerie(serie, config.tipoTrabalho, semCarga, config.metodologia) };
  });
}

/** O exercício usa a carga de trabalho do dia (tem série de trabalho ou em % dela)? */
export function usaCargaDeTrabalho(exercicio: ExercicioPlano): boolean {
  return (
    exercicio.unidade !== 'nenhuma' &&
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
