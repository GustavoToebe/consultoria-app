import type { Tecnica } from '../api/tipos';

/**
 * Pausa interna da técnica (rest pause, cluster, myo-reps) num controle só: o número e a unidade. O contrato continua
 * com `pausaSegundos` e `pausaRespiracoes`, que podem vir os dois preenchidos; nesse caso, ou quando o treinador pede,
 * a tela mostra os dois campos. Segundos e respirações não se convertem (15 s não são 15 respirações).
 */
export type UnidadeDaPausa = 'SEGUNDOS' | 'RESPIRACOES';

type Pausa = Pick<Tecnica, 'pausaSegundos' | 'pausaRespiracoes'>;

const preenchido = (n: number | null | undefined) => n != null;

/** Os dois valores gravados, ou o treinador pediu os dois: dois campos. */
export function pausaEmDuasUnidades(t: Pausa, pediuAsDuas: boolean): boolean {
  return pediuAsDuas || (preenchido(t.pausaSegundos) && preenchido(t.pausaRespiracoes));
}

/** A unidade que o valor gravado diz; sem valor nenhum, a que a pessoa escolheu na tela. */
export function unidadeVisivel(escolhida: UnidadeDaPausa, t: Pausa): UnidadeDaPausa {
  if (preenchido(t.pausaSegundos) && !preenchido(t.pausaRespiracoes)) return 'SEGUNDOS';
  if (preenchido(t.pausaRespiracoes) && !preenchido(t.pausaSegundos)) return 'RESPIRACOES';
  return escolhida;
}

/**
 * O que gravar ao trocar a unidade de um controle com um valor só: o valor sai (não vira a outra unidade). Nulo quando
 * não há nada a mudar (a mesma unidade, ou nenhum valor escrito).
 */
export function aoTrocarUnidade(t: Pausa, atual: UnidadeDaPausa, nova: UnidadeDaPausa): Pausa | null {
  if (nova === atual) return null;
  const valor = atual === 'SEGUNDOS' ? t.pausaSegundos : t.pausaRespiracoes;
  if (!preenchido(valor)) return null;
  return { pausaSegundos: null, pausaRespiracoes: null };
}

/** A outra unidade, para o "Informar também em …". */
export function outraUnidade(u: UnidadeDaPausa): UnidadeDaPausa {
  return u === 'SEGUNDOS' ? 'RESPIRACOES' : 'SEGUNDOS';
}
