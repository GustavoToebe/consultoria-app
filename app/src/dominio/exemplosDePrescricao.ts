import type { Configuracao, Esforco, Serie } from '../api/tipos';
import { agrupar, type GrupoDeSeries } from './agrupamento';
import { adicionarSerie, alterarGrupo, LIMITE_SERIES, novaSerie, tecnicaVazia } from './editorTreino';
import { codigoTrabalho, padraoDaTecnica, papelDe, tecnicaNaMetodologia } from './metodologia';

/** Quantidades do exemplo, só para mostrar a montagem. Não entram no padrão da metodologia. */
export const REPS_FS_DO_EXEMPLO = { min: 10, max: 15 } as const;
export const REPS_WS_DO_EXEMPLO = { min: 6, max: 8 } as const;
export const BLOCOS_DO_EXEMPLO_CLUSTER = [4, 4, 4, 4] as const;
export const PAUSA_DO_EXEMPLO_CLUSTER = 15;

export const TEXTO_DO_EXEMPLO =
  'Exemplo para ver a montagem. A pausa de 15 s é a do vídeo e continua editável. As quantidades não viram padrão dos alunos.';

export const TEXTO_SEQUENCIA_CLUSTER =
  'Exemplo editável: 1 série, 4 repetições, pausa, 4, pausa, 4, pausa, 4, fim.';

/** Série reaberta, esforço já mexido ou conteúdo substituído: não dá para afirmar de onde veio. */
export const TEXTO_REVISE_ESFORCO_CLUSTER = 'Revise o esforço desta série ao usar Cluster.';

/**
 * Com origem conhecida nesta abertura, a frase usa o nome do tipo. Sem nome, fala só "deste tipo".
 * Sem origem, pede revisão e não cita a WS.
 */
export function textoDaRevisaoDoEsforco(veioDoPadrao: boolean, nomeDoTipo?: string | null): string {
  if (!veioDoPadrao) return TEXTO_REVISE_ESFORCO_CLUSTER;
  const nome = nomeDoTipo?.trim();
  if (!nome) return 'Este esforço veio do padrão deste tipo. Revise a prescrição ao usar Cluster.';
  return `Este esforço veio do padrão da ${nome}. Revise a prescrição ao usar Cluster.`;
}

/** Valor do esforço no momento em que o tipo o preencheu. Não vai para o JSON. */
export function assinaturaDoEsforco(esforco: Esforco | null | undefined): string {
  const normal = esforco && (esforco.rir != null || esforco.rpe != null) ? { rir: esforco.rir ?? null, rpe: esforco.rpe ?? null } : null;
  return JSON.stringify(normal);
}

/** A marca só vale enquanto o esforço gravado continua sendo o que o tipo preencheu. */
export function esforcoAindaEhODoTipo(assinatura: string | undefined, esforco: Esforco | null | undefined): boolean {
  return assinatura != null && assinatura === assinaturaDoEsforco(esforco);
}

/** Origem em memória: o esforço e o tipo que a preencheram. Não vai para o JSON. */
export interface MarcaDeOrigem {
  assinatura: string;
  tipo: string | null;
}

export function marcaConfere(
  marca: MarcaDeOrigem | undefined,
  serie: { esforco?: Esforco | null; tipo?: string | null },
): boolean {
  return !!marca && marca.assinatura === assinaturaDoEsforco(serie.esforco) && marca.tipo === (serie.tipo ?? null);
}

/**
 * Conteúdo que chegou de fora (recarga, desfazer, receita). Tira a marca que o esforço ou o tipo atuais já não
 * sustentam. A marca apagada não volta se um número antigo reaparecer.
 */
export function origemAposConteudo<T extends { uid: string; esforco?: Esforco | null; tipo?: string | null }>(
  marcas: ReadonlyMap<string, MarcaDeOrigem>,
  series: readonly T[],
): ReadonlyMap<string, MarcaDeOrigem> {
  const porUid = new Map(series.map((s) => [s.uid, s]));
  let mudou = false;
  const n = new Map(marcas);
  for (const [uid, marca] of marcas) {
    const s = porUid.get(uid);
    if (!s || !marcaConfere(marca, s)) {
      n.delete(uid);
      mudou = true;
    }
  }
  return mudou ? n : marcas;
}

