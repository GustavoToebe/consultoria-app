import type { DiaDeTreino, EtapaRegistrada, SerieFeita, Sessao } from '../api/tipos';
import { cargaComum, somarVolumes, volumeDaSerie, type Volume } from './etapas';
import { DIAS_SEMANA } from './editorTreino';
import { diaDaSemanaIso, somarDias } from './formatos';
import { nomeComDia } from './semana';
import { textoDaCarga, type UnidadeDeCarga } from './unidadeDeCarga';

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
  /**
   * Série de trabalho registrada por etapa (Cluster, Rest-pause): as repetições de cada etapa, o total quando o servidor o
   * calculou e "parcial" quando faltou etapa ("4+4+4+2 = 14"); `null` nas outras séries.
   */
  etapas: string | null;
  /** As etapas feitas têm cargas diferentes: a carga fica `null` e a linha diz "carga variável" (nunca a maior nem a última). */
  cargaVariavel: boolean;
  /** Volume de carga do exercício no dia, o mesmo do histórico; `null` sem carga ou sem número. */
  volume: Volume | null;
  /** Séries com algo registrado no dia. */
  series: number;
  semCarga: boolean;
  /**
   * Só havia série de trabalho feita sem carga (exercício com peso): a linha diz "Feito, sem carga" (D4). É a única exceção ao
   * "—" na tabela; `repeticoes` leva as da série, se o aluno as informou.
   */
  feitoSemCarga: boolean;
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
 * Nome da divisão de uma sessão registrada, o mesmo das "Cargas por divisão": com o plano, o dia e o nome ("Quarta -
 * Pernas"); sem ele, o nome gravado no registro. A visão por semana usa este nome para dar a mesma letra e a mesma cor.
 */
export function nomeDaDivisao(s: { sessaoUid: string; sessao: string }, sessoesDoPlano?: Map<string, Sessao>): string {
  const doPlano = sessoesDoPlano?.get(s.sessaoUid);
  return doPlano ? nomeComDia(doPlano, ' - ') : s.sessao;
}

/**
 * @param sessoesDoPlano sessões do plano atual (por uid), para dar o dia ("Quarta - Pernas") e a ordem da semana.
 *   Sem elas, a divisão usa o nome gravado e a ordem do dia em que o aluno mais treinou.
 */
export function cargasPorDivisao(dias: DiaDeTreino[], sessoesDoPlano?: Map<string, Sessao>): DivisaoRelatorio[] {
  const divisoes = new Map<string, DivisaoRelatorio & { ordem: number[] }>();
  for (const dia of [...dias].sort((a, b) => a.data.localeCompare(b.data))) {
    for (const s of dia.sessoes) {
      const doPlano = sessoesDoPlano?.get(s.sessaoUid);
      const nome = nomeDaDivisao(s, sessoesDoPlano);
      const chave = chaveDoNome(nome);
      const divisao = divisoes.get(chave) ?? { chave, nome, exercicios: [], ordem: [] };
      divisoes.set(chave, divisao);
      divisao.ordem.push(doPlano?.diaSemana ?? diaDaSemanaIso(dia.data));
      for (const e of s.exercicios) {
        const feitas = e.series.filter(registrada);
        if (!feitas.length) continue;
        const chaveEx = e.exercicioId ?? chaveDoNome(e.nome);
        let exercicio = divisao.exercicios.find((x) => x.chave === chaveEx);
        if (!exercicio) {
          exercicio = { chave: chaveEx, nome: e.nome, linhas: [] };
          divisao.exercicios.push(exercicio);
        }
        const doTrabalho = feitas.filter((x) => x.trabalho);
        const comCarga = doTrabalho.filter((x) => x.carga !== null).sort((a, b) => (b.carga ?? 0) - (a.carga ?? 0))[0];
        // Sem série de trabalho de carga única, a por etapas sem carga comum ainda mostra os blocos; a carga fica de fora.
        const trabalho = comCarga ?? doTrabalho.find((x) => x.etapas);
        const feitaSemCarga = trabalho ? undefined : doTrabalho.find((x) => x.unidade !== 'nenhuma' && x.carga === null);
        exercicio.linhas.push({
          data: dia.data,
          carga: trabalho?.carga ?? null,
          repeticoes: trabalho ? trabalho.repeticoes : (feitaSemCarga?.repeticoes ?? null),
          feitoSemCarga: !!feitaSemCarga,
          etapas: trabalho?.etapas ? repeticoesDasEtapas(trabalho) : null,
          cargaVariavel: !!trabalho && trabalho.carga === null && temCargasDiferentes(trabalho),
          volume: volumeDoExercicio(e.series),
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

/** Série feita sem carga e sem repetições no histórico (D4): no lugar do "—". */
export const TEXTO_FEITO_SEM_CARGA = 'feito, sem carga';

/**
 * "WS 32 kg × 5"; o que o aluno não informou numa série feita é dito por extenso (nunca presumido): "WS feito, sem carga",
 * "WS sem carga × 7", "WS 60 kg × sem repetições" (só em série concluída); série não marcada, o que falta é "—". Série sem carga e sem repetições (cardio,
 * que o aluno só marca) sai "Cardio feito"; não marcada, "Cardio —". Série registrada por etapa (Cluster, Rest-pause) mostra
 * cada etapa feita: "WS 40 kg × 4+4+4+2 = 14", com carga variável "WS 40 kg × 4 + 42,5 kg × 4 = 8"; o total só aparece
 * quando o servidor o calculou (todas as etapas com situação), senão a linha diz "parcial".
 */
export function textoSerie(s: SerieFeita, unidade: UnidadeDeCarga = 'kg'): string {
  const tipo = s.tipo?.trim() || 'Série';
  if (s.etapas) return `${tipo} ${textoDasEtapas(s, s.etapas, unidade)}`;
  if (s.unidade === 'nenhuma' && s.repeticoes == null && s.carga == null) return `${tipo} ${s.concluida ? 'feito' : '—'}`;
  if (s.unidade === 'nenhuma') return `${tipo} ${s.repeticoes ?? '—'}`;
  // D4 (02/11): o que o aluno não informou numa série feita é dito por extenso, não "—".
  if (s.carga == null && s.repeticoes == null) return `${tipo} ${s.concluida ? TEXTO_FEITO_SEM_CARGA : '—'}`;
  // "Sem carga"/"sem repetições" só numa série concluída; na não marcada a ausência é "—".
  const falta = (texto: string) => (s.concluida ? texto : '—');
  const carga = s.carga == null ? falta('sem carga') : textoDaCarga(s.carga, unidade);
  return `${tipo} ${carga} × ${s.repeticoes ?? falta('sem repetições')}`;
}

const repsDaEtapa = (e: EtapaRegistrada) => (e.repeticoes == null ? '—' : String(e.repeticoes));

/** As etapas em ordem, as feitas e o fecho do texto: total (só se o servidor o calculou) e "(parcial, N etapas não feitas)". */
function partesDasEtapas(s: SerieFeita, etapas: readonly EtapaRegistrada[]) {
  const ordem = [...etapas].sort((a, b) => a.posicao - b.posicao);
  const feitas = ordem.filter((e) => e.situacao === 'FEITA');
  const naoFeitas = ordem.length - feitas.length;
  const notas: string[] = [];
  if (s.repeticoes == null) notas.push('parcial');
  if (naoFeitas) notas.push(`${naoFeitas} ${naoFeitas === 1 ? 'etapa não feita' : 'etapas não feitas'}`);
  const sufixo = notas.length ? ` (${notas.join(', ')})` : '';
  const total = s.repeticoes != null && feitas.length > 1 ? ` = ${s.repeticoes}` : '';
  const semFeita = `${ordem.length ? 'não feita' : '—'}${sufixo}`;
  return { feitas, sufixo, total, semFeita };
}

function textoDasEtapas(s: SerieFeita, etapas: readonly EtapaRegistrada[], unidade: UnidadeDeCarga): string {
  const { feitas, sufixo, total, semFeita } = partesDasEtapas(s, etapas);
  if (!feitas.length) return semFeita;
  let corpo: string;
  if (s.unidade === 'nenhuma') corpo = feitas.map(repsDaEtapa).join('+');
  else {
    const comum = cargaComum(feitas);
    corpo = comum != null
      ? `${textoDaCarga(comum, unidade)} × ${feitas.map(repsDaEtapa).join('+')}`
      : feitas.map((e) => `${textoDaCarga(e.carga, unidade)} × ${repsDaEtapa(e)}`).join(' + ');
  }
  return `${corpo}${total}${sufixo}`;
}

/**
 * Só as repetições da série registrada por etapa, sem a carga ("4+4+4+2 = 14", "4+4 (parcial)"), para a coluna de reps do
 * relatório de cargas. Mesmo total e mesmas notas do `textoSerie`; sem etapas, o texto da série sem detalhe.
 */
export function repeticoesDasEtapas(s: SerieFeita): string {
  const { feitas, sufixo, total, semFeita } = partesDasEtapas(s, s.etapas ?? []);
  if (!feitas.length) return semFeita;
  return `${feitas.map(repsDaEtapa).join('+')}${total}${sufixo}`;
}

/** Série com algo registrado: por etapa, ao menos uma etapa feita (a parcial entra); nas outras, a concluída. */
function registrada(s: SerieFeita): boolean {
  return s.etapas ? s.etapas.some((e) => e.situacao === 'FEITA') : s.concluida;
}

/** Toda etapa feita tem carga e não há carga comum: as cargas são diferentes ("carga variável"). */
function temCargasDiferentes(s: SerieFeita): boolean {
  if (!s.etapas || s.unidade === 'nenhuma') return false;
  const feitas = s.etapas.filter((e) => e.situacao === 'FEITA');
  return feitas.length > 0 && feitas.every((e) => e.carga != null) && cargaComum(feitas) == null;
}

/**
 * Volume de carga registrado num exercício (carga × repetições, etapa por etapa), para a linha do histórico. `null` quando
 * o exercício é sem carga ou nada tem número; `completo: false` = faltou carga ou repetição em alguma parte feita, e o
 * valor é só um subtotal.
 */
export function volumeDoExercicio(series: readonly SerieFeita[]): Volume | null {
  const comCarga = series.filter((s) => s.unidade !== 'nenhuma');
  const feitas = comCarga.filter(registrada);
  if (!feitas.length) return null;
  return somarVolumes(feitas.map((s) => volumeDaSerie(s, false)), feitas.length);
}

/** "Volume de carga: 1240 kg" ou "Volume de carga: subtotal de 800 kg (faltou carga ou repetição)". */
export function textoDoVolume(v: Volume | null, unidade: UnidadeDeCarga = 'kg'): string | null {
  if (!v) return null;
  const valor = textoDaCarga(v.valor, unidade);
  return v.completo ? `Volume de carga: ${valor}` : `Volume de carga: subtotal de ${valor} (faltou carga ou repetição)`;
}

/**
 * Quantas versões do plano (`planoVersaoId`) têm registro no período. O registro só traz o id da versão que o aluno
 * executou, sem o plano nem o número dela: ids diferentes podem ser versões do mesmo plano ou planos diferentes. Por isso o
 * nome honesto é "mais de uma versão publicada executada". Sessão sem exercício com série não conta (nada foi registrado).
 */
export function versoesDoPlanoNoPeriodo(dias: readonly DiaDeTreino[]): number {
  const versoes = new Set<string>();
  for (const d of dias) {
    for (const s of d.sessoes) {
      if (s.exercicios.some((e) => e.series.length > 0)) versoes.add(s.planoVersaoId);
    }
  }
  return versoes.size;
}

/** O período mistura registros de mais de uma versão publicada do plano (a tela pode avisar que as divisões podem ter mudado). */
export const periodoMisturaVersoes = (dias: readonly DiaDeTreino[]): boolean => versoesDoPlanoNoPeriodo(dias) > 1;

export const TEXTO_SEM_REGISTROS_NO_PERIODO = 'Nenhum registro neste período.';
/** Há registro, mas nenhuma série de trabalho completa (com carga e repetições): não há o que mostrar no progresso (N4). */
export const TEXTO_SEM_PROGRESSO_NO_PERIODO = 'Nenhuma série completa, com carga e repetições, neste período.';
/** Onde ligar os gráficos muda com o papel: o treinador tem Perfil › Preferências; o aluno, a Conta. */
export const TEXTO_GRAFICOS_DESLIGADOS = 'Os gráficos estão desligados em Perfil › Preferências.';
export const TEXTO_GRAFICOS_DESLIGADOS_ALUNO = 'Os gráficos estão desligados em Conta › Aparência e preferências.';
/** Linha extra quando o período tem registros de mais de uma versão publicada do plano (`periodoMisturaVersoes`). */
export const TEXTO_PERIODO_MISTURA_VERSOES = 'Este período tem registros de mais de uma versão do plano; as divisões podem ter mudado.';

export type PapelDoHistorico = 'ALUNO' | 'TREINADOR';

/**
 * Texto do estado vazio do histórico (B6: a tela ficava em branco e o aluno não sabia o porquê). Sem registro, o período
 * está vazio; com registro e gráficos desligados (preferência `graficos`), a parte de gráfico some e a tela diz onde ligar
 * (o caminho depende do papel); com registro e gráficos ligados não há estado vazio (`null`).
 */
export function textoDoHistoricoVazio({ temRegistros, graficosLigados, papel = 'TREINADOR', semProgresso = false }: { temRegistros: boolean; graficosLigados: boolean; papel?: PapelDoHistorico; semProgresso?: boolean }): string | null {
  if (!temRegistros) return TEXTO_SEM_REGISTROS_NO_PERIODO;
  if (semProgresso) return TEXTO_SEM_PROGRESSO_NO_PERIODO;
  if (graficosLigados) return null;
  return papel === 'ALUNO' ? TEXTO_GRAFICOS_DESLIGADOS_ALUNO : TEXTO_GRAFICOS_DESLIGADOS;
}
