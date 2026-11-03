import type { CargaDaEtapa, EtapaRegistrada, OrigemDaReferencia, Retomada, Serie } from '../api/tipos';
import { faixa } from './agrupamento';
import { arredondar } from './cargas';
import { blocosValidos } from './blocos';
import { numeroParaTela } from './formatos';
import { textoDasRepeticoesDaSerie } from './resumoDaSerie';

/**
 * Etapas de uma série (docs/series-etapas.md): os blocos do Cluster ou a etapa inicial e as retomadas do Rest-pause. A
 * etapa é parte da série, nunca série nova; a posição (1 a N) na versão publicada a identifica. Espelho de
 * `ConteudoTreino.Serie.etapas()` e das contas do `SincronizacaoService` da API.
 */

export interface EtapaPrevista {
  posicao: number;
  /** "Bloco 2", "Etapa inicial", "Retomada 1". */
  rotulo: string;
  /** O que a etapa pede: "4 reps", "6 a 8 reps", "AMRAP", "até a falha". */
  meta: string;
  /** Repetições previstas quando são um número só (bloco do Cluster); nulo em faixa, AMRAP ou sem meta. */
  repsExatas: number | null;
  /** Carga prevista da etapa; `null` = a carga da série (sem carga própria). */
  carga: CargaDaEtapa | null;
}

/**
 * "2 reps", "2 a 3 reps" ou "AMRAP" de uma retomada; sem retomada escrita, "até a falha" (o Rest-pause de sempre: mesma
 * carga até a falha). Retomada sem número nem AMRAP não passa na publicação; aqui vira "—".
 */
export function metaDaRetomada(r: Retomada | null | undefined): string {
  if (!r) return 'até a falha';
  if (r.amrap === true) return 'AMRAP';
  const f = faixa({ repsMin: r.repsMin ?? null, repsMax: r.repsMax ?? null });
  return f ? `${f} ${r.repsMin === 1 && r.repsMax === 1 ? 'rep' : 'reps'}` : '—';
}

/** A carga da etapa só conta quando é percentual; "da série" equivale a não ter carga própria. */
const cargaPropria = (c: CargaDaEtapa | null | undefined): CargaDaEtapa | null => (c?.modo === 'PERCENTUAL_WS' ? c : null);

/** "90% da WS" (carga própria da etapa) ou `null` (a carga da série). */
export function textoDaCargaDaEtapa(c: CargaDaEtapa | null | undefined, ws: string | null | undefined): string | null {
  const propria = cargaPropria(c);
  if (!propria || propria.percentual == null) return null;
  return `${propria.percentual}%${ws ? ` da ${ws}` : ''}`;
}

/**
 * Carga sugerida de uma etapa: a da série quando a etapa não tem carga própria; com percentual, o percentual da
 * referência externa da série (a congelada na primeira etapa ou, antes dela, a de agora), arredondado pelo passo.
 * Nunca percentual sobre percentual: a referência é a mesma para todas as etapas.
 */
export function sugestaoDaEtapa(prevista: Pick<EtapaPrevista, 'carga'>, sugestaoDaSerie: number | null, referencia: number | null, passo: number): number | null {
  const propria = cargaPropria(prevista.carga);
  if (!propria) return sugestaoDaSerie;
  if (referencia == null || propria.percentual == null) return null;
  return arredondar((referencia * propria.percentual) / 100, passo);
}

