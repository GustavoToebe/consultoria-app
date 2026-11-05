import type { Configuracao, ExercicioPlano, OrigemDaReferencia, Serie, UltimaCarga } from '../api/tipos';
import { textoCardio, textoCarga, textoDasRepeticoes, textoEsforco, textoTecnica } from './agrupamento';
import { numeroParaTela } from './formatos';
import { kgParaTela, passoNaTela, telaParaKg, textoDaCarga, textoDoPasso, type UnidadeDeCarga } from './unidadeDeCarga';
import { tipoTrabalho as tipoTrabalhoDaMetodologia } from './metodologia';
import { cargaIlegivel } from './modoDeCarga';
import { temEtapaEmPercentual } from './validacaoDeSerie';

/**
 * Sugestão de carga do aluno. Só aplica o que o treinador escreveu no plano sobre a carga de
 * trabalho que o próprio aluno informa e sobre o que ele já registrou hoje: nunca inventa carga nem repetição.
 * Sugestão é só sugestão; o que o aluno digita é gravado exatamente como digitou.
 *
 * Série de trabalho = `carga.modo === 'CARGA_TRABALHO'` (espelho de `Serie.deTrabalho()` da API). `CARGA_FIXA` (kg escritos
 * pelo treinador) não é de trabalho e não serve de base para "% da WS". O rótulo
 * `tipoTrabalho` ("WS") só aparece nos textos; nunca se compara com `Serie.tipo`, que é código.
 */

/** Dupla progressão da série de trabalho (N16): subir a carga ou buscar as repetições da meta. */
export type ProgressaoDeCarga = 'SUBIR_CARGA' | 'BUSCAR_REPS';

export interface ProgressaoDeTrabalho {
  /** Carga sugerida em kg. */
  sugestaoKg: number;
  /** Quanto a sugestão subiu em relação à última carga, em kg; 0 quando a carga fica. */
  incrementoKg: number;
  /** Repetições sugeridas; `null` quando a série não tem meta numérica. */
  sugestaoReps: number | null;
  progressao: ProgressaoDeCarga;
}

export interface SerieCalculada {
  serie: Serie;
  /** Carga sugerida em kg; `null` quando não há base ou a série não é por carga. */
  sugestao: number | null;
  /** Repetições sugeridas na série de trabalho; `null` nas outras e quando não há meta numérica. */
  sugestaoReps: number | null;
  /** Kg a mais que a última carga; `null` fora da progressão, 0 quando a carga fica. */
  incrementoKg: number | null;
  /** `null` quando esta série não entra na dupla progressão. */
  progressao: ProgressaoDeCarga | null;
  /** A referência externa usada (WS anterior ou base do dia); `null` nos modos que não têm (ver `referenciaDaSerie`). */
  referencia: ReferenciaDaCarga | null;
  /** Texto da meta: "Meta: 3 a 6 reps · 50% da WS", "Meta: AMRAP reps · 1 RIR". */
  meta: string;
}

/** Arredonda ao múltiplo do passo (0,25 / 0,5 / 1 / 2,5 kg), sem erro de ponto flutuante: ao mais próximo, ou para cima ou para baixo. */
export function arredondar(valor: number, passo: number, sentido: 'proximo' | 'cima' | 'baixo' = 'proximo'): number {
  if (!passo || passo <= 0) return valor;
  const q = Math.round((valor / passo) * 1e6) / 1e6;
  const n = sentido === 'cima' ? Math.ceil(q) : sentido === 'baixo' ? Math.floor(q) : Math.round(q);
  return Math.round(n * passo * 1000) / 1000;
}

const modo = (s: Serie) => s.carga?.modo ?? 'NENHUMA';

/** Série de trabalho: a referência da carga do dia. */
export const ehSerieDeTrabalho = (s: Serie): boolean => modo(s) === 'CARGA_TRABALHO';

