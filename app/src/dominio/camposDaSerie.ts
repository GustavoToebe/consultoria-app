import type { AlternativaDeExercicio, ExercicioPlano, PapelDaSerie, Serie } from '../api/tipos';
import type { GrupoDeSeries } from './agrupamento';
import { alterarPercentuais, alterarRirDaSerie, cargaDoModo, DESCANSO_MAXIMO_SEGUNDOS } from './editorTreino';

/**
 * Regras dos campos da série aberta no editor (27/11): as listas "Digite ou escolha" de Séries e Descanso (o que
 * oferecem, como leem o digitado, como escrevem o valor), a dica de uma linha das repetições, o "Mesmo valor para todas"
 * da carga e do RIR e os resumos das seções recolhidas do exercício. Sem React.
 */

export interface OpcaoDaLista<T> { valor: T; rotulo: string }

// ---- Séries ----

/** Até quantas séries o grupo pode ter: o que sobra do limite do exercício depois dos outros grupos. */
export function maximoDeSeriesNoGrupo(totalNoExercicio: number, noGrupo: number, limite: number): number {
  return Math.max(1, limite - (totalNoExercicio - noGrupo));
}

/** De 1 a 10 (ou até o máximo) e, se o atual passa de 10, ele também: o botão nunca mostra "—". */
export function opcoesDeQuantidade(atual: number, maximo: number): OpcaoDaLista<number>[] {
  const ate = Math.min(10, maximo);
  const lista = Array.from({ length: ate }, (_, i) => i + 1);
  if (atual > ate) lista.push(atual);
  return lista.map((n) => ({ valor: n, rotulo: String(n) }));
}

/** "4" → 4; fora de 1 a `maximo`, decimal ou texto → nulo (a lista não oferece nada). */
export function lerQuantidade(texto: string, maximo: number): number | null {
  const t = texto.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= maximo ? n : null;
}

// ---- Descanso ----

/** As opções prontas do descanso da série, em segundos. */
export const DESCANSOS_DA_SERIE = [45, 60, 90, 120, 180];

/** Formato curto: até 119 s em segundos ("90 s"); minuto redondo em minutos ("2 min"); o resto "2 min 30 s". */
export function textoCurtoDoDescanso(segundos: number): string {
  if (segundos < 120) return `${segundos} s`;
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return seg === 0 ? `${min} min` : `${min} min ${seg} s`;
}

/** As opções prontas e, se o gravado não é uma delas, ele também (na ordem). */
export function opcoesDoDescanso(atual: number | null | undefined): OpcaoDaLista<number>[] {
  const lista = atual != null && !DESCANSOS_DA_SERIE.includes(atual) ? [...DESCANSOS_DA_SERIE, atual].sort((a, b) => a - b) : DESCANSOS_DA_SERIE;
  return lista.map((s) => ({ valor: s, rotulo: textoCurtoDoDescanso(s) }));
}

/**
 * O descanso digitado em segundos, tolerante: "75", "75 s", "1:30", "2 min", "2min", "1 min 30", "1 min 30 s". De 0 a
 * 3600 (o limite do contrato); fora disso ou sem forma conhecida, nulo.
 */
export function lerDescanso(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;
  let segundos: number | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,4}) ?(s|seg|segundos?)?$/.exec(t))) segundos = Number(m[1]);
  else if ((m = /^(\d{1,2}):([0-5]\d)$/.exec(t))) segundos = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = /^(\d{1,2}) ?min(utos?)?(?: ?(\d{1,2}) ?(s|seg|segundos?)?)?$/.exec(t))) segundos = Number(m[1]) * 60 + (m[3] ? Number(m[3]) : 0);
  return segundos != null && segundos <= DESCANSO_MAXIMO_SEGUNDOS ? segundos : null;
}

// ---- Repetições ----

export type FormaDaDica = 'EXATA' | 'FAIXA' | 'AMRAP';

export const DICA_DO_AMRAP = 'O aluno faz o máximo que conseguir e anota quantas fez.';
export const DICA_POR_TEMPO = 'Sem repetições: o aluno lê a série por tempo.';