/**
 * Troca de tipo. Só marca origem quando um tipo da metodologia realmente preencheu o esforço das séries.
 * Código sem padrão devolve `null`: a origem anterior sai e a mensagem fica neutra.
 */
export function origemAoTrocarTipo(
  series: readonly { uid: string; esforco?: Esforco | null; tipo?: string | null }[],
  esforcoAplicado: Esforco | null | undefined,
): ReadonlyMap<string, MarcaDeOrigem> | null {
  if (!esforcoAplicado || (esforcoAplicado.rir == null && esforcoAplicado.rpe == null)) return null;
  const assinatura = assinaturaDoEsforco(esforcoAplicado);
  if (!series.every((s) => assinaturaDoEsforco(s.esforco) === assinatura)) return null;
  return new Map(series.map((s) => [s.uid, { assinatura, tipo: s.tipo ?? null }]));
}

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

/** Por que o botão do exemplo fica desligado; `undefined` quando pode aplicar. */
export function motivoDoExemploCluster(opcoes: {
  config: Configuracao | null | undefined;
  series: number;
  exemplo: 'fs-ws-cluster' | 'fs-cluster';
}): string | undefined {
  if (!codigoPreparacao(opcoes.config) || !codigoTrabalho(opcoes.config)) return 'A metodologia precisa de um tipo de preparação e de um tipo de trabalho.';
  if (!tecnicaNaMetodologia(opcoes.config, 'CLUSTER')) return 'Cluster não está na metodologia.';
  const quantidade = quantidadeDoExemplo(opcoes.exemplo);
  if (opcoes.series + quantidade > LIMITE_SERIES) return `O exemplo usa ${quantidade} séries e o exercício já tem ${opcoes.series}.`;
  return undefined;
}

/**
 * Por que "Rest-pause na última série" fica desligado. Dois cartões de trabalho abertos não escolhem um alvo.
 * Técnica ausente da metodologia também não.
 */
export function motivoDoRestPause(opcoes: {
  config: Configuracao | null | undefined;
  cartoesDeTrabalhoAbertos: number;
}): string | undefined {
  if (!tecnicaNaMetodologia(opcoes.config, 'REST_PAUSE')) return 'Rest-pause não está na metodologia.';
  if (opcoes.cartoesDeTrabalhoAbertos === 0) return 'Abra a série de trabalho.';
  if (opcoes.cartoesDeTrabalhoAbertos > 1) return 'Feche os outros cartões de série de trabalho. O atalho vale para a última série de um cartão só.';
  return undefined;
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
  if (!preparacao || !trabalho || !tecnicaNaMetodologia(config, 'CLUSTER') || series.length + quantidadeDoExemplo(exemplo) > LIMITE_SERIES) return [...series];
  const fs = serieAjustada(config, preparacao, null, REPS_FS_DO_EXEMPLO, modalidade);
  const cluster = serieAjustada(config, trabalho, 'CLUSTER', null, modalidade);
  const novas = exemplo === 'fs-ws-cluster'
    ? [fs, serieAjustada(config, trabalho, null, REPS_WS_DO_EXEMPLO, modalidade), cluster]
    : [fs, cluster];
  return [...series, ...novas];
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

/** Acrescenta uma WS nova com Rest-pause. A série anterior permanece como está. */
export function novaWsComRestPause(
  series: readonly Serie[],
  config: Configuracao | null | undefined,
  modalidade: string | null = null,
): Serie[] {
  const trabalho = codigoTrabalho(config);
  if (!trabalho || !tecnicaNaMetodologia(config, 'REST_PAUSE')) return [...series];
  return adicionarSerie([...series], config, trabalho, 'REST_PAUSE', modalidade);
}
