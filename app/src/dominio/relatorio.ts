import type { DiaDeTreino, EtapaRegistrada, SerieFeita, Sessao } from '../api/tipos';
import { cargaComum, somarVolumes, volumeDaSerie, type Volume } from './etapas';
import { DIAS_SEMANA } from './editorTreino';
import { diaDaSemanaIso, numeroParaTela, somarDias } from './formatos';
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

/** Só as sessões com `uid` no conjunto (plano escolhido); dias que ficam sem sessão saem. `null` = todos os planos. */
/** Ficha do aluno: últimos N dias até hoje. Dentro da pasta: exatamente o período cadastrado nela. */
export function intervaloDeRegistros(hoje: string, dias: number, pasta?: { inicio: string | null; fim: string | null }) {
  if (pasta?.inicio && pasta.fim) return { de: pasta.inicio, ate: pasta.fim };
  return { de: somarDias(hoje, -(dias - 1)), ate: hoje };
}

export const SEM_GRUPO = 'Sem grupo';
/**
 * Opções do "Progresso por exercício": grupos musculares (da biblioteca, em ordem alfabética; sem grupo por último) e
 * os exercícios com série de trabalho registrada, filtrados pelo grupo escolhido.
 */
export function opcoesDeProgresso(dias: DiaDeTreino[], grupo: string | null) {
  const exercicios = new Map<string, { valor: string; rotulo: string; grupo: string }>();
  for (const d of dias) for (const s of d.sessoes) for (const e of s.exercicios) {
    if (e.exercicioId && !exercicios.has(e.exercicioId) && e.series.some((x) => x.trabalho))
      exercicios.set(e.exercicioId, { valor: e.exercicioId, rotulo: e.nome, grupo: e.grupoMuscular || SEM_GRUPO });
  }
  const todos = [...exercicios.values()];
  const grupos = [...new Set(todos.map((e) => e.grupo))]
    .sort((a, b) => (a === SEM_GRUPO ? 1 : b === SEM_GRUPO ? -1 : a.localeCompare(b, 'pt-BR')));
  return { grupos, exercicios: grupo ? todos.filter((e) => e.grupo === grupo) : todos };
}

export function filtrarPorSessoes(dias: DiaDeTreino[], uids: Set<string> | null): DiaDeTreino[] {
  if (!uids) return dias;
  return dias
    .map((d) => ({ ...d, sessoes: d.sessoes.filter((s) => uids.has(s.sessaoUid)) }))
    .filter((d) => d.sessoes.length > 0);
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

const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Separa o dia do nome da divisão para a faixa do relatório: "Terça - Peito+Ombros" → dia "Terça", título
 * "Peito+Ombros". Sem dia no começo (ou só o dia), o nome inteiro é o título. O texto do treinador não muda.
 */
export function partesDaDivisao(nome: string): { dia: string | null; titulo: string } {
  const limpo = nome.trim();
  const dia = DIAS_SEMANA.find((d) => semAcento(limpo).startsWith(semAcento(d)));
  if (!dia) return { dia: null, titulo: limpo };
  const resto = limpo.slice(dia.length).replace(/^\s*(-feira)?\s*[-–—·:|]?\s*/i, '').trim();
  return resto ? { dia, titulo: resto } : { dia: null, titulo: limpo };
}

/** Data (ISO) do registro mais recente da divisão, ou `null` sem registro. */
export function ultimoRegistroDaDivisao(d: DivisaoRelatorio): string | null {
  let ultima: string | null = null;
  for (const e of d.exercicios) for (const l of e.linhas) if (!ultima || l.data > ultima) ultima = l.data;
  return ultima;
}

/**
 * "WS 32 kg × 5"; o que o aluno não informou aparece como "—" (nunca presumido). Série sem carga e sem repetições (cardio,
 * que o aluno só marca) sai "Cardio feito"; não marcada, "Cardio —". Série registrada por etapa (Cluster, Rest-pause) mostra
 * cada etapa feita: "WS 40 kg × 4+4+4+2 = 14", com carga variável "WS 40 kg × 4 + 42,5 kg × 4 = 8"; o total só aparece
 * quando o servidor o calculou (todas as etapas com situação), senão a linha diz "parcial".
 */
export function textoSerie(s: SerieFeita): string {
  const tipo = s.tipo?.trim() || 'Série';
  if (s.etapas) return `${tipo} ${textoDasEtapas(s, s.etapas)}`;
  if (s.unidade === 'nenhuma' && s.repeticoes == null && s.carga == null) return `${tipo} ${s.concluida ? 'feito' : '—'}`;
  const carga = s.unidade === 'nenhuma' ? '' : `${numeroParaTela(s.carga)} kg × `;
  return `${tipo} ${carga}${s.repeticoes ?? '—'}`;
}

function textoDasEtapas(s: SerieFeita, etapas: readonly EtapaRegistrada[]): string {
  const ordem = [...etapas].sort((a, b) => a.posicao - b.posicao);
  const feitas = ordem.filter((e) => e.situacao === 'FEITA');
  const naoFeitas = ordem.length - feitas.length;
  const notas: string[] = [];
  if (s.repeticoes == null) notas.push('parcial');
  if (naoFeitas) notas.push(`${naoFeitas} ${naoFeitas === 1 ? 'etapa não feita' : 'etapas não feitas'}`);
  const sufixo = notas.length ? ` (${notas.join(', ')})` : '';
  if (!feitas.length) return `${ordem.length ? 'não feita' : '—'}${sufixo}`;
  const reps = (e: EtapaRegistrada) => (e.repeticoes == null ? '—' : String(e.repeticoes));
  let corpo: string;
  if (s.unidade === 'nenhuma') corpo = feitas.map(reps).join('+');
  else {
    const comum = cargaComum(feitas);
    corpo = comum != null
      ? `${numeroParaTela(comum)} kg × ${feitas.map(reps).join('+')}`
      : feitas.map((e) => `${numeroParaTela(e.carga)} kg × ${reps(e)}`).join(' + ');
  }
  const total = s.repeticoes != null && feitas.length > 1 ? ` = ${s.repeticoes}` : '';
  return `${corpo}${total}${sufixo}`;
}

/**
 * Volume de carga registrado num exercício (carga × repetições, etapa por etapa), para a linha do histórico. `null` quando
 * o exercício é sem carga ou nada tem número; `completo: false` = faltou carga ou repetição em alguma parte feita, e o
 * valor é só um subtotal.
 */
export function volumeDoExercicio(series: readonly SerieFeita[]): Volume | null {
  const comCarga = series.filter((s) => s.unidade !== 'nenhuma');
  const feitas = comCarga.filter((s) => (s.etapas ? s.etapas.some((e) => e.situacao === 'FEITA') : s.concluida));
  if (!feitas.length) return null;
  return somarVolumes(feitas.map((s) => volumeDaSerie(s, false)), feitas.length);
}

/** "Volume de carga: 1240 kg" ou "Volume de carga: subtotal de 800 kg (faltou carga ou repetição)". */
export function textoDoVolume(v: Volume | null): string | null {
  if (!v) return null;
  const valor = `${numeroParaTela(v.valor)} kg`;
  return v.completo ? `Volume de carga: ${valor}` : `Volume de carga: subtotal de ${valor} (faltou carga ou repetição)`;
}