/** Etapas previstas da série; `null` = a série se registra inteira (sem Cluster com blocos válidos nem Rest-pause). */
export function etapasDaSerie(s: Pick<Serie, 'tecnica' | 'cardio' | 'repsMin' | 'repsMax' | 'amrap'>): EtapaPrevista[] | null {
  const t = s.tecnica;
  if (!t || s.cardio) return null;
  if (t.tipo === 'CLUSTER') {
    if (!blocosValidos(t.blocos)) return null;
    return t.blocos!.map((reps, i) => ({
      posicao: i + 1,
      rotulo: `Bloco ${i + 1}`,
      meta: `${reps} ${reps === 1 ? 'rep' : 'reps'}`,
      repsExatas: reps,
      carga: cargaPropria(t.cargasDosBlocos?.[i]),
    }));
  }
  if (t.tipo === 'REST_PAUSE') {
    const pausas = t.pausas != null && t.pausas > 0 ? t.pausas : 1;
    const inicial: EtapaPrevista = {
      posicao: 1,
      rotulo: 'Etapa inicial',
      meta: textoDasRepeticoesDaSerie(s),
      repsExatas: !s.amrap && s.repsMin != null && s.repsMin === s.repsMax ? s.repsMin : null,
      carga: null,
    };
    const retomadas = Array.from({ length: pausas }, (_, i): EtapaPrevista => {
      const r = t.retomadas?.[i] ?? null;
      return {
        posicao: i + 2,
        rotulo: pausas === 1 ? 'Retomada' : `Retomada ${i + 1}`,
        meta: metaDaRetomada(r),
        repsExatas: r && r.amrap !== true && r.repsMin != null && r.repsMin === r.repsMax ? r.repsMin : null,
        carga: cargaPropria(r?.carga),
      };
    });
    return [inicial, ...retomadas];
  }
  return null;
}

/** Quantas etapas a série tem (`null` = registro da série inteira). */
export const quantidadeDeEtapas = (s: Pick<Serie, 'tecnica' | 'cardio' | 'repsMin' | 'repsMax' | 'amrap'>): number | null => etapasDaSerie(s)?.length ?? null;

/** A lista com a etapa trocada (ou acrescentada) pela posição, em ordem. */
export function comEtapa(etapas: readonly EtapaRegistrada[] | null | undefined, etapa: EtapaRegistrada): EtapaRegistrada[] {
  return [...(etapas ?? []).filter((e) => e.posicao !== etapa.posicao), etapa].sort((a, b) => a.posicao - b.posicao);
}

/** A lista sem a etapa da posição (volta a ficar pendente). */
export function semEtapa(etapas: readonly EtapaRegistrada[] | null | undefined, posicao: number): EtapaRegistrada[] {
  return (etapas ?? []).filter((e) => e.posicao !== posicao);
}

/** Primeira posição ainda pendente (nem feita nem marcada como não realizada); `null` quando todas têm situação. */
export function proximaPendente(etapas: readonly EtapaRegistrada[] | null | undefined, quantas: number): number | null {
  const com = new Set((etapas ?? []).map((e) => e.posicao));
  for (let p = 1; p <= quantas; p++) if (!com.has(p)) return p;
  return null;
}

/** Todas as etapas têm situação (feita ou não realizada): a série pode ser concluída. */
export const todasComSituacao = (etapas: readonly EtapaRegistrada[] | null | undefined, quantas: number): boolean => proximaPendente(etapas, quantas) === null;

/**
 * Total da série: a soma das repetições das etapas feitas, só quando nenhuma está pendente e toda feita tem repetições;
 * senão `null` (parcial). Igual ao `SincronizacaoService.totalDasEtapas`.
 */
export function totalDasEtapas(etapas: readonly EtapaRegistrada[] | null | undefined, quantas: number): number | null {
  const lista = etapas ?? [];
  const feitas = lista.filter((e) => e.situacao === 'FEITA');
  if (lista.length !== quantas || !feitas.length || feitas.some((e) => e.repeticoes == null)) return null;
  const total = feitas.reduce((soma, e) => soma + (e.repeticoes ?? 0), 0);
  return total > 500 ? null : total;
}

/** Repetições já informadas nas etapas feitas (para o "parcial"); `null` sem nenhuma. */
export function repeticoesInformadas(etapas: readonly EtapaRegistrada[] | null | undefined): number | null {
  const com = (etapas ?? []).filter((e) => e.situacao === 'FEITA' && e.repeticoes != null);
  return com.length ? com.reduce((soma, e) => soma + (e.repeticoes ?? 0), 0) : null;
}