/** Texto da meta da série, como o aluno vê na tela; série de cardio mostra a prescrição de cardio. */
export function metaDaSerie(s: Serie, tipoTrabalho: string, semCarga = false, metodologia?: Configuracao, unidade: UnidadeDeCarga = 'kg'): string {
  if (s.cardio) return `Meta: ${textoCardio(s.cardio)}`;
  const partes: string[] = [];
  partes.push(s.amrap ? 'AMRAP' : `${textoDasRepeticoes(s)} reps`);
  const esforco = textoEsforco(s.esforco);
  if (!semCarga && modo(s) === 'CARGA_TRABALHO') {
    partes.push('carga de trabalho');
  } else if (!semCarga) {
    const carga = textoCarga(s.carga, tipoTrabalho, unidade);
    if (carga) partes.push(carga);
  }
  if (esforco) partes.push(esforco);
  const tecnica = textoTecnica(s.tecnica, metodologia);
  if (tecnica) partes.push(tecnica);
  const alvo = s.alvoExtra?.trim();
  if (alvo) partes.push(alvo);
  return `Meta: ${partes.join(' · ')}`;
}

export interface ReferenciaDaCarga {
  valor: number;
  origem: OrigemDaReferencia;
}

/**
 * Referência do "% da WS" da série `indice`: a carga registrada hoje na última série de trabalho
 * ANTERIOR a ela no exercício; sem ela (a FS vem antes da WS, ou a WS ainda não foi feita), a carga de trabalho do dia.
 */
function referenciaDaWs(series: readonly Serie[], indice: number, cargaTrabalho: number | null, cargasDoDia: Record<string, number | null | undefined>): ReferenciaDaCarga | null {
  for (let i = indice - 1; i >= 0; i--) {
    if (!ehSerieDeTrabalho(series[i])) continue;
    const registrada = cargasDoDia[series[i].uid];
    if (typeof registrada === 'number') return { valor: registrada, origem: 'WS_ANTERIOR' };
  }
  return cargaTrabalho == null ? null : { valor: cargaTrabalho, origem: 'BASE_DO_DIA' };
}

/**
 * A referência externa da série, a que as etapas congelam ao registrar a primeira (docs/series-etapas.md): carga de
 * trabalho = a base do dia; "% da WS" = a referência da WS. Carga fixa e "sem carga" não têm referência externa.
 */
export function referenciaDaSerie(series: readonly Serie[], indice: number, cargaTrabalho: number | null, cargasDoDia: Record<string, number | null | undefined>): ReferenciaDaCarga | null {
  const s = series[indice];
  if (!s || s.cardio) return null;
  switch (modo(s)) {
    case 'CARGA_TRABALHO':
      return cargaTrabalho == null ? null : { valor: cargaTrabalho, origem: 'BASE_DO_DIA' };
    case 'PERCENTUAL_WS':
      return referenciaDaWs(series, indice, cargaTrabalho, cargasDoDia);
    default:
      // Sem referência externa própria, mas com etapa em % da WS (bloco ou retomada): a referência da WS.
      return temEtapaEmPercentual(s.tecnica) ? referenciaDaWs(series, indice, cargaTrabalho, cargasDoDia) : null;
  }
}

/** O modo de carga da série parte da referência externa (e então segue a referência congelada nas etapas)? */
export const modoComReferenciaExterna = (s: Serie): boolean => ['CARGA_TRABALHO', 'PERCENTUAL_WS'].includes(modo(s));

/** Sugestão da série sobre uma referência externa (a calculada agora ou a congelada nas etapas). */
export function sugestaoSobreReferencia(s: Serie, referencia: number | null, passo: number): number | null {
  if (referencia == null) return null;
  switch (modo(s)) {
    case 'CARGA_TRABALHO':
      return referencia;
    case 'PERCENTUAL_WS': {
      const percentual = s.carga?.percentualMin ?? null;
      return percentual == null ? null : arredondar((referencia * percentual) / 100, passo);
    }
    default:
      return null;
  }
}

/**
 * Última carga de trabalho do exercício: a data mais recente; no mesmo dia, a maior carga; no empate de carga, mais
 * repetições. Espelho de `HistoricoService.ultimasCargas`.
 */
export function melhorUltimaCarga(atual: UltimaCarga | null, candidata: UltimaCarga): UltimaCarga {
  if (!atual || candidata.data > atual.data) return candidata;
  if (candidata.data < atual.data) return atual;
  const cargaDa = (u: UltimaCarga) => u.carga ?? Number.NEGATIVE_INFINITY;
  if (cargaDa(candidata) > cargaDa(atual)) return candidata;
  if (cargaDa(candidata) < cargaDa(atual)) return atual;
  return (candidata.repeticoes ?? -1) > (atual.repeticoes ?? -1) ? candidata : atual;
}

