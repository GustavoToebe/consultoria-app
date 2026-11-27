import type { ExercicioPlano, Serie, Sessao, UltimaCarga } from '../api/tipos';
import { textoCardio, textoDasRepeticoes, textoEsforco } from './agrupamento';
import { ehSerieDeTrabalho } from './cargas';
import { textoDaUltimaCarga } from './dicaDeCarga';
import { dataCurta } from './formatos';
import { MODALIDADES } from './modalidades';
import { marcaDoRegistro, type Marca, type RegistroParaRecorde } from './recordesPessoais';
import { contagemDoExercicio, nomeComDia } from './semana';
import type { UnidadeDeCarga } from './unidadeDeCarga';

/**
 * Textos e contas da tela do exercício redesenhada (25/11), todos em funções puras: a tela só desenha. Nada aqui inventa
 * carga ou repetição: o que falta é "—" ou some.
 */

export const SEM_REGISTRO_ANTERIOR = 'Sem registro anterior';

/** "Último registro: 90 kg × 7 em 18/11" ou "Sem registro anterior" (sem carga na última vez também não há o que dizer). */
export function textoDoUltimoRegistro(ultima: UltimaCarga | null, unidade: UnidadeDeCarga = 'kg'): string {
  const texto = ultima?.carga != null ? textoDaUltimaCarga(ultima, unidade) : null;
  return texto && ultima ? `Último registro: ${texto} em ${dataCurta(ultima.data)}` : SEM_REGISTRO_ANTERIOR;
}

const repsDaMeta = (s: Pick<Serie, 'repsMin' | 'repsMax' | 'amrap'>): string | null => {
  const t = textoDasRepeticoes(s);
  return t === '—' ? null : t === 'AMRAP' ? t : `${t} reps`;
};

/**
 * "meta da WS: 6 a 8 reps": a faixa das séries de trabalho quando é a mesma em todas; faixas diferentes ou série de
 * trabalho sem repetições não têm uma meta só, então nada (a meta de cada série fica na própria linha).
 */
export function metaDaWsDoExercicio(e: Pick<ExercicioPlano, 'series'>, tipoTrabalho: string): string | null {
  const metas = e.series.filter((s) => ehSerieDeTrabalho(s) && !s.cardio).map(repsDaMeta);
  return metas.length > 0 && metas.every((m) => m !== null && m === metas[0]) ? `meta da ${tipoTrabalho}: ${metas[0]}` : null;
}

/**
 * O cardio novo conta em blocos, não em séries (cada série de um exercício `CARDIO` é um bloco, D1 de
 * docs/planos/cardio-e-hiit.md): basta um bloco com `modo`. O cardio antigo (sem `modo`) continua em séries, como antes.
 * Limite: o contínuo novo também não grava `modo` (D3), então um cardio só com blocos contínuos ainda conta em séries.
 */
export const contaEmBlocos = (e: Pick<ExercicioPlano, 'series'>): boolean => e.series.some((s) => s.cardio?.modo != null);

/** "3 séries", "1 série" ou, no cardio novo, "3 blocos", "1 bloco". */
export const quantasSeries = (n: number, blocos: boolean): string =>
  `${n} ${blocos ? (n === 1 ? 'bloco' : 'blocos') : n === 1 ? 'série' : 'séries'}`;

/**
 * "Peso livre · 3 séries · meta da WS: 6 a 8 reps" (no cardio novo, "Cardio · 2 blocos"): cada parte some quando não
 * existe. As séries são as da contagem "N de M feitas".
 */
export function cabecalhoDoExercicio(
  e: Pick<ExercicioPlano, 'modalidade' | 'series'>,
  tipoTrabalho: string,
  metodologia?: Parameters<typeof contagemDoExercicio>[2],
): string {
  const total = contagemDoExercicio(e, () => false, metodologia).total || e.series.length;
  return [
    e.modalidade ? (MODALIDADES[e.modalidade] ?? e.modalidade) : null,
    quantasSeries(total, contaEmBlocos(e)),
    metaDaWsDoExercicio(e, tipoTrabalho),
  ].filter(Boolean).join(' · ');
}

/**
 * A meta à direita do cabeçalho da série: "6 a 8 reps · até a falha". Só as repetições e o esforço; a carga é a sugestão
 * dentro do campo, e técnica e observação têm linha própria (`serieDoAluno.textosDaSerie`). Cardio: a prescrição.
 */
export function metaDaLinhaDaSerie(s: Pick<Serie, 'repsMin' | 'repsMax' | 'amrap' | 'esforco' | 'cardio'>): string {
  if (s.cardio) return textoCardio(s.cardio);
  return [repsDaMeta(s), textoEsforco(s.esforco)].filter(Boolean).join(' · ');
}