/** Carga comum das etapas feitas; com cargas diferentes (ou alguma sem carga), `null` = "carga variável". */
export function cargaComum(etapas: readonly EtapaRegistrada[] | null | undefined): number | null {
  const cargas = (etapas ?? []).filter((e) => e.situacao === 'FEITA').map((e) => e.carga);
  if (!cargas.length || cargas.some((c) => c == null)) return null;
  return cargas.every((c) => c === cargas[0]) ? cargas[0] : null;
}

/**
 * Rodapé do cartão único da série com etapas (Frente G, D12): "Feito até agora: 8 de 10 reps" (com o total previsto quando
 * toda etapa pede um número exato, como os blocos do Cluster) ou "Feito até agora: 8 reps" (faixa, AMRAP, até a falha).
 * Soma só as repetições informadas nas etapas feitas; nunca inventa o que falta. Concluída, "Feito: …". Etapa marcada como
 * não feita e etapa feita sem repetições aparecem escritas, para a soma não parecer o total.
 */
export function feitoAteAgora(
  etapas: readonly EtapaRegistrada[] | null | undefined,
  previstas: readonly Pick<EtapaPrevista, 'repsExatas'>[],
  rotulo: 'blocos' | 'etapas',
  concluida = false,
): string {
  const lista = etapas ?? [];
  const feitas = lista.filter((e) => e.situacao === 'FEITA');
  const soma = feitas.reduce((total, e) => total + (e.repeticoes ?? 0), 0);
  const previsto = previstas.length && previstas.every((p) => p.repsExatas != null) ? previstas.reduce((t, p) => t + (p.repsExatas ?? 0), 0) : null;
  const bloco = rotulo === 'blocos';
  const contar = (n: number, final: string) => `${n} ${bloco ? (n === 1 ? 'bloco' : 'blocos') : (n === 1 ? 'etapa' : 'etapas')} ${final}`;
  const naoFeitas = lista.length - feitas.length;
  const semReps = feitas.filter((e) => e.repeticoes == null).length;
  const extras = [
    ...(naoFeitas ? [contar(naoFeitas, bloco ? (naoFeitas === 1 ? 'não feito' : 'não feitos') : (naoFeitas === 1 ? 'não feita' : 'não feitas'))] : []),
    ...(semReps ? [contar(semReps, 'sem repetições')] : []),
  ];
  const reps = previsto != null ? `${soma} de ${previsto} reps` : `${soma} ${soma === 1 ? 'rep' : 'reps'}`;
  return [`${concluida ? 'Feito' : 'Feito até agora'}: ${reps}`, ...extras].join(' · ');
}

/**
 * O que falta para concluir: "Falta o bloco 3 para concluir.", "Falta a retomada para concluir.", "Faltam 2 blocos para
 * concluir."; `null` quando toda etapa já tem situação (feita ou não feita).
 */
export function faltaParaConcluir(etapas: readonly EtapaRegistrada[] | null | undefined, previstas: readonly Pick<EtapaPrevista, 'posicao' | 'rotulo'>[]): string | null {
  const com = new Set((etapas ?? []).map((e) => e.posicao));
  const pendentes = previstas.filter((p) => !com.has(p.posicao));
  if (!pendentes.length) return null;
  const bloco = pendentes[0].rotulo.startsWith('Bloco');
  if (pendentes.length > 1) return `Faltam ${pendentes.length} ${bloco ? 'blocos' : 'etapas'} para concluir.`;
  return `Falta ${bloco ? 'o' : 'a'} ${pendentes[0].rotulo.toLowerCase()} para concluir.`;
}

