import type { Configuracao, Serie } from '../api/tipos';
import { faixa, nomeDaReferencia, textoCardio, textoCarga, textoDaFaixaPercentual, textoEsforco, textoPausa, textoTecnica } from './agrupamento';
import { blocosIguais, blocosValidos, somaDosBlocos } from './blocos';
import { rotuloDescanso } from './descanso';
import { nomeDaSerieDeTrabalho } from './metodologia';

/**
 * Leitura curta de uma série, a mesma no editor ("Para o aluno"), no PDF e na tela do aluno: o resultado final, sem
 * repetir campo por campo. "1 série completa · 4 blocos de 4 reps · pausa de 15 s"; carga, esforço e descanso vêm em
 * linhas próprias, só quando informados (ou quando falta algo que o treinador precisa ver).
 */

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "4, 4 e 2". */
function listaComE(numeros: readonly number[]): string {
  if (numeros.length <= 1) return numeros.join('');
  return `${numeros.slice(0, -1).join(', ')} e ${numeros[numeros.length - 1]}`;
}

/** Repetições da série: "3 a 6 reps", "8 reps", "AMRAP" ou "por tempo". */
export function textoDasRepeticoesDaSerie(s: Pick<Serie, 'repsMin' | 'repsMax' | 'amrap'>): string {
  if (s.amrap) return 'AMRAP';
  const f = faixa(s);
  return f ? `${f} reps` : 'por tempo';
}

/**
 * A estrutura da série em uma linha, sem o tipo: blocos do Cluster ("4 blocos de 4 reps · pausa de 15 s"; desiguais com o
 * total), etapa inicial e retomadas do Rest-pause ("8 reps + 1 retomada · pausa de 20 s") ou as repetições com a técnica
 * curta das outras ("10 reps · Drop-set 2× −20%"). Cluster sem blocos válidos diz o que falta.
 */
export function estruturaDaSerie(s: Serie, config?: Configuracao | null): string {
  if (s.cardio) return textoCardio(s.cardio);
  const t = s.tecnica;
  if (t?.tipo === 'CLUSTER') {
    if (!blocosValidos(t.blocos)) return 'Cluster: complete os blocos';
    const b = t.blocos!;
    const blocos = blocosIguais(b) ? `${b.length} blocos de ${plural(b[0], 'rep', 'reps')}` : `blocos de ${listaComE(b)} reps (${somaDosBlocos(b)} no total)`;
    return `${blocos} · pausa de ${textoPausa(t)}`;
  }
  if (t?.tipo === 'REST_PAUSE') {
    const pausas = t.pausas != null && t.pausas > 0 ? t.pausas : 1;
    return `${textoDasRepeticoesDaSerie(s)} + ${plural(pausas, 'retomada', 'retomadas')} · pausa de ${textoPausa(t)}`;
  }
  const tecnica = textoTecnica(t, config);
  return [textoDasRepeticoesDaSerie(s), tecnica].filter(Boolean).join(' · ');
}

export interface PreviaDoGrupo {
  /** "2 séries completas · 4 blocos de 4 reps · pausa de 15 s". */
  resumo: string;
  /** Carga, referência, esforço, descanso e alvo extra, cada um numa linha e só quando faz sentido. */
  linhas: string[];
}

/**
 * Prévia de um grupo de séries iguais (as `series` são as do exercício: dão o nome da referência e a posição). Percentuais
 * diferentes por série saem juntos ("50/70/85 a 90% da WS"). `referencia` é a origem da carga já em texto (ver
 * `referenciaDaCarga` no editor), para o treinador saber de onde sai a sugestão.
 */
export function previaDoGrupo(
  grupo: { series: readonly Serie[] },
  series: readonly Serie[],
  config: Configuracao | null | undefined,
  contexto: { semCarga?: boolean; descansoPorSerie?: boolean; referencia?: string | null },
): PreviaDoGrupo {
  const primeira = grupo.series[0];
  const n = grupo.series.length;
  const resumo = `${plural(n, 'série completa', 'séries completas')} · ${estruturaDaSerie(primeira, config)}`;
  if (primeira.cardio) return { resumo, linhas: [] };
  const linhas: string[] = [];
  const modo = primeira.carga?.modo ?? 'NENHUMA';
  const ws = nomeDaSerieDeTrabalho(config);
  if (!contexto.semCarga && modo !== 'NENHUMA') {
    let carga: string;
    if (modo === 'CARGA_TRABALHO') carga = 'carga de trabalho (a base do dia, que o aluno informa)';
    else if (modo === 'MESMA_CARGA') carga = textoCarga(primeira.carga, ws);
    else {
      const valores = grupo.series.map((s) => textoDaFaixaPercentual(s.carga?.percentualMin, s.carga?.percentualMax));
      const lista = valores.every((v) => v === valores[0]) ? valores[0] : valores.join('/');
      const referencia = nomeDaReferencia(primeira, series, config);
      carga = modo === 'PERCENTUAL_WS' ? `${lista}%${ws ? ` da ${ws}` : ''}`
        : modo === 'ACIMA_DA_ANTERIOR' ? `+${lista}% sobre a anterior`
          : `${lista}% abaixo da referência${referencia ? ` (${referencia})` : ''}`;
    }
    linhas.push(`Carga: ${carga}`);
    if (contexto.referencia) linhas.push(contexto.referencia);
  }
  const esforco = textoEsforco(primeira.esforco);
  if (esforco) linhas.push(`Esforço: ${esforco}`);
  const comEtapas = primeira.tecnica?.tipo === 'CLUSTER' || primeira.tecnica?.tipo === 'REST_PAUSE';
  if (contexto.descansoPorSerie !== false) {
    if (primeira.descansoSegundos != null && primeira.descansoSegundos > 0) linhas.push(`Descanso depois da série: ${rotuloDescanso(primeira.descansoSegundos)}`);
    // Com pausa interna, o treinador precisa ver que o descanso final é outro campo e ainda está vazio.
    else if (comEtapas) linhas.push('Descanso depois da série: não informado');
  }
  const alvo = primeira.alvoExtra?.trim();
  if (alvo) linhas.push(`Alvo extra: ${alvo}`);
  return { resumo, linhas };
}
