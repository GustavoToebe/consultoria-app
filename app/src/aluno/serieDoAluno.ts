import type { Cardio, Configuracao, Serie } from '../api/tipos';
import { nomeDaReferencia, textoTecnicaPorExtenso } from '../dominio/agrupamento';
import { metaDaSerie } from '../dominio/cargas';
import { rotuloDescanso } from '../dominio/descanso';
import { numeroParaTela } from '../dominio/formatos';
import { explicacaoDaTecnica, explicacaoDoTipo, nomeDaTecnica, nomeDoTipo } from '../dominio/metodologia';

/**
 * O que o cartão da série mostra ao aluno, em funções puras (a tela só desenha). O tipo da série sai SEMPRE pelo nome da
 * metodologia da versão (a série grava o código); a técnica é outra coisa e tem o seu próprio selo.
 */

export interface SeloDaSerie {
  nome: string;
  /** Explicação da metodologia; nula = o treinador não escreveu. */
  explicacao: string | null;
}

/** Os dois selos da série: o tipo (WS, Back off...) e a técnica (Rest pause...), cada um com a sua explicação. */
export function selosDaSerie(serie: Pick<Serie, 'tipo' | 'tecnica'>, metodologia?: Configuracao | null): { tipo: SeloDaSerie | null; tecnica: SeloDaSerie | null } {
  const nomeDoTipoDaSerie = nomeDoTipo(metodologia, serie.tipo);
  return {
    tipo: nomeDoTipoDaSerie ? { nome: nomeDoTipoDaSerie, explicacao: explicacaoDoTipo(metodologia, serie.tipo) } : null,
    tecnica: serie.tecnica ? { nome: nomeDaTecnica(metodologia, serie.tecnica.tipo), explicacao: explicacaoDaTecnica(metodologia, serie.tecnica.tipo) } : null,
  };
}

export interface TextosDaSerie {
  /** "Meta: 3 a 6 reps · 50% da WS · 1 RIR" (sem a técnica nem o alvo extra, que têm linha própria). */
  meta: string;
  /** "Descanso 1 min 30 s"; nulo quando a série não tem descanso ou ele vale para o grupo. */
  descanso: string | null;
  /** Técnica por extenso. */
  tecnica: string;
  /** Alvo extra do treinador, quando existir. */
  alvoExtra: string | null;
  /** Série pedida em AMRAP: o aluno registra as repetições que fez. */
  amrap: boolean;
}

export function textosDaSerie(
  serie: Serie,
  contexto: { tipoTrabalho: string; semCarga: boolean; metodologia?: Configuracao; seriesDoExercicio: readonly Serie[]; descansoPorSerie: boolean },
): TextosDaSerie {
  const descanso = contexto.descansoPorSerie && serie.descansoSegundos && serie.descansoSegundos > 0 ? `Descanso ${rotuloDescanso(serie.descansoSegundos)}` : null;
  return {
    meta: metaDaSerie({ ...serie, tecnica: null, alvoExtra: null }, contexto.tipoTrabalho, contexto.semCarga, contexto.metodologia, contexto.seriesDoExercicio),
    descanso,
    tecnica: textoTecnicaPorExtenso(serie.tecnica, contexto.metodologia),
    alvoExtra: serie.alvoExtra?.trim() || null,
    amrap: !!serie.amrap,
  };
}

/**
 * Dica sob o cartão da série ativa sobre o peso. Com sugestão: "Mesma carga da WS", "15% abaixo da referência (Top
 * set)" ou "Peso sugerido pelo plano" (some assim que o aluno digita). Back off abaixo da referência sem a referência
 * registrada: não há sugestão e a dica diz o que falta.
 */
export function dicaDaCarga(
  serie: Serie,
  situacao: { sugestao: number | null; digitou: boolean; tipoTrabalho: string; metodologia?: Configuracao; seriesDoExercicio: readonly Serie[] },
): string | null {
  const modo = serie.carga?.modo;
  const referencia = nomeDaReferencia(serie, situacao.seriesDoExercicio, situacao.metodologia);
  if (modo === 'ABAIXO_DA_REFERENCIA' && situacao.sugestao === null) {
    return `Registre a carga da série de referência${referencia ? ` (${referencia})` : ''} para ver o peso sugerido.`;
  }
  if (situacao.sugestao === null || situacao.digitou) return null;
  if (modo === 'MESMA_CARGA') return `Mesma carga da ${situacao.tipoTrabalho}; mude se usar outra.`;
  if (modo === 'ABAIXO_DA_REFERENCIA') {
    return `Peso calculado sobre a carga que você registrou hoje na série de referência${referencia ? ` (${referencia})` : ''}; mude se usar outro.`;
  }
  return 'Peso sugerido pelo plano; mude se usar outro.';
}

/** A prescrição do cardio, uma informação por linha: duração, distância, ritmo, zona e intervalos. */
export function linhasDoCardio(c: Cardio | null | undefined): string[] {
  if (!c) return [];
  const linhas: string[] = [];
  if (c.duracaoMin != null) linhas.push(`Duração: ${c.duracaoMin} min`);
  if (c.distanciaKm != null) linhas.push(`Distância: ${numeroParaTela(c.distanciaKm)} km`);
  if (c.ritmo?.trim()) linhas.push(`Ritmo: ${c.ritmo.trim()}`);
  if (c.zona != null) linhas.push(`Zona: ${c.zona}`);
  const i = c.intervalos;
  if (i) {
    const partes = [`${i.voltas ?? '—'} ${i.voltas === 1 ? 'volta' : 'voltas'}`];
    if (i.trabalhoSeg != null) partes.push(`${i.trabalhoSeg} s de esforço`);
    if (i.descansoSeg != null) partes.push(`${i.descansoSeg} s de descanso`);
    linhas.push(`Intervalos: ${partes.join(' · ')}`);
  }
  return linhas;
}

/** O exercício é de cardio: o aluno só marca "feito", sem peso, repetições nem esforço. */
export const ehExercicioDeCardio = (e: { modalidade: string | null; series: readonly Pick<Serie, 'cardio'>[] }): boolean =>
  e.modalidade === 'CARDIO' || e.series.some((s) => !!s.cardio);

/** Nome do tipo da série para o histórico do aluno ("WS", nunca o código); série sem tipo (cardio) ou fora do plano salvo = "Série". */
export function nomeDaSerieNoHistorico(serie: Pick<Serie, 'tipo'> | undefined, metodologia?: Configuracao | null): string {
  return nomeDoTipo(metodologia, serie?.tipo) || 'Série';
}
