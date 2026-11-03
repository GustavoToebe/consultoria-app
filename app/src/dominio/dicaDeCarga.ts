import type { EtapaRegistrada } from '../api/tipos';
import { numeroParaTela } from './formatos';
import { textoDoAnterior } from './seriesAnteriores';

/**
 * Dica de carga da série (D1, 02/11): a carga sugerida (mesma carga, percentual, base do dia ou carga fixa) é só uma
 * DICA ao lado do campo, nunca escrita nele. O app não inventa carga nem repetição (D3): as repetições só chegam ao campo
 * pelo "Repetir" (`repetirSerie`), que copia o que o próprio aluno registrou. Regra pura; funciona sem internet.
 */

export const TEXTO_PRIMEIRA_VEZ = 'Primeira vez: escolha a carga';

/** O que se sabe da última vez da série (`SerieAnterior` ou `UltimaCarga` servem). */
export interface UltimaVezDaSerie {
  carga: number | null;
  repeticoes: number | null;
  /** Série registrada por etapa (Cluster, Rest-pause); nulo = série inteira. */
  etapas?: EtapaRegistrada[] | null;
}

export interface EntradaDaDica {
  /** `SerieCalculada.sugestao`: kg, ou `null` sem base. */
  sugestaoKg: number | null;
  /** A última vez desta série, ou `null` (primeira vez). */
  ultima: UltimaVezDaSerie | null;
  /** Exercício sem carga (`unidade === 'nenhuma'`) ou série de cardio: não há dica de carga. */
  semCampoDePeso: boolean;
}

/** "60 kg × 7", "60 kg", "7 reps"; `null` quando a última vez não tem carga nem repetições. */
export function textoDaUltimaCarga(ultima: UltimaVezDaSerie | null): string | null {
  if (!ultima) return null;
  if (ultima.etapas) {
    const t = textoDoAnterior({ tipo: '', ordem: 0, carga: ultima.carga, repeticoes: ultima.repeticoes, etapas: ultima.etapas }, false);
    return t === '—' ? null : t;
  }
  const partes: string[] = [];
  if (ultima.carga != null) partes.push(`${numeroParaTela(ultima.carga)} kg`);
  if (ultima.repeticoes != null) partes.push(ultima.carga != null ? `× ${ultima.repeticoes}` : `${ultima.repeticoes} ${ultima.repeticoes === 1 ? 'rep' : 'reps'}`);
  return partes.length ? partes.join(' ') : null;
}

/**
 * "Sugestão: 60 kg · Última vez: 60 kg × 7"; só uma das partes quando falta a outra; "Primeira vez: escolha a carga" sem
 * sugestão nem última vez; `null` onde não há campo de peso. Só devolve texto: nunca um valor para o campo.
 */
export function dicaDeCarga(e: EntradaDaDica): string | null {
  if (e.semCampoDePeso) return null;
  const partes: string[] = [];
  if (e.sugestaoKg != null) partes.push(`Sugestão: ${numeroParaTela(e.sugestaoKg)} kg`);
  const ultima = textoDaUltimaCarga(e.ultima);
  if (ultima) partes.push(`Última vez: ${ultima}`);
  return partes.length ? partes.join(' · ') : TEXTO_PRIMEIRA_VEZ;
}

/**
 * A dica em duas partes para a tela, como na prévia da Frente G (4bad4704): "Sugestão: 60 kg" ou "Primeira vez: escolha a
 * carga" em destaque e o resto ("Última vez: 60 kg × 7") em peso normal. Outro texto (ex.: o que falta registrar) não tem destaque.
 */
export function partesDaDica(dica: string): { destaque: string | null; resto: string | null } {
  const [primeira, ...demais] = dica.split(' · ');
  if (primeira === TEXTO_PRIMEIRA_VEZ || primeira.startsWith('Sugestão: ')) return { destaque: primeira, resto: demais.length ? demais.join(' · ') : null };
  return { destaque: null, resto: dica };
}
