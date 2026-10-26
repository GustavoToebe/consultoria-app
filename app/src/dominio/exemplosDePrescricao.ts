import type { Configuracao, Serie } from '../api/tipos';
import { agrupar, type GrupoDeSeries } from './agrupamento';
import { adicionarSerie, alterarGrupo, LIMITE_SERIES, novaSerie, tecnicaVazia } from './editorTreino';
import { codigoTrabalho, padraoDaTecnica, papelDe } from './metodologia';

/** Quantidades do exemplo, só para mostrar a montagem. Não entram no padrão da metodologia. */
export const REPS_FS_DO_EXEMPLO = { min: 10, max: 15 } as const;
export const REPS_WS_DO_EXEMPLO = { min: 6, max: 8 } as const;
export const BLOCOS_DO_EXEMPLO_CLUSTER = [4, 4, 4, 4] as const;
export const PAUSA_DO_EXEMPLO_CLUSTER = 15;

export const TEXTO_DO_EXEMPLO =
  'Exemplo para ver a montagem. A pausa de 15 s é a do vídeo e continua editável. As quantidades não viram padrão dos alunos.';

export const TEXTO_SEQUENCIA_CLUSTER =
  'Exemplo editável: 1 série, 4 repetições, pausa, 4, pausa, 4, pausa, 4, fim.';

export function textoDaContagemDeSeries(quantidade: number): string {
  if (quantidade === 1) return 'Este exercício fica com 1 série.';
  return `Este exercício fica com ${quantidade} séries.`;
}

/** Primeiro tipo de preparação (a FS da metodologia padrão). */
export function codigoPreparacao(config: Configuracao | null | undefined): string | null {
  const tipo = config?.tipos?.find((t) => t.papel === 'PREPARACAO' && t.codigo?.trim());
  return tipo?.codigo.trim() || null;
}

export function quantidadeDoExemplo(exemplo: 'fs-ws-cluster' | 'fs-cluster'): number {
  return exemplo === 'fs-ws-cluster' ? 3 : 2;
}

function serieAjustada(config: Configuracao | null | undefined, tipo: string, tecnica: 'CLUSTER' | null, reps: { min: number; max: number } | null, modalidade: string | null): Serie {
  const criada = novaSerie(config, tipo, modalidade, tecnica);
  const grupo = agrupar([criada])[0];
  if (tecnica === 'CLUSTER') {
    const padrao = padraoDaTecnica(config, 'CLUSTER');
    return alterarGrupo([criada], grupo, {
      tecnica: { ...tecnicaVazia('CLUSTER', padrao), blocos: [...BLOCOS_DO_EXEMPLO_CLUSTER], pausaSegundos: PAUSA_DO_EXEMPLO_CLUSTER },
    }, config, modalidade)[0];
  }
  return alterarGrupo([criada], grupo, { repsMin: reps!.min, repsMax: reps!.max }, config, modalidade)[0];
}

/**
 * Soma o exemplo ao exercício, cada série num grupo próprio. Sem tipo de preparação ou de trabalho, ou sem vaga para
 * o exemplo inteiro, devolve a mesma lista.
 */
export function acrescentarExemplo(
  series: readonly Serie[],
  config: Configuracao | null | undefined,
  exemplo: 'fs-ws-cluster' | 'fs-cluster',
  modalidade: string | null = null,
): Serie[] {
  const preparacao = codigoPreparacao(config);
  const trabalho = codigoTrabalho(config);
  if (!preparacao || !trabalho || series.length + quantidadeDoExemplo(exemplo) > LIMITE_SERIES) return [...series];
  const fs = serieAjustada(config, preparacao, null, REPS_FS_DO_EXEMPLO, modalidade);
  const cluster = serieAjustada(config, trabalho, 'CLUSTER', null, modalidade);
  const novas = exemplo === 'fs-ws-cluster'
    ? [fs, serieAjustada(config, trabalho, null, REPS_WS_DO_EXEMPLO, modalidade), cluster]
    : [fs, cluster];
  return [...series, ...novas];
}

/** Aplica Rest-pause na série de trabalho indicada, sem apagar esforço nem descanso. */
export function restPauseNestaSerie(
  series: readonly Serie[],
  grupo: GrupoDeSeries,
  config: Configuracao | null | undefined,
  modalidade: string | null = null,
): Serie[] {
  if (papelDe(config, grupo.series[0].tipo) !== 'TRABALHO') return [...series];
  return alterarGrupo(series as Serie[], grupo, { tecnica: tecnicaVazia('REST_PAUSE', padraoDaTecnica(config, 'REST_PAUSE')) }, config, modalidade);
}

/** Acrescenta uma WS nova com Rest-pause. A série anterior permanece como está. */
export function novaWsComRestPause(
  series: readonly Serie[],
  config: Configuracao | null | undefined,
  modalidade: string | null = null,
): Serie[] {
  const trabalho = codigoTrabalho(config);
  if (!trabalho) return [...series];
  return adicionarSerie([...series], config, trabalho, 'REST_PAUSE', modalidade);
}
