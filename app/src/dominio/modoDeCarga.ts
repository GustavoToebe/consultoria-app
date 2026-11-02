import { MODOS_DE_CARGA } from './validacaoDeSerie';

/**
 * Forma de carga que este app não conhece (um treinador usou algo mais novo que o app instalado). O pacote offline não é
 * recusado por isso (`offline/formatoDoPacote`): a série continua no plano, sem carga legível. `ModoDeCarga` segue a união
 * dos modos que o app conhece; o modo desconhecido só existe em tempo de execução, por isso estas funções recebem
 * `string` e devolvem `boolean` simples (sem predicado de tipo, que estreitaria o modo para `never`).
 *
 * Regra de segurança: série de carga ilegível nunca recebe carga digitada, sugerida nem contada (referência, recorde,
 * carga de trabalho). O ✓ da série continua valendo, com a carga em branco ("—").
 */
export const TEXTO_CARGA_ILEGIVEL = 'Carga: atualize o app para ver';

/** O app sabe ler este modo de carga? */
export function modoConhecido(modo: string | null | undefined): boolean {
  return modo != null && (MODOS_DE_CARGA as readonly string[]).includes(modo);
}

/** A carga da série é de uma forma que este app não conhece? Série sem carga (nula) é legível: é "sem carga". */
export function cargaIlegivel(carga: { modo: string } | null | undefined): boolean {
  return !!carga && !modoConhecido(carga.modo);
}

/** Só o que o registro da série leva de carga. */
interface DadosComCarga {
  carga: number | null;
  etapas?: readonly { carga: number | null }[] | null;
  referenciaCarga?: number | null;
  referenciaOrigem?: unknown;
}

/**
 * O que o aparelho grava ao marcar uma série de carga ilegível: repetições e ✓ ficam, a carga (da série, de cada etapa e
 * a referência congelada) vai em branco. Garantia única da regra acima, aplicada em `useSessaoDoDia.registrar` mesmo que a
 * tela deixasse passar um número. Série legível devolve os mesmos dados.
 */
export function semCargaNaSerieIlegivel<T extends DadosComCarga>(serie: { carga: { modo: string } | null | undefined }, dados: T): T {
  if (!cargaIlegivel(serie.carga)) return dados;
  const limpo: DadosComCarga = { ...dados, carga: null };
  if (dados.etapas) limpo.etapas = dados.etapas.map((e) => ({ ...e, carga: null }));
  if ('referenciaCarga' in dados) limpo.referenciaCarga = null;
  if ('referenciaOrigem' in dados) limpo.referenciaOrigem = null;
  return limpo as T;
}
