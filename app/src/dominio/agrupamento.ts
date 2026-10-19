import type { Intensidade, Serie, Tecnica } from '../api/tipos';
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

const chave = (s: Serie) => [s.tipo, s.repsMin ?? '', s.repsMax ?? '', s.alvoTexto ?? '', modo(s), s.tecnica ? JSON.stringify(s.tecnica) : ''].join('|');

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

const n = (v: number | null | undefined) => (v == null ? '?' : String(v));

/** Técnica em texto curto (editor e PDF): "Cluster 3×2, 20 s" e "Rest pause 20 s +2" ("+2×3" com repetições fixas). */
export function textoTecnica(t: Tecnica | null | undefined): string {
  if (!t) return '';
  if (t.tipo === 'CLUSTER') return `Cluster ${n(t.blocos)}×${n(t.repsPorBloco)}, ${n(t.pausaSegundos)} s`;
  const reps = t.repsPorRetomada ? `×${t.repsPorRetomada}` : '';
  return `Rest pause ${n(t.pausaSegundos)} s +${n(t.retomadas)}${reps}`;
}

/** Técnica por extenso, como o aluno lê: o que fazer, sem nada além do que o treinador escreveu. */
export function textoTecnicaPorExtenso(t: Tecnica | null | undefined): string {
  if (!t) return '';
  if (t.tipo === 'CLUSTER') {
    return `Cluster: ${n(t.blocos)} blocos de ${n(t.repsPorBloco)} repetições, ${n(t.pausaSegundos)} s de pausa entre os blocos.`;
  }
  const retomadas = t.retomadas === 1 ? '1 retomada' : `${n(t.retomadas)} retomadas`;
  const reps = t.repsPorRetomada ? `de ${t.repsPorRetomada} repetições` : 'até a falha';
  return `Rest pause: depois da série, ${n(t.pausaSegundos)} s de pausa e mais ${retomadas} ${reps}.`;
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
  const tecnica = textoTecnica(primeira.tecnica);
  if (tecnica) partes.push(`· ${tecnica}`);
  return partes.join(' ');
}

/** Resumo de todas as séries do exercício, um grupo por linha. */
export function descreverSeries(series: Serie[]): string[] {
  return agrupar(series).map(descreverGrupo);
}

/** Técnicas do exercício por extenso, sem repetir (o aluno lê uma vez, antes das séries). */
export function textosDeTecnica(series: readonly Serie[]): string[] {
  return tecnicasDoExercicio(series).map((t) => t.texto);
}

export interface TecnicaParaOAluno {
  texto: string;
  /** Pausa entre blocos ou antes da retomada; nulo quando o treinador não informou. */
  pausaSegundos: number | null;
}

/**
 * Técnicas do exercício para o aluno, sem repetir, com a pausa: a tela oferece um botão para iniciar o cronômetro
 * dela (opcional; nada começa sozinho e nada prende o aluno, pedido da reunião de 17/10).
 */
export function tecnicasDoExercicio(series: readonly Serie[]): TecnicaParaOAluno[] {
  const vistas = new Map<string, TecnicaParaOAluno>();
  for (const s of series) {
    const texto = textoTecnicaPorExtenso(s.tecnica);
    if (!texto || vistas.has(texto)) continue;
    const pausa = s.tecnica?.pausaSegundos;
    vistas.set(texto, { texto, pausaSegundos: pausa != null && pausa > 0 ? pausa : null });
  }
  return [...vistas.values()];
}
