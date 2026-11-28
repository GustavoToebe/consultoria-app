import type { Tecnica } from '../api/tipos';
import { textoPausa } from './agrupamento';

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

/**
 * Série aberta: dois campos fixos (`[15] s · [3] respirações`). Cada campo grava só o seu valor: a chave ausente fica
 * como está, `null` (campo vazio) limpa só ela. Sem conversão entre as unidades; os limites ficam com
 * `problemasDaTecnica`.
 */
export function aplicarPausa(t: Pausa, m: { segundos?: number | null; respiracoes?: number | null }): Pausa {
  return {
    pausaSegundos: m.segundos !== undefined ? m.segundos : (t.pausaSegundos ?? null),
    pausaRespiracoes: m.respiracoes !== undefined ? m.respiracoes : (t.pausaRespiracoes ?? null),
  };
}

const positivo = (n: number | null | undefined) => n != null && n > 0;

/** Dica abaixo dos dois campos: o texto que o aluno vê (o do cartão), com o exemplo do documento quando vazio. */
export function dicaDaPausaEntreBlocos(t: Pausa): string {
  const s = positivo(t.pausaSegundos);
  const r = positivo(t.pausaRespiracoes);
  if (s !== r) return `O aluno vê "${textoPausa(t)}".`;
  const exemplo = s ? t : { pausaSegundos: 15, pausaRespiracoes: 3 };
  return `O aluno vê "${textoPausa(exemplo)}". Deixe as respirações em branco para usar só o tempo.`;
}