/**
 * A dica de uma linha embaixo das repetições. Tabela (27/11): AMRAP → a explicação; tudo vazio e a série vale por tempo
 * (`porTempo`, a série; a retomada não) → "Sem repetições…"; faixa com um dos dois vazio (ou tudo vazio sem tempo) →
 * "Preencha mín. e máx."; exata vazia sem tempo → "Informe as repetições"; completo → nada. O erro vermelho, quando há,
 * toma o lugar da dica (quem desenha decide).
 */
export function dicaDasRepeticoes(forma: FormaDaDica, r: { repsMin?: number | null; repsMax?: number | null }, porTempo: boolean): string | null {
  if (forma === 'AMRAP') return DICA_DO_AMRAP;
  const min = r.repsMin ?? null;
  const max = r.repsMax ?? null;
  if (min == null && max == null && porTempo) return DICA_POR_TEMPO;
  if (forma === 'FAIXA') return min == null || max == null ? 'Preencha mín. e máx.' : null;
  return min == null && max == null ? 'Informe as repetições' : null;
}

// ---- Carga e RIR: "Mesmo valor para todas" ----

/** Todas as séries do grupo com o mesmo % (mín e máx) e o mesmo esforço: a opção nasce ligada. Uma série só, também. */
export function cargaERirIguais(g: GrupoDeSeries): boolean {
  const chave = (s: Serie) => JSON.stringify([s.carga?.percentualMin ?? null, s.carga?.percentualMax ?? null, s.esforco?.rir ?? null, s.esforco?.rpe ?? null]);
  return g.series.every((s) => chave(s) === chave(g.series[0]));
}

/** O mesmo % em todas as séries do grupo; no Aquecimento, mín e máx em branco = sem sugestão (`NENHUMA`) em todas. */
export function percentuaisEmTodas(series: Serie[], g: GrupoDeSeries, min: number | null, max: number | null, papel: PapelDaSerie | null | undefined): Serie[] {
  let novas = series;
  for (let j = 0; j < g.series.length; j++) {
    const i = g.inicio + j;
    novas = papel === 'AQUECIMENTO' && min == null && max == null
      ? novas.map((s, k) => (k === i ? { ...s, carga: cargaDoModo('NENHUMA') } : s))
      : alterarPercentuais(novas, i, min, max);
  }
  return novas;
}

/** O mesmo RIR em todas as séries do grupo. */
export function rirEmTodas(series: Serie[], g: GrupoDeSeries, rir: number | null): Serie[] {
  let novas = series;
  for (let j = 0; j < g.series.length; j++) novas = alterarRirDaSerie(novas, g.inicio + j, rir);
  return novas;
}

/** O mesmo RPE em todas as séries do grupo (nulo apaga o esforço). */
export function rpeEmTodas(series: Serie[], g: GrupoDeSeries, rpe: number | null): Serie[] {
  const fim = g.inicio + g.series.length;
  return series.map((s, k) => (k >= g.inicio && k < fim ? { ...s, esforco: rpe == null ? null : { rir: null, rpe } } : s));
}

// ---- Resumos das seções recolhidas do exercício ----

/** "Agachamento livre · sem vídeo · cadência 3-1-1-0": nome, vídeo e, se houver, cadência, isometria e observação. */
export function resumoDosExtras(e: Pick<ExercicioPlano, 'nome' | 'videoUrl' | 'cadencia' | 'isometriaSegundos' | 'observacao'>): string {
  return [
    e.nome.trim() || 'Sem nome de exibição',
    e.videoUrl ? 'com vídeo' : 'sem vídeo',
    e.cadencia ? `cadência ${e.cadencia}` : null,
    e.isometriaSegundos != null ? `isometria ${e.isometriaSegundos} s` : null,
    e.observacao?.trim() ? 'com observação' : null,
  ].filter(Boolean).join(' · ');
}

/** "Nenhuma alternativa" ou os nomes, separados por vírgula. */
export function resumoDasAlternativas(lista: readonly AlternativaDeExercicio[] | null | undefined): string {
  return lista?.length ? lista.map((a) => a.nome || 'Alternativa sem nome').join(', ') : 'Nenhuma alternativa';
}