/**
 * Dupla progressão da série de trabalho sobre o último treino (N16). Sobe 1 passo do arredondamento quando as
 * repetições bateram o topo da meta; senão mantém a carga e sugere uma repetição a mais, sem passar do topo.
 * AMRAP, técnica com etapas e série sem meta numérica ficam de fora (`null`: a sugestão continua a última carga).
 * Em libra, o passo é o da tela (`passoNaTela`) e volta a kg por `telaParaKg`, para o número em lb ficar exato.
 */
export function calcularProgressaoDeTrabalho(
  serie: Serie,
  ultima: { carga: number | null; repeticoes: number | null } | null,
  arredondamentoKg: number,
  unidade: UnidadeDeCarga = 'kg',
): ProgressaoDeTrabalho | null {
  if (!ehSerieDeTrabalho(serie) || serie.cardio) return null;
  if (ultima?.carga == null || ultima.carga <= 0) return null;
  if (serie.amrap || serie.tecnica != null || (serie.repsMin == null && serie.repsMax == null)) return null;
  const metaTopo = serie.repsMax ?? serie.repsMin;
  const metaPiso = serie.repsMin ?? serie.repsMax;
  if (metaTopo == null || metaPiso == null) return null;
  const bateu = ultima.repeticoes != null && ultima.repeticoes >= metaTopo;
  if (bateu) {
    const sugestaoKg = unidade === 'kg'
      ? arredondar(ultima.carga + arredondamentoKg, arredondamentoKg)
      : telaParaKg((kgParaTela(ultima.carga, 'lb') as number) + passoNaTela(arredondamentoKg, 'lb'), 'lb') as number;
    return {
      sugestaoKg,
      incrementoKg: Math.round((sugestaoKg - ultima.carga) * 1000) / 1000,
      sugestaoReps: metaPiso,
      progressao: 'SUBIR_CARGA',
    };
  }
  const sugestaoReps = ultima.repeticoes != null ? Math.min(metaTopo, Math.max(metaPiso, ultima.repeticoes + 1)) : metaPiso;
  return { sugestaoKg: ultima.carga, incrementoKg: 0, sugestaoReps, progressao: 'BUSCAR_REPS' };
}

/**
 * @param cargaTrabalho base do dia que o aluno digitou, ou a última carga quando a caixa está vazia (ou `null`).
 * @param cargasDoDia cargas já registradas hoje, por `serieUid` (para a referência das séries em %).
 *
 * Por forma de carga: `CARGA_TRABALHO` = a base do dia, ou a progressão (N16) quando a caixa está vazia e há última
 * carga; `PERCENTUAL_WS` = % da referência da WS (a registrada hoje, ou a base do dia — sem o incremento — enquanto a
 * WS não foi marcada); `CARGA_FIXA` = os kg do treinador, sem arredondar; `NENHUMA` = nada. Em faixa ("85 a 90%") vale
 * o percentual MÍNIMO. Resultado arredondado pelo passo da metodologia (exceto carga de trabalho digitada, que repete o número).
 */
export function calcularCargasDoExercicio(
  exercicio: ExercicioPlano,
  cargaTrabalho: number | null,
  cargasDoDia: Record<string, number | null | undefined>,
  config: {
    arredondamentoKg: number;
    tipoTrabalho: string;
    metodologia?: Configuracao;
    /** Última série de trabalho do exercício. Sem ela, não há progressão. */
    ultima?: { carga: number | null; repeticoes: number | null } | null;
    /** O aluno digitou a caixa "Carga de trabalho do dia": a sugestão usa esse número, sem progressão. */
    cargaManual?: boolean;
    unidade?: UnidadeDeCarga;
  },
): SerieCalculada[] {
  const semCarga = exercicio.unidade === 'nenhuma';
  const series = exercicio.series;

  return series.map((serie, indice) => {
    let sugestao: number | null = null;
    let sugestaoReps: number | null = null;
    let incrementoKg: number | null = null;
    let progressao: ProgressaoDeCarga | null = null;
    const carga = serie.carga;
    // Forma de carga que o app não conhece: sem sugestão e sem referência (a etapa em % congelaria uma base para uma carga
    // que o app não lê). O texto "atualize o app" vem do `metaDaSerie`.
    const ilegivel = cargaIlegivel(carga);
    const referencia = semCarga || ilegivel ? null : referenciaDaSerie(series, indice, cargaTrabalho, cargasDoDia);
    if (!semCarga && !ilegivel && !serie.cardio) {
      switch (modo(serie)) {
        case 'CARGA_TRABALHO': {
          const prog = config.cargaManual ? null : calcularProgressaoDeTrabalho(serie, config.ultima ?? null, config.arredondamentoKg, config.unidade ?? 'kg');
          if (prog) {
            sugestao = prog.sugestaoKg;
            sugestaoReps = prog.sugestaoReps;
            incrementoKg = prog.incrementoKg;
            progressao = prog.progressao;
          } else {
            sugestao = sugestaoSobreReferencia(serie, referencia?.valor ?? null, config.arredondamentoKg);
          }
          break;
        }
        case 'PERCENTUAL_WS':
          sugestao = sugestaoSobreReferencia(serie, referencia?.valor ?? null, config.arredondamentoKg);
          break;
        case 'CARGA_FIXA':
          sugestao = carga?.valorKg ?? null;
          break;
        default:
          break;
      }
    }
    // `meta` fica em kg: a tela do aluno monta o texto da meta em `aluno/serieDoAluno` (com a unidade dele) e não lê este campo.
    return { serie, sugestao, sugestaoReps, incrementoKg, progressao, referencia, meta: metaDaSerie(serie, config.tipoTrabalho, semCarga, config.metodologia) };
  });
}