export interface Volume {
  /** kg × reps somados etapa por etapa (ou da série inteira). */
  valor: number;
  /** Faltou carga ou repetição em alguma parte feita: o valor é só um subtotal. */
  completo: boolean;
}

/**
 * Volume de carga registrado de uma série: carga × repetições de cada etapa feita (ou da série inteira, sem etapas).
 * Exercício sem carga não tem volume (`null`, nunca zero); nada informado também é `null`.
 */
export function volumeDaSerie(s: { carga: number | null; repeticoes: number | null; concluida: boolean; etapas?: readonly EtapaRegistrada[] | null }, semCarga: boolean): Volume | null {
  if (semCarga) return null;
  if (s.etapas) {
    const feitas = s.etapas.filter((e) => e.situacao === 'FEITA');
    const medidas = feitas.filter((e) => e.carga != null && e.repeticoes != null);
    if (!medidas.length) return null;
    return { valor: medidas.reduce((soma, e) => soma + e.carga! * e.repeticoes!, 0), completo: medidas.length === feitas.length };
  }
  if (!s.concluida || s.carga == null || s.repeticoes == null) return null;
  return { valor: s.carga * s.repeticoes, completo: true };
}

/** Soma de volumes (de várias séries), sem dupla contagem: subtotal se alguma parte ficou sem número. */
export function somarVolumes(volumes: readonly (Volume | null)[], partes: number): Volume | null {
  const presentes = volumes.filter((v): v is Volume => v != null);
  if (!presentes.length) return null;
  return {
    valor: Math.round(presentes.reduce((soma, v) => soma + v.valor, 0) * 100) / 100,
    completo: presentes.length === partes && presentes.every((v) => v.completo),
  };
}

// ---- Ações do aluno numa série com etapas ----

export interface RegistroDeEtapas {
  etapas: EtapaRegistrada[];
  concluida: boolean;
  referenciaCarga: number | null;
  referenciaOrigem: OrigemDaReferencia | null;
}

/** O que as ações leem do registro guardado (o do aparelho tem `etapas` nulo quando a série ainda não tem detalhe). */
export interface RegistroAtual {
  etapas?: readonly EtapaRegistrada[] | null;
  concluida?: boolean;
  referenciaCarga?: number | null;
  referenciaOrigem?: OrigemDaReferencia | null;
}

export type AcaoNaEtapa =
  | { tipo: 'FEITA'; posicao: number; repeticoes: number | null; carga: number | null }
  | { tipo: 'EDITAR'; posicao: number; repeticoes?: number | null; carga?: number | null }
  | { tipo: 'NAO_REALIZADA'; posicao: number }
  | { tipo: 'DESFAZER'; posicao: number }
  | { tipo: 'CONCLUIR' }
  | { tipo: 'REABRIR' };

/** O que vai para o registro da série: a lista inteira, o total e a carga comum calculados como no servidor. */
export interface GravacaoDeEtapas extends RegistroDeEtapas {
  carga: number | null;
  repeticoes: number | null;
}

/**
 * Aplica uma ação do aluno. A referência da carga é congelada na primeira etapa feita (a que vale na hora) e não muda
 * depois. Concluir exige todas as etapas com situação; desfazer uma etapa reabre a série; editar números não muda a
 * situação. Nada é inventado: repetição vazia continua vazia, a meta não é copiada para o realizado.
 */
