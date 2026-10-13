import type { ExercicioPlano, Serie } from '../api/tipos';
import { faixa, textoIntensidade } from './agrupamento';
import { numeroParaTela } from './formatos';

/**
 * Sugestão de carga do aluno. Só aplica o que o treinador escreveu no plano sobre a carga de
 * trabalho que o próprio aluno informa: nunca inventa carga nem repetição. Sugestão é só sugestão; o que o aluno
 * digita é gravado exatamente como digitou.
 */

export interface SerieCalculada {
  serie: Serie;
  /** Carga sugerida em kg; `null` quando não há base ou a série não é por carga. */
  sugestao: number | null;
  /** Texto da meta: "Meta: 3 a 6 reps · 50% da WS", "1 RIR", "50 min". */
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
export function metaDaSerie(s: Serie, tipoTrabalho: string, semCarga = false): string {
  const partes: string[] = [];
  const f = faixa(s);
  if (f) partes.push(`${f} reps`);
  if (s.alvoTexto) partes.push(s.alvoTexto);
  if (semCarga && (modo(s) === 'PERCENTUAL_WS' || modo(s) === 'CARGA_TRABALHO')) {
    // Exercício sem carga (elástico, peso corporal): não fala de kg nem de %.
  } else if (modo(s) === 'PERCENTUAL_WS' && s.intensidade?.percentual != null) {
    partes.push(`${numeroParaTela(s.intensidade.percentual)}% da ${tipoTrabalho}`);
  } else if (modo(s) === 'CARGA_TRABALHO') {
    partes.push('carga de trabalho');
  } else {
    const t = textoIntensidade(s.intensidade);
    if (t) partes.push(t);
  }
  return partes.length ? `Meta: ${partes.join(' · ')}` : 'Meta: —';
}

/**
 * @param cargaTrabalho base do dia que o aluno digitou (ou `null`).
 * @param cargasDoDia cargas já registradas hoje, por `serieUid` (para a referência das séries em %).
 */
export function calcularCargasDoExercicio(
  exercicio: ExercicioPlano,
  cargaTrabalho: number | null,
  cargasDoDia: Record<string, number | null | undefined>,
  config: { arredondamentoKg: number; tipoTrabalho: string },
): SerieCalculada[] {
  const semCarga = exercicio.unidade === 'nenhuma';
  const registradasTrabalho = exercicio.series
    .filter((s) => modo(s) === 'CARGA_TRABALHO')
    .map((s) => cargasDoDia[s.uid])
    .filter((c): c is number => typeof c === 'number');
  // Referência do %: maior carga já feita hoje nas séries de trabalho; sem nenhuma, a base do dia.
  const referencia = registradasTrabalho.length ? Math.max(...registradasTrabalho) : cargaTrabalho;

  return exercicio.series.map((serie) => {
    let sugestao: number | null = null;
    if (!semCarga) {
      if (modo(serie) === 'CARGA_TRABALHO') {
        sugestao = cargaTrabalho;
      } else if (modo(serie) === 'PERCENTUAL_WS' && serie.intensidade?.percentual != null && referencia != null) {
        sugestao = arredondar((referencia * serie.intensidade.percentual) / 100, config.arredondamentoKg);
      }
    }
    return { serie, sugestao, meta: metaDaSerie(serie, config.tipoTrabalho, semCarga) };
  });
}

/** O exercício usa a carga de trabalho do dia (tem série de trabalho ou em % dela)? */
export function usaCargaDeTrabalho(exercicio: ExercicioPlano): boolean {
  return (
    exercicio.unidade !== 'nenhuma' &&
    exercicio.series.some((s) => modo(s) === 'CARGA_TRABALHO' || modo(s) === 'PERCENTUAL_WS')
  );
}
