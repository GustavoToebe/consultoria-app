import type { Cardio, Configuracao, Serie } from '../api/tipos';
import { leituraDaTecnica, nomeDaReferencia } from '../dominio/agrupamento';
import { metaDaSerie } from '../dominio/cargas';
import { rotuloDescanso } from '../dominio/descanso';
import { numeroParaTela } from '../dominio/formatos';
import { corDoTipoDeSerie } from '../dominio/corDaSerie';
import { explicacaoDaTecnica, explicacaoDoTipo, nomeDaTecnica, nomeDoTipo, papelDe } from '../dominio/metodologia';
import type { ChaveDeIdentificacao } from '../tema/tokens';

/**
 * O que o cartão da série mostra ao aluno, em funções puras (a tela só desenha). O tipo da série sai SEMPRE pelo nome da
 * metodologia da versão (a série grava o código); a técnica é outra coisa e tem o seu próprio selo.
 */

export interface SeloDaSerie {
  nome: string;
  /** Explicação da metodologia; nula = o treinador não escreveu. */
  explicacao: string | null;
  /**
   * Cor de identificação do tipo (Frente G, D9): pelo código dos cinco tipos padrão, senão pelo papel na metodologia da
   * versão; `null` = sem cor (papel "Outro", tipo fora da metodologia ou a técnica). Nunca a única informação (D7).
   */
  cor: ChaveDeIdentificacao | null;
}

/** Os dois selos da série: o tipo (WS, Back off...), com a cor de identificação, e a técnica (Rest pause...), sem cor; cada um com a sua explicação. */
export function selosDaSerie(serie: Pick<Serie, 'tipo' | 'tecnica'>, metodologia?: Configuracao | null): { tipo: SeloDaSerie | null; tecnica: SeloDaSerie | null } {
  const nomeDoTipoDaSerie = nomeDoTipo(metodologia, serie.tipo);
  return {
    tipo: nomeDoTipoDaSerie
      ? { nome: nomeDoTipoDaSerie, explicacao: explicacaoDoTipo(metodologia, serie.tipo), cor: corDoTipoDeSerie(serie.tipo, papelDe(metodologia, serie.tipo)) }
      : null,
    tecnica: serie.tecnica ? { nome: nomeDaTecnica(metodologia, serie.tecnica.tipo), explicacao: explicacaoDaTecnica(metodologia, serie.tecnica.tipo), cor: null } : null,
  };
}

export interface TextosDaSerie {
  /** "Meta: 3 a 6 reps · 50% da WS · 1 RIR" (sem a técnica nem o alvo extra, que têm linha própria). */
  meta: string;
  /** A mesma meta sem o "Meta: " do começo, para a linha em destaque do cartão, que já tem o rótulo (A8, 30/10). */
  valorDaMeta: string;
  /** "Descanso 1 min 30 s"; nulo quando a série não tem descanso ou ele vale para o grupo. */
  descanso: string | null;
  /** Técnica por extenso. */
  tecnica: string;
  /** Alvo extra do treinador, quando existir. Para o aluno ele se chama "Observação desta série" (A9, 30/10). */
  alvoExtra: string | null;
  /** Série pedida em AMRAP: o aluno registra as repetições que fez. */
  amrap: boolean;
}

export function textosDaSerie(
  serie: Serie,
  contexto: { tipoTrabalho: string; semCarga: boolean; metodologia?: Configuracao; seriesDoExercicio: readonly Serie[]; descansoPorSerie: boolean },
): TextosDaSerie {
  const descanso = contexto.descansoPorSerie && serie.descansoSegundos && serie.descansoSegundos > 0 ? `Descanso ${rotuloDescanso(serie.descansoSegundos)}` : null;
  const meta = metaDaSerie({ ...serie, tecnica: null, alvoExtra: null }, contexto.tipoTrabalho, contexto.semCarga, contexto.metodologia, contexto.seriesDoExercicio);
  return {
    meta,
    valorDaMeta: meta.replace(/^Meta: /, ''),
    descanso,
    tecnica: leituraDaTecnica(serie, contexto.metodologia, { descansoPorSerie: contexto.descansoPorSerie, semCarga: contexto.semCarga }),
    alvoExtra: serie.alvoExtra?.trim() || null,
    amrap: !!serie.amrap,
  };
}

/**
 * O que falta para haver sugestão de peso: Back off "abaixo da referência" sem a série de referência registrada hoje
 * ("Registre a carga da série de referência (Top set)..."). Com sugestão não há dica aqui: a sugestão é só texto ao lado
 * do campo (D1, 02/11, `dominio/dicaDeCarga`), e o campo nunca vem preenchido, então não há "mude se usar outra".
 */
export function dicaDaCarga(
  serie: Serie,
  situacao: { sugestao: number | null; metodologia?: Configuracao; seriesDoExercicio: readonly Serie[] },
): string | null {
  if (serie.carga?.modo !== 'ABAIXO_DA_REFERENCIA' || situacao.sugestao !== null) return null;
  const referencia = nomeDaReferencia(serie, situacao.seriesDoExercicio, situacao.metodologia);
  return `Registre a carga da série de referência${referencia ? ` (${referencia})` : ''} para ver o peso sugerido.`;
}

/**
 * A meta da série em duas partes para o cartão (D5, 02/11): as repetições ("3 a 6 reps", "AMRAP"), que ficam grandes ao
 * lado do campo de carga, e o resto ("50% da WS · 1 RIR"), menor, logo abaixo delas. Só reparte o texto de `metaDaSerie`.
 */
export function partesDaMeta(valorDaMeta: string): { repeticoes: string; resto: string | null } {
  const [repeticoes, ...resto] = valorDaMeta.split(' · ');
  return { repeticoes: repeticoes ?? valorDaMeta, resto: resto.length ? resto.join(' · ') : null };
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
