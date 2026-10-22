import type { Configuracao, Sessao } from '../api/tipos';
import { posicaoNoGrupo } from '../dominio/combinacoes';

/**
 * Descanso que começa ao marcar uma série como feita. Exercício solto (ou membro de pré e pós-exaustão): o descanso da
 * própria série. Membro de superset, agonista-antagonista, tri-set, giant set ou circuito: o descanso por série dos membros
 * não vale; vale o descanso depois do grupo, e só quando a marcação fecha uma VOLTA, isto é, quando a série de mesma
 * posição (a 1ª, a 2ª...) de todos os membros que a têm já está feita. A regra não depende da ordem em que o aluno marca.
 * Nulo = nenhum descanso automático (o aluno ainda inicia um à mão).
 *
 * `concluida` diz se a série JÁ estava feita antes desta marcação (o estado atual); uma série já feita não reinicia o descanso.
 */
export function descansoAoMarcar(args: {
  sessao: Pick<Sessao, 'exercicios'> & Partial<Pick<Sessao, 'grupos'>>;
  exercicioUid: string;
  serieUid: string;
  concluida: (serieUid: string) => boolean;
  metodologia?: Configuracao | null;
}): number | null {
  const { sessao, exercicioUid, serieUid, concluida, metodologia } = args;
  if (concluida(serieUid)) return null;
  const indice = sessao.exercicios.findIndex((e) => e.uid === exercicioUid);
  const exercicio = sessao.exercicios[indice];
  const serie = exercicio?.series.find((s) => s.uid === serieUid);
  if (!exercicio || !serie) return null;

  const noGrupo = posicaoNoGrupo(sessao, indice, metodologia);
  if (!noGrupo || noGrupo.descansoPorSerie) return serie.descansoSegundos && serie.descansoSegundos > 0 ? serie.descansoSegundos : null;

  const apos = noGrupo.descansoAposSegundos;
  if (!apos || apos <= 0) return null;
  const volta = exercicio.series.findIndex((s) => s.uid === serieUid);
  const fechaAVolta = noGrupo.grupo.exercicios.every((m) => {
    const s = m.series[volta];
    return !s || s.uid === serieUid || concluida(s.uid);
  });
  return fechaAVolta ? apos : null;
}
