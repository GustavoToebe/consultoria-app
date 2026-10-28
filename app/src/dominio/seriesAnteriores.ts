import type { AnteriorDoExercicio, AnterioresDoPacote, EtapaRegistrada, ExercicioPlano, SerieAnterior } from '../api/tipos';
import { dataCurta, numeroParaTela } from './formatos';

/**
 * Coluna "Anterior" do treino ao vivo (frente Engajamento, passo 0.3): o que o aluno fez na mesma série da última vez
 * ("60 kg × 8"). Espelho de `api/.../anteriores/SeriesAnteriores.java` (mudou uma, mude a outra):
 * - "última vez" = a data mais recente, antes do dia na tela, com série feita do exercício; nela, com o exercício em mais
 *   de uma linha do plano, vale a primeira na ordem do plano;
 * - "a mesma série" = mesmo código de tipo e mesma ordem dentro dele no exercício (a 2ª WS com a 2ª WS), então funciona
 *   depois de o plano mudar de versão ou de pasta; série que não casa mostra "—"; cardio não tem coluna;
 * - nada é estimado: carga e repetições como foram registradas.
 *
 * O pacote traz a última vez antes de `anteriores.ate` (sem internet). O app usa também o que conhece da versão em uso
 * (aparelho e servidor) e fica com o mais recente.
 */

/** Código do tipo e ordem dentro dele de cada série do exercício (na ordem do plano); cardio ou série sem tipo = `null`. */
export function posicoesNoTipo(e: Pick<ExercicioPlano, 'modalidade' | 'series'>): ({ tipo: string; ordem: number } | null)[] {
  const contagem = new Map<string, number>();
  return e.series.map((s) => {
    if (e.modalidade === 'CARDIO' || s.cardio || !s.tipo) return null;
    const ordem = (contagem.get(s.tipo) ?? 0) + 1;
    contagem.set(s.tipo, ordem);
    return { tipo: s.tipo, ordem };
  });
}

/** O pedaço do registro (aparelho ou servidor) que a regra usa. */
export interface RegistroParaAnterior {
  planoVersaoId: string;
  exercicioUid: string;
  serieUid: string;
  exercicioId: string | null;
  data: string;
  carga: number | null;
  repeticoes: number | null;
  concluida: boolean;
  etapas: EtapaRegistrada[] | null;
}

export interface EntradaDaUltimaVez {
  /** Do pacote; ausente com "Concluir treino" desligado (então não há coluna). */
  anteriores: AnterioresDoPacote | null | undefined;
  exercicio: ExercicioPlano;
  versaoId: string;
  /** Data da sessão na tela: só conta o que foi feito antes dela. */
  data: string;
  registros: readonly RegistroParaAnterior[];
  /** Exercícios da versão em uso, na ordem do plano (todas as sessões): acham a série de um registro desta versão. */
  exerciciosDaVersao: readonly ExercicioPlano[];
}

/** A última vez do exercício antes da data, ou `null` (nunca feito, cardio ou chave desligada). */
export function ultimaVez(entrada: EntradaDaUltimaVez): AnteriorDoExercicio | null {
  const { anteriores, exercicio, versaoId, data } = entrada;
  if (!anteriores || exercicio.modalidade === 'CARDIO') return null;
  const doPacote = exercicio.exercicioId ? anteriores.exercicios[exercicio.exercicioId] : undefined;
  const pacote = doPacote && doPacote.data < data ? doPacote : null;
  const mesmoExercicio = (r: RegistroParaAnterior) =>
    exercicio.exercicioId ? r.exercicioId === exercicio.exercicioId : r.exercicioUid === exercicio.uid;
  const daVersao = entrada.registros.filter((r) => r.planoVersaoId === versaoId && r.concluida && r.data < data && mesmoExercicio(r));
  const ultimaData = daVersao.reduce<string | null>((m, r) => (m == null || r.data > m ? r.data : m), null);
  // Mesma data: vale o do aparelho (inclui o que mudou depois do pacote baixado).
  if (ultimaData == null || (pacote && pacote.data > ultimaData)) return pacote;
  const indice = (uid: string) => entrada.exerciciosDaVersao.findIndex((e) => e.uid === uid);
  const doDia = daVersao.filter((r) => r.data === ultimaData);
  const linha = doDia.map((r) => r.exercicioUid).reduce((a, b) => (indice(b) >= 0 && (indice(a) < 0 || indice(b) < indice(a)) ? b : a));
  const ex = entrada.exerciciosDaVersao[indice(linha)];
  if (!ex) return pacote;
  const posicoes = posicoesNoTipo(ex);
  const series: SerieAnterior[] = [];
  ex.series.forEach((s, i) => {
    const r = doDia.find((x) => x.exercicioUid === linha && x.serieUid === s.uid);
    const p = posicoes[i];
    if (r && p) series.push({ tipo: p.tipo, ordem: p.ordem, carga: r.carga, repeticoes: r.repeticoes, etapas: r.etapas });
  });
  return series.length ? { data: ultimaData, series } : pacote;
}

/** A mesma série da última vez (tipo e ordem dentro dele), ou `null`. */
export function anteriorDaSerie(ultima: AnteriorDoExercicio | null, exercicio: ExercicioPlano, indice: number): SerieAnterior | null {
  if (!ultima) return null;
  const p = posicoesNoTipo(exercicio)[indice];
  if (!p) return null;
  return ultima.series.find((s) => s.tipo === p.tipo && s.ordem === p.ordem) ?? null;
}

const repsDaEtapa = (e: EtapaRegistrada) => (e.repeticoes == null ? '—' : String(e.repeticoes));

/** "60 kg × 8", "15 reps", "40 kg × 4+4+2", "4+4+2 (carga variável)"; sem nada registrado, "—". */
export function textoDoAnterior(s: SerieAnterior | null, semCarga: boolean): string {
  if (!s) return '—';
  if (s.etapas) {
    const feitas = [...s.etapas].sort((a, b) => a.posicao - b.posicao).filter((e) => e.situacao === 'FEITA');
    if (!feitas.length) return '—';
    const reps = feitas.map(repsDaEtapa).join('+');
    if (semCarga) return reps;
    const cargas = feitas.map((e) => e.carga);
    const comum = cargas.every((c) => c != null && c === cargas[0]) ? cargas[0] : null;
    if (comum != null) return `${numeroParaTela(comum)} kg × ${reps}`;
    return cargas.some((c) => c != null) ? `${reps} (carga variável)` : reps;
  }
  if (s.carga == null || semCarga) return s.repeticoes == null ? '—' : `${s.repeticoes} reps`;
  return `${numeroParaTela(s.carga)} kg × ${s.repeticoes ?? '—'}`;
}

/** Linha de cima das séries: "Anterior: o que você fez em 23/10." */
export function textoDaUltimaVez(ultima: AnteriorDoExercicio | null): string | null {
  return ultima ? `Anterior: o que você fez em ${dataCurta(ultima.data)}.` : null;
}