/** A série ativa é a primeira não feita; -1 com todas feitas. */
export function indiceDaSerieAtiva(series: readonly Pick<Serie, 'uid'>[], feita: (serieUid: string) => boolean): number {
  return series.findIndex((s) => !feita(s.uid));
}

/**
 * "Séries 0 de 3 feitas" (a contagem de `contagemDoExercicio`, a mesma da lista do dia e do "Bom trabalho"); no cardio
 * novo (`contaEmBlocos`), "Blocos 0 de 3 feitos".
 */
export function textoDasSeriesFeitas({ feitas, total }: { feitas: number; total: number }, blocos = false): string {
  if (blocos) return total === 1 ? `Bloco ${feitas} de 1 feito` : `Blocos ${feitas} de ${total} feitos`;
  return total === 1 ? `Série ${feitas} de 1 feita` : `Séries ${feitas} de ${total} feitas`;
}

/** Topo da tela: "Quarta - Pernas" e "Exercício 1 de 5" (`posicao` base 0). */
export function topoDoExercicio(sessao: Sessao, posicao: number): { titulo: string; posicao: string } {
  return { titulo: nomeComDia(sessao, ' - '), posicao: `Exercício ${posicao + 1} de ${sessao.exercicios.length}` };
}

export interface ProgressoDoExercicio {
  uid: string;
  feitas: number;
  total: number;
  /** Todas as séries contadas feitas (exercício sem série contada nunca fica completo). */
  completo: boolean;
}

/** Uma barra por exercício da sessão, com a contagem de `contagemDoExercicio`. */
export function progressoDosExercicios(
  sessao: Pick<Sessao, 'exercicios'>,
  feita: (serieUid: string) => boolean,
  metodologia?: Parameters<typeof contagemDoExercicio>[2],
): ProgressoDoExercicio[] {
  return sessao.exercicios.map((e) => {
    const { feitas, total } = contagemDoExercicio(e, feita, metodologia);
    return { uid: e.uid, feitas, total, completo: total > 0 && feitas >= total };
  });
}

/** O pedaço do registro que a conta da WS usa. */
export type RegistroDaWs = Pick<RegistroParaRecorde, 'concluida' | 'etapas' | 'carga' | 'repeticoes'>;

/** A melhor série de trabalho (WS) feita hoje: maior carga e, no empate, mais repetições. Sem carga e repetições, nada. */
export function melhorWsDeHoje(e: Pick<ExercicioPlano, 'series'>, registroDe: (serieUid: string) => RegistroDaWs | undefined): Marca | null {
  let melhor: Marca | null = null;
  for (const s of e.series) {
    if (!ehSerieDeTrabalho(s) || s.cardio) continue;
    const m = marcaDoRegistro(registroDe(s.uid));
    if (m && (!melhor || m.carga > melhor.carga || (m.carga === melhor.carga && m.repeticoes > melhor.repeticoes))) melhor = m;
  }
  return melhor;
}

export interface RecordeDaWs {
  /** `MAIS_CARGA` = carga maior que a da WS anterior; `MAIS_REPETICOES` = a mesma carga com mais repetições. */
  tipo: 'MAIS_CARGA' | 'MAIS_REPETICOES';
  hoje: Marca;
  anterior: UltimaCarga;
}

/**
 * Bateu a WS anterior? Compara a melhor WS de hoje com a última WS registrada ANTES de hoje (`ultimaCarga` do dia):
 * carga maior, ou a mesma carga com mais repetições. Sem WS anterior (ou sem carga nela) não há contra o que bater.
 * Não é o recorde pessoal de `recordesPessoais` (melhor de todo o histórico, só com "Concluir treino" ligado).
 */
export function recordeDaWs(hoje: Marca | null, anterior: UltimaCarga | null): RecordeDaWs | null {
  if (!hoje || !anterior || anterior.carga == null || anterior.carga <= 0) return null;
  const igual = Math.abs(hoje.carga - anterior.carga) < 1e-9;
  if (hoje.carga > anterior.carga && !igual) return { tipo: 'MAIS_CARGA', hoje, anterior };
  if (igual && anterior.repeticoes != null && hoje.repeticoes > anterior.repeticoes) return { tipo: 'MAIS_REPETICOES', hoje, anterior };
  return null;
}

/** "Recorde na WS" e "92,5 kg × 7 (antes: 90 kg × 7 em 18/11)". */
export function textoDoRecordeDaWs(r: RecordeDaWs, tipoTrabalho: string, unidade: UnidadeDeCarga = 'kg'): { titulo: string; detalhe: string } {
  const hoje = textoDaUltimaCarga({ carga: r.hoje.carga, repeticoes: r.hoje.repeticoes }, unidade);
  return { titulo: `Recorde na ${tipoTrabalho}`, detalhe: `${hoje} (antes: ${textoDaUltimaCarga(r.anterior, unidade)} em ${dataCurta(r.anterior.data)})` };
}
