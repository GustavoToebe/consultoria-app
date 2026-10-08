import type { Intensidade, Serie } from '../api/tipos';
import { numeroParaTela } from './formatos';

/**
 * Séries consecutivas iguais (tipo, faixa de repetições, alvo e forma de intensidade) aparecem juntas como no PDF do
 * Saraiva: "3x3 - FS 50/70/85%", "1x3 a 6 - WS". No plano elas continuam individuais, cada uma com seu uid.
 */
export interface GrupoDeSeries {
  /** Posição da primeira série do grupo na lista do exercício. */
  inicio: number;
  series: Serie[];
}

const modo = (s: Serie) => s.intensidade?.modo ?? 'NENHUMA';

const chave = (s: Serie) => [s.tipo, s.repsMin ?? '', s.repsMax ?? '', s.alvoTexto ?? '', modo(s)].join('|');

export function agrupar(series: Serie[]): GrupoDeSeries[] {
  const grupos: GrupoDeSeries[] = [];
  series.forEach((s, i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && chave(ultimo.series[0]) === chave(s)) {
      ultimo.series.push(s);
    } else {
      grupos.push({ inicio: i, series: [s] });
    }
  });
  return grupos;
}

/** "3 a 6" ou "3"; vazio quando a série é por tempo/alvo. */
export function faixa(s: Pick<Serie, 'repsMin' | 'repsMax'>): string {
  if (s.repsMin === null || s.repsMax === null) return '';
  return s.repsMin === s.repsMax ? String(s.repsMin) : `${s.repsMin} a ${s.repsMax}`;
}

/** Intensidade em texto curto ("85%", "2 RIR", "RPE 8,5"); vazio para carga de trabalho e "sem intensidade". */
export function textoIntensidade(i: Intensidade | null): string {
  switch (i?.modo) {
    case 'PERCENTUAL_WS':
      return i.percentual == null ? '' : `${numeroParaTela(i.percentual)}%`;
    case 'RIR':
      return i.rir == null ? '' : `${i.rir} RIR`;
    case 'RPE':
      return i.rpe == null ? '' : `RPE ${numeroParaTela(i.rpe)}`;
    case 'LIVRE':
      return i.texto ?? '';
    default:
      return '';
  }
}

/** Resumo do grupo: "3x3 - FS 50/70/85%", "1x3 a 6 - WS", "1x - Cardio 50 min". */
export function descreverGrupo(grupo: GrupoDeSeries): string {
  const primeira = grupo.series[0];
  const partes = [`${grupo.series.length}x${faixa(primeira)} - ${primeira.tipo || 'Série'}`];
  if (modo(primeira) === 'PERCENTUAL_WS') {
    const valores = grupo.series.map((s) => (s.intensidade?.percentual == null ? '?' : numeroParaTela(s.intensidade.percentual)));
    partes.push(`${valores.join('/')}%`);
  } else {
    const texto = textoIntensidade(primeira.intensidade);
    if (texto) partes.push(texto);
  }
  if (primeira.alvoTexto) partes.push(primeira.alvoTexto);
  return partes.join(' ');
}

/** Resumo de todas as séries do exercício, um grupo por linha. */
export function descreverSeries(series: Serie[]): string[] {
  return agrupar(series).map(descreverGrupo);
}
