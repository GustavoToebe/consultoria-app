import type { CargaDaEtapa, EtapaRegistrada } from '../api/tipos';
import { numeroParaTela } from './formatos';

/**
 * Peso das séries com etapas (Cluster, Rest-pause; Frente G, D17, 03/11): a mesma regra da série simples (D1 e D2 da
 * Frente C), mas sem atrapalhar o meio de um Cluster com pausas de 15 s:
 * - o campo de peso de cada etapa nasce VAZIO, com "Sugestão: X kg" ao lado (só texto);
 * - o painel "Fez com X kg?" aparece UMA vez por série, no primeiro ✓ de etapa com o peso vazio;
 * - o peso que o aluno deu (confirmado no painel ou digitado e marcado com o ✓) preenche as etapas ainda vazias da mesma
 *   série; o que ele digitar numa etapa vale mais e nunca é sobrescrito;
 * - nunca grava peso sem confirmação: sem sugestão, o ✓ com o campo vazio grava a etapa sem carga, como a série simples.
 *
 * "Uma vez por série" é tirado do próprio registro (sobrevive a sair e voltar à tela): a série já passou pelo primeiro ✓
 * quando tem alguma etapa FEITA. Por isso:
 * - "Reabrir" a série concluída não reabre o painel (as etapas continuam feitas);
 * - desfazer uma etapa só volta a perguntar se ela era a única feita daquela carga (a série recomeça do zero);
 * - "Outra carga" não conta como resposta (nada foi gravado): o próximo ✓ com o campo vazio pergunta de novo.
 * Etapa com carga própria em % da WS (bloco a 90%, retomada mais leve) tem outra sugestão: conta como outra "carga" da
 * série, com o seu próprio primeiro ✓. Sem carga própria (o caso comum) é exatamente uma vez por série.
 */

/** A carga própria só conta quando é percentual (igual a `dominio/etapas`); "da série" é a carga da série. */
export function chaveDaCarga(carga: CargaDaEtapa | null | undefined): string {
  return carga?.modo === 'PERCENTUAL_WS' && carga.percentual != null ? `PERCENTUAL:${carga.percentual}` : 'SERIE';
}

export interface EtapaDaCarga {
  posicao: number;
  carga: CargaDaEtapa | null;
}

const mesmaCarga = (previstas: readonly EtapaDaCarga[], posicao: number) => {
  const chave = chaveDaCarga(previstas.find((p) => p.posicao === posicao)?.carga);
  return (outra: number) => chaveDaCarga(previstas.find((p) => p.posicao === outra)?.carga) === chave;
};

/** A série já passou pelo primeiro ✓ desta carga: alguma outra etapa da mesma carga está feita. */
export function primeiroCheckFeito(posicao: number, previstas: readonly EtapaDaCarga[], etapas: readonly EtapaRegistrada[] | null | undefined): boolean {
  const igual = mesmaCarga(previstas, posicao);
  return (etapas ?? []).some((e) => e.posicao !== posicao && e.situacao === 'FEITA' && igual(e.posicao));
}

/**
 * O peso que o aluno já deu a esta carga da série: o da etapa feita (com carga) mais perto antes desta; sem nenhuma antes,
 * a primeira depois. `null` = nenhum (ou só "Sem carga").
 */
export function pesoJaDado(posicao: number, previstas: readonly EtapaDaCarga[], etapas: readonly EtapaRegistrada[] | null | undefined): number | null {
  const igual = mesmaCarga(previstas, posicao);
  const com = (etapas ?? []).filter((e) => e.posicao !== posicao && e.situacao === 'FEITA' && e.carga != null && igual(e.posicao));
  const antes = com.filter((e) => e.posicao < posicao).sort((a, b) => b.posicao - a.posicao)[0];
  const depois = com.filter((e) => e.posicao > posicao).sort((a, b) => a.posicao - b.posicao)[0];
  return (antes ?? depois)?.carga ?? null;
}

/**
 * O que o campo de peso de uma etapa ainda não feita mostra: o que o aluno digitou nele (`null` = apagou de propósito); sem
 * ter mexido (`undefined`), o peso já dado na série; senão vazio. Nunca a sugestão.
 */
export function pesoDoCampo(digitado: number | null | undefined, jaDado: number | null): number | null {
  return digitado !== undefined ? digitado : jaDado;
}

export interface EntradaDoCheckDaEtapa {
  /** O que está no campo de peso (`pesoDoCampo`). */
  carga: number | null;
  repeticoes: number | null;
  /** Carga sugerida da etapa (`sugestaoDaEtapa`), ou `null`. */
  sugestaoKg: number | null;
  /** Exercício sem carga ou forma de carga desconhecida: não há campo de peso. */
  semCampoDePeso: boolean;
  /** `primeiroCheckFeito`: o painel já teve a vez dele nesta série (desta carga). */
  primeiroCheckFeito: boolean;
}

export type DecisaoDoCheckDaEtapa =
  | { acao: 'MARCAR'; carga: number | null; repeticoes: number | null }
  | { acao: 'PAINEL'; sugestaoKg: number };

/**
 * O ✓ de uma etapa pendente: abre o painel só no primeiro ✓ da série com o peso vazio e com sugestão; senão marca com o
 * que está nos campos (sem campo de peso, sem carga).
 */
export function decidirCheckDaEtapa(e: EntradaDoCheckDaEtapa): DecisaoDoCheckDaEtapa {
  if (!e.semCampoDePeso && e.carga === null && e.sugestaoKg !== null && !e.primeiroCheckFeito) return { acao: 'PAINEL', sugestaoKg: e.sugestaoKg };
  return { acao: 'MARCAR', carga: e.semCampoDePeso ? null : e.carga, repeticoes: e.repeticoes };
}

/**
 * Dica ao lado do campo da etapa (mesmo visual da dica da série simples, `partesDaDica`): "Sugestão: 60 kg" só enquanto o
 * campo está vazio; sem sugestão numa etapa de carga própria, o que falta para haver uma. `null` = nada a dizer.
 */
export function dicaDaEtapa(e: { campoVazio: boolean; sugestaoKg: number | null; cargaPropria: boolean; semCampoDePeso: boolean }): string | null {
  if (e.semCampoDePeso || !e.campoVazio) return null;
  if (e.sugestaoKg != null) return `Sugestão: ${numeroParaTela(e.sugestaoKg)} kg`;
  return e.cargaPropria ? 'Sem sugestão: informe a carga de trabalho' : null;
}
