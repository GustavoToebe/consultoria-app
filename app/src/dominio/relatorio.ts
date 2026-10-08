import type { DiaDeTreino, Sessao } from '../api/tipos';
import { diaDaSemanaIso } from './formatos';
import { nomeComDia } from './semana';

/**
 * Cargas por divisão (como o relatório do protótipo): divisão do plano → exercício → uma linha por dia com a carga
 * de trabalho e as repetições. Só mostra o que o aluno registrou; o que falta é "—" (nunca presumido).
 */

export interface LinhaCarga {
  data: string;
  /** Maior carga entre as séries de trabalho do dia; `null` se não houve série de trabalho com carga. */
  carga: number | null;
  /** Repetições da série de trabalho de maior carga. */
  repeticoes: number | null;
  /** Séries registradas como feitas no dia. */
  series: number;
  semCarga: boolean;
  observacoes: string[];
}

export interface ExercicioRelatorio {
  chave: string;
  nome: string;
  linhas: LinhaCarga[];
}

export interface DivisaoRelatorio {
  chave: string;
  nome: string;
  exercicios: ExercicioRelatorio[];
}

const chaveDoNome = (nome: string) => nome.trim().toLowerCase();

/**
 * @param sessoesDoPlano sessões do plano atual (por uid), para dar o dia ("Quarta - Pernas") e a ordem da semana.
 *   Sem elas, a divisão usa o nome gravado e a ordem do dia em que o aluno mais treinou.
 */
export function cargasPorDivisao(dias: DiaDeTreino[], sessoesDoPlano?: Map<string, Sessao>): DivisaoRelatorio[] {
  const divisoes = new Map<string, DivisaoRelatorio & { ordem: number[] }>();
  for (const dia of [...dias].sort((a, b) => a.data.localeCompare(b.data))) {
    for (const s of dia.sessoes) {
      const doPlano = sessoesDoPlano?.get(s.sessaoUid);
      const nome = doPlano ? nomeComDia(doPlano, ' - ') : s.sessao;
      const chave = chaveDoNome(nome);
      const divisao = divisoes.get(chave) ?? { chave, nome, exercicios: [], ordem: [] };
      divisoes.set(chave, divisao);
      divisao.ordem.push(doPlano?.diaSemana ?? diaDaSemanaIso(dia.data));
      for (const e of s.exercicios) {
        const feitas = e.series.filter((x) => x.concluida);
        if (!feitas.length) continue;
        const chaveEx = e.exercicioId ?? chaveDoNome(e.nome);
        let exercicio = divisao.exercicios.find((x) => x.chave === chaveEx);
        if (!exercicio) {
          exercicio = { chave: chaveEx, nome: e.nome, linhas: [] };
          divisao.exercicios.push(exercicio);
        }
        const trabalho = feitas
          .filter((x) => x.trabalho && x.carga !== null)
          .sort((a, b) => (b.carga ?? 0) - (a.carga ?? 0))[0];
        exercicio.linhas.push({
          data: dia.data,
          carga: trabalho?.carga ?? null,
          repeticoes: trabalho ? trabalho.repeticoes : null,
          series: feitas.length,
          semCarga: feitas.every((x) => x.unidade === 'nenhuma'),
          observacoes: feitas.map((x) => x.observacao?.trim()).filter((o): o is string => !!o),
        });
      }
    }
  }
  return [...divisoes.values()]
    .filter((d) => d.exercicios.length)
    .map((d) => ({ divisao: { chave: d.chave, nome: d.nome, exercicios: d.exercicios }, ordem: moda(d.ordem) }))
    .sort((a, b) => a.ordem - b.ordem || a.divisao.nome.localeCompare(b.divisao.nome))
    .map((x) => x.divisao);
}

/** Total de linhas (exercício × dia) do relatório. */
export function totalDeRegistros(divisoes: DivisaoRelatorio[]): number {
  return divisoes.reduce((n, d) => n + d.exercicios.reduce((m, e) => m + e.linhas.length, 0), 0);
}

function moda(valores: number[]): number {
  const contagem = new Map<number, number>();
  for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  return [...contagem].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 99;
}