/** Nomes que o texto da origem da carga usa: o da série de trabalho ("WS"). */
export interface NomesDaOrigem {
  /** Nome da série de trabalho quando a metodologia não o dá (o `tipoTrabalho` da configuração da tela). */
  tipoTrabalho?: string | null;
  metodologia?: Configuracao | null;
  /** Sem base do dia gravada a conta parte da última carga (D1): o texto diz "da última vez", não "da base do dia". */
  baseDaUltimaVez?: boolean;
  /** Unidade em que o aluno vê o passo da progressão. */
  unidade?: UnidadeDeCarga;
  /** Passo da metodologia. O texto da progressão mostra esse passo na unidade da tela. */
  arredondamentoKg?: number;
}

const SEM_NOME_DA_WS = 'carga de trabalho';

/**
 * De onde saiu a carga sugerida, em uma frase curta para o aluno ("80% da WS registrada nesta sessão", "80% da base do
 * dia"). Só descreve o que `calcularCargasDoExercicio` já fez (a origem de `referencia`, o modo e o percentual mínimo,
 * o mesmo número da conta): não calcula nada nem muda a sugestão. `null` quando não há sugestão ou a série não parte de
 * uma referência (cardio, sem carga, sem base...).
 * O nome da WS vem do tipo de trabalho da metodologia; sem ele, o `tipoTrabalho` informado; sem nenhum, "carga de trabalho".
 */
export function textoDaOrigem(calculada: SerieCalculada, nomes: NomesDaOrigem = {}): string | null {
  const { serie, sugestao, referencia } = calculada;
  if (sugestao == null || serie.cardio) return null;
  const nomeDaWs = tipoTrabalhoDaMetodologia(nomes.metodologia) ?? (nomes.tipoTrabalho?.trim() || SEM_NOME_DA_WS);
  const min = serie.carga?.percentualMin ?? null;
  const max = serie.carga?.percentualMax ?? null;
  const percentual = min == null ? null : `${numeroParaTela(min)}%`;
  // Em faixa ("85% a 90%") a conta usa só o mínimo: o texto diz isso para o número não parecer errado ao lado da meta.
  const daFaixa = min != null && max != null && max > min ? ', mínimo da faixa' : '';
  const base = nomes.baseDaUltimaVez ? 'última vez' : 'base do dia';
  const daReferencia = referencia?.origem === 'WS_ANTERIOR' ? `da ${nomeDaWs} registrada nesta sessão` : `da ${base}`;

  switch (modo(serie)) {
    case 'CARGA_TRABALHO':
      if (!referencia) return null;
      if (nomes.baseDaUltimaVez && calculada.progressao === 'SUBIR_CARGA' && calculada.incrementoKg != null && calculada.incrementoKg > 0) {
        const passo = nomes.arredondamentoKg != null
          ? textoDoPasso(nomes.arredondamentoKg, nomes.unidade ?? 'kg')
          : textoDaCarga(calculada.incrementoKg, nomes.unidade ?? 'kg');
        return `meta batida na última vez (+${passo} pelo arredondamento da metodologia)`;
      }
      if (nomes.baseDaUltimaVez && calculada.progressao === 'BUSCAR_REPS') {
        return 'mesma carga da última vez · busque atingir a meta de repetições';
      }
      return `carga da ${base}`;
    case 'CARGA_FIXA':
      return 'carga definida pelo treinador';
    case 'PERCENTUAL_WS':
      return referencia && percentual ? `${percentual} ${daReferencia}${daFaixa}` : null;
    default:
      return null;
  }
}

