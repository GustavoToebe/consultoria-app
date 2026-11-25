import { ajustarCarga } from './cargas';
import type { GravacaoDaSerie } from './painelDoCheck';
import type { UnidadeDeCarga } from './unidadeDeCarga';

/**
 * O ✓ da série na tela redesenhada (pedido do Gustavo, 25/11): a carga sugerida aparece apagada dentro do campo de kg e
 * marcar o ✓ sem digitar USA a sugestão; o ✓ só habilita com kg e repetições (digitados ou sugeridos). Regra pura, sem
 * rede. Não substitui `painelDoCheck.decidirCheck` (o painel "Fez com 60 kg?" da tela atual): quem adota esta regra
 * deixa de abrir o painel.
 *
 * Nada é inventado: a repetição só vem do digitado ou da progressão (`sugestaoReps`), nunca da meta (`repsMin`/`repsMax`).
 */

export interface EntradaDaMarcacao {
  /** A série já está marcada: tocar de novo desmarca (sempre permitido). */
  feita: boolean;
  /** O que está nos campos (`null` = vazio). Com a série já gravada, o que o registro tem. */
  carga: number | null;
  repeticoes: number | null;
  /** `SerieCalculada.sugestao` e `.sugestaoReps`. */
  sugestaoKg: number | null;
  sugestaoReps: number | null;
  /** Sem campo de peso: exercício sem carga ou forma de carga que o app não lê. */
  semCampoDePeso: boolean;
  /** Algum campo tem texto que não é número (`CampoNumericoGrande aoValidade`): o ✓ fica travado. */
  invalido?: boolean;
}

export interface ValoresDaSerie {
  /** O que vale para a carga: o digitado, senão a sugestão; `null` sem campo de peso ou sem nada. */
  carga: number | null;
  repeticoes: number | null;
  /** A carga mostrada é a sugestão (apagada no campo, com a legenda "sugerido"). */
  cargaEhSugestao: boolean;
  repeticoesEhSugestao: boolean;
}

export function valoresDaSerie(e: EntradaDaMarcacao): ValoresDaSerie {
  const cargaEhSugestao = !e.semCampoDePeso && e.carga === null && e.sugestaoKg !== null;
  const repeticoesEhSugestao = e.repeticoes === null && e.sugestaoReps !== null;
  return {
    carga: e.semCampoDePeso ? null : (e.carga ?? e.sugestaoKg),
    repeticoes: e.repeticoes ?? e.sugestaoReps,
    cargaEhSugestao,
    repeticoesEhSugestao,
  };
}

/** ✓ habilitado: tem kg (ou não há campo de peso) e repetições, e nenhum texto inválido. Desmarcar nunca trava. */
export function checkHabilitado(e: EntradaDaMarcacao): boolean {
  if (e.feita) return true;
  if (e.invalido) return false;
  const v = valoresDaSerie(e);
  return (e.semCampoDePeso || v.carga !== null) && v.repeticoes !== null;
}

/**
 * O que gravar ao tocar no ✓: marcar usa o digitado e, no que faltar, a sugestão; desmarcar mantém os valores gravados
 * (como `decidirCheck`). `null` = ✓ desabilitado, não há o que gravar.
 */
export function marcarSerie(e: EntradaDaMarcacao): GravacaoDaSerie | null {
  if (e.feita) return { carga: e.semCampoDePeso ? null : e.carga, repeticoes: e.repeticoes, concluida: false };
  if (!checkHabilitado(e)) return null;
  const v = valoresDaSerie(e);
  return { carga: v.carga, repeticoes: v.repeticoes, concluida: true };
}

/** Segurar − ou +: espera antes de repetir e o intervalo entre as repetições (o timer é da tela; a conta é daqui). */
export const ATRASO_DO_REPEAT_MS = 400;
export const INTERVALO_DO_REPEAT_MS = 100;

/**
 * Quantos passos a mais o botão já deu por ter ficado `ms` pressionado (o primeiro passo é o do toque, na hora): zero até
 * `ATRASO_DO_REPEAT_MS`, depois um a cada `INTERVALO_DO_REPEAT_MS`. Mesma conta para o relógio da tela e para o teste.
 */
export function repeticoesAoSegurar(ms: number): number {
  return ms < ATRASO_DO_REPEAT_MS ? 0 : 1 + Math.floor((ms - ATRASO_DO_REPEAT_MS) / INTERVALO_DO_REPEAT_MS);
}

/**
 * Aplica `vezes` passos de uma vez a partir de `atual` (vazio parte da sugestão e, sem ela, do 0), com o passo da
 * metodologia (0,5 kg por padrão; em libra, o da tela) e o piso em 0: a mesma regra de `ajustarCarga`, repetida.
 * shortcut: sem teto de carga (o servidor não tem um para o registro), pôr se o segurar passar de valores absurdos.
 */
export function ajustarCargaVezes(atual: number | null, sugestao: number | null, passo: number, sentido: 1 | -1, vezes: number, unidade: UnidadeDeCarga = 'kg'): number {
  let valor = atual;
  for (let i = 0; i < Math.max(1, vezes); i++) valor = ajustarCarga(valor, sugestao, passo, sentido, unidade);
  return valor as number;
}
