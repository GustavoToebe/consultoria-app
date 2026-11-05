import type { Configuracao, Serie } from '../api/tipos';
import type { GrupoDeSeries } from './agrupamento';
import { tecnicaVazia } from './editorTreino';
import { padraoDaTecnica, papelDe, tecnicaNaMetodologia } from './metodologia';

export const TEXTO_SEQUENCIA_CLUSTER =
  'Exemplo editável: 1 série, 4 repetições, pausa, 4, pausa, 4, pausa, 4, fim.';

export function textoDaContagemDeSeries(quantidade: number): string {
  if (quantidade === 1) return 'Este exercício fica com 1 série.';
  return `Este exercício fica com ${quantidade} séries.`;
}

/**
 * O botão "Aplicar Rest-pause só na última série" do cartão do grupo. Só aparece em grupo de trabalho com 2 ou mais
 * séries iguais e SEM técnica (com 1 só, o grupo já é a última; com Cluster, Drop-set ou outra técnica o botão não
 * aparece), e com Rest-pause na metodologia.
 */
export function podeRestPauseNaUltima(grupo: GrupoDeSeries, config: Configuracao | null | undefined): boolean {
  const primeira = grupo.series[0];
  return !!primeira
    && grupo.series.length >= 2
    && papelDe(config, primeira.tipo) === 'TRABALHO'
    && tecnicaNaMetodologia(config, 'REST_PAUSE')
    && !primeira.tecnica;
}

/**
 * Aplica Rest-pause só na última série do cartão, sem apagar esforço, carga nem descanso e sem mexer nas anteriores.
 * Técnica fora da metodologia não entra.
 */
export function restPauseNestaSerie(
  series: readonly Serie[],
  grupo: GrupoDeSeries,
  config: Configuracao | null | undefined,
): Serie[] {
  if (!tecnicaNaMetodologia(config, 'REST_PAUSE')) return [...series];
  const alvo = grupo.series[grupo.series.length - 1];
  if (!alvo || papelDe(config, alvo.tipo) !== 'TRABALHO') return [...series];
  const tecnica = tecnicaVazia('REST_PAUSE', padraoDaTecnica(config, 'REST_PAUSE'));
  return series.map((s) => (s.uid === alvo.uid ? { ...s, tecnica } : s));
}