/**
 * Alguma série seguinte parte da carga registrada nesta (A9, reunião de 30/10)? É o caso da WS para as séries em % dela
 * ou com etapa em % (enquanto nenhuma outra WS ficar entre elas). Só descreve a regra de
 * `calcularCargasDoExercicio` (a carga entra na conta das outras quando é registrada, com o ✓): não muda nada nela.
 */
export function seriesSeguintesDependemDesta(series: readonly Serie[], indice: number): boolean {
  const s = series[indice];
  if (!s || s.cardio || modo(s) === 'NENHUMA') return false;
  for (let j = indice + 1; j < series.length; j++) {
    const x = series[j];
    if (x.cardio) continue;
    if (ehSerieDeTrabalho(s) && (modo(x) === 'PERCENTUAL_WS' || temEtapaEmPercentual(x.tecnica))) {
      // A referência dela é a WS mais próxima antes dela: outra WS no meio passa a ser a dela.
      const outraWsNoMeio = series.slice(indice + 1, j).some(ehSerieDeTrabalho);
      if (!outraWsNoMeio) return true;
    }
  }
  return false;
}

/**
 * A carga que um registro do dia empresta às séries seguintes (referência da WS): só a de série marcada como feita (o ✓) ou, na série com etapas (Cluster, Rest pause), com alguma etapa
 * feita. Desmarcar a série tira a carga dela da conta: o aluno disse que não fez, e a sugestão das seguintes não parte de
 * uma carga desfeita (decisão do Gustavo, 31/10). Carga digitada e ainda não marcada também não conta, como o texto da
 * tela já diz ("depois que você registrar a WS, com o ✓").
 */
export function cargaQueContaComoReferencia(
  registro: { carga: number | null; concluida: boolean; etapas?: readonly { situacao: string }[] | null } | null | undefined,
): number | null {
  if (!registro || registro.carga == null) return null;
  const feita = registro.concluida || (registro.etapas ?? []).some((e) => e.situacao === 'FEITA');
  return feita ? registro.carga : null;
}

/** O exercício usa a carga de trabalho do dia (tem série de trabalho ou em % dela)? */
export function usaCargaDeTrabalho(exercicio: ExercicioPlano): boolean {
  return (
    exercicio.unidade !== 'nenhuma' &&
    !exercicio.series.some((s) => s.cardio) &&
    exercicio.series.some((s) => ['CARGA_TRABALHO', 'PERCENTUAL_WS'].includes(modo(s)))
  );
}

/**
 * Botões "+" e "−" da carga: andam de passo em passo do arredondamento da metodologia (a mesma fonte da sugestão).
 * Sem botões quando o exercício não usa carga ou o passo não é positivo. Nunca abaixo de 0; sem número digitado, parte
 * da sugestão e, sem ela, do 0.
 */
export function passoDaCarga(exercicio: Pick<ExercicioPlano, 'unidade'>, arredondamentoKg: number): number | null {
  if (exercicio.unidade === 'nenhuma') return null;
  return Number.isFinite(arredondamentoKg) && arredondamentoKg > 0 ? arredondamentoKg : null;
}

/**
 * `passo` é o `arredondamentoKg` (kg). Em kg soma em kg. Em libra soma `passoNaTela` ao número que a pessoa VÊ
 * (`kgParaTela`) e grava o equivalente em kg (`telaParaKg`): 100 lb + passo de 5 lb = 105 lb na tela, sem 105,5. Devolve sempre kg.
 */
export function ajustarCarga(atual: number | null, sugestao: number | null, passo: number, sentido: 1 | -1, unidade: UnidadeDeCarga = 'kg'): number {
  const base = atual ?? sugestao ?? 0;
  if (unidade === 'kg') return Math.max(0, Math.round((base + sentido * passo) * 1000) / 1000);
  const naTela = kgParaTela(base, unidade) as number;
  return telaParaKg(Math.max(0, Math.round((naTela + sentido * passoNaTela(passo, unidade)) * 10) / 10), unidade) as number;
}
