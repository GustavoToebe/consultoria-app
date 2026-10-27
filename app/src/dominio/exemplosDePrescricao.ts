import type { Configuracao, Esforco, Serie } from '../api/tipos';
import type { GrupoDeSeries } from './agrupamento';
import { tecnicaVazia } from './editorTreino';
import { padraoDaTecnica, papelDe, tecnicaNaMetodologia } from './metodologia';

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