export function aplicarAcao(
  atual: RegistroAtual | null | undefined,
  acao: AcaoNaEtapa,
  quantas: number,
  referenciaAgora: { valor: number; origem: OrigemDaReferencia } | null,
): GravacaoDeEtapas | null {
  let etapas = [...(atual?.etapas ?? [])];
  let concluida = !!atual?.concluida;
  let referenciaCarga = atual?.referenciaCarga ?? null;
  let referenciaOrigem = atual?.referenciaOrigem ?? null;
  switch (acao.tipo) {
    case 'FEITA':
      etapas = comEtapa(etapas, { posicao: acao.posicao, repeticoes: acao.repeticoes, carga: acao.carga, situacao: 'FEITA' });
      if (referenciaCarga == null && referenciaAgora) {
        referenciaCarga = referenciaAgora.valor;
        referenciaOrigem = referenciaAgora.origem;
      }
      break;
    case 'EDITAR': {
      const existente = etapas.find((e) => e.posicao === acao.posicao);
      if (!existente || existente.situacao !== 'FEITA') return null;
      etapas = comEtapa(etapas, {
        ...existente,
        repeticoes: acao.repeticoes !== undefined ? acao.repeticoes : existente.repeticoes,
        carga: acao.carga !== undefined ? acao.carga : existente.carga,
      });
      break;
    }
    case 'NAO_REALIZADA':
      etapas = comEtapa(etapas, { posicao: acao.posicao, repeticoes: null, carga: null, situacao: 'NAO_REALIZADA' });
      break;
    case 'DESFAZER':
      etapas = semEtapa(etapas, acao.posicao);
      concluida = false;
      break;
    case 'CONCLUIR':
      if (!todasComSituacao(etapas, quantas)) return null;
      concluida = true;
      break;
    case 'REABRIR':
      concluida = false;
      break;
  }
  if (!etapas.length) {
    // Sem nenhuma etapa a referência deixa de valer: a próxima primeira etapa congela a de então.
    referenciaCarga = null;
    referenciaOrigem = null;
  }
  return { etapas, concluida, referenciaCarga, referenciaOrigem, carga: cargaComum(etapas), repeticoes: totalDasEtapas(etapas, quantas) };
}

/**
 * A ação liga a pausa entre etapas? Só ao marcar como feita uma etapa que não é a última e que ainda não está feita no
 * registro (depois da última vale o descanso da série, ao concluir). Editar ou repetir o registro já feito não liga;
 * desfazer e marcar de novo liga outra vez, porque o registro volta a não ter a etapa.
 */
export function ligaPausaInterna(atual: RegistroAtual | null | undefined, acao: AcaoNaEtapa, quantas: number): boolean {
  if (acao.tipo !== 'FEITA' || acao.posicao >= quantas) return false;
  return !(atual?.etapas ?? []).some((e) => e.posicao === acao.posicao && e.situacao === 'FEITA');
}

/**
 * Identifica a pausa nascida de uma etapa: `execucao` = versão do plano, série e data (`versaoId|serieUid|data`), então
 * outra versão, série, dia ou posição nunca cancela esta pausa.
 */
export function origemDaPausa(execucao: string, posicao: number): string {
  return `etapa:${execucao}|${posicao}`;
}

/**
 * O que a ação do aluno faz com o cronômetro: marcar (de novo, depois de desfazer) uma etapa que não é a última inicia a
 * pausa; desfazer cancela a pausa dessa etapa; o resto (editar, "não fiz", concluir, reabrir, repetir o mesmo registro)
 * não mexe nele. Desfazer nunca inicia pausa.
 */
export type PausaDaAcao = { iniciar: number } | { cancelar: number } | null;
export function pausaDaAcao(atual: RegistroAtual | null | undefined, acao: AcaoNaEtapa, quantas: number): PausaDaAcao {
  if (acao.tipo === 'DESFAZER') return { cancelar: acao.posicao };
  return ligaPausaInterna(atual, acao, quantas) && acao.tipo === 'FEITA' ? { iniciar: acao.posicao } : null;
}

/** "Referência: WS registrada antes, 42 kg" ou "Referência: base do dia, 40 kg"; `null` sem referência congelada. */
export function textoDaReferenciaCongelada(valor: number | null | undefined, origem: OrigemDaReferencia | null | undefined): string | null {
  if (valor == null || !origem) return null;
  return `Referência: ${origem === 'WS_ANTERIOR' ? 'WS registrada antes' : 'base do dia'}, ${numeroParaTela(valor)} kg`;
}
