import { mascaraDeNumero, numeroParaTela } from './formatos';

/**
 * Unidade em que a pessoa vê e digita a carga. A carga é guardada SEMPRE em kg (aparelho, fila offline, API e banco):
 * a libra só existe na borda da tela. Nada aqui reescreve plano nem registro, e nada aqui decide progressão.
 */
export type UnidadeDeCarga = 'kg' | 'lb';

export const UNIDADES_DE_CARGA: readonly UnidadeDeCarga[] = ['kg', 'lb'];

/** 1 lb em kg (definição legal; nada de 0,4536). */
export const KG_POR_LIBRA = 0.45359237;

/** Casas do que é guardado (`numeric(7,2)` no banco). */
const CASAS_GUARDADAS_KG = 2;
/** Casas do que se mostra e se digita em libra: com 1 casa, ida e volta devolve o mesmo número (erro máximo 0,011 lb < 0,05). */
export const CASAS_EM_LIBRA = 1;

const arredondar = (n: number, casas: number) => Math.round(n * 10 ** casas) / 10 ** casas;
const finito = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Unidade em uso: só o aluno, só com a chave da plataforma ligada. Qualquer outra situação (chave desligada com `lb`
 * salvo de antes, treinador, "Ver como aluno") é kg.
 */
export function unidadeEfetiva(e: { chaveLigada: boolean; ehAluno: boolean; preferida: UnidadeDeCarga }): UnidadeDeCarga {
  return e.chaveLigada && e.ehAluno && e.preferida === 'lb' ? 'lb' : 'kg';
}

/** kg guardado → número para a tela. Em kg, o próprio valor; em lb, arredondado a 1 casa só para mostrar (o guardado não muda). */
export function kgParaTela(kg: number | null | undefined, unidade: UnidadeDeCarga): number | null {
  if (!finito(kg)) return null;
  return unidade === 'kg' ? kg : arredondar(kg / KG_POR_LIBRA, CASAS_EM_LIBRA);
}

/** Número digitado na unidade da pessoa → kg a guardar (2 casas). Em kg, o próprio valor, como sempre foi. */
export function telaParaKg(valor: number | null | undefined, unidade: UnidadeDeCarga): number | null {
  if (!finito(valor)) return null;
  return unidade === 'kg' ? valor : arredondar(valor * KG_POR_LIBRA, CASAS_GUARDADAS_KG);
}

/** O número de "62,5 kg" ou "137,8 lb" sem a unidade (vírgula decimal); sem valor, "—". */
export function numeroDaCarga(kg: number | null | undefined, unidade: UnidadeDeCarga): string {
  return numeroParaTela(kgParaTela(kg, unidade), unidade === 'kg' ? CASAS_GUARDADAS_KG : CASAS_EM_LIBRA);
}

/** "62,5 kg" ou "137,8 lb". Sem valor, "— kg" (como o resto do app). */
export function textoDaCarga(kg: number | null | undefined, unidade: UnidadeDeCarga): string {
  return `${numeroDaCarga(kg, unidade)} ${unidade}`;
}

/**
 * Passo dos botões −/+ no rótulo. O passo continua o `arredondamentoKg` da metodologia e é somado ao valor em kg
 * (`ajustarCarga`); só o texto é convertido, com 2 casas para não mentir (0,25 kg = "0,55 lb", não "0,6 lb").
 */
export function textoDoPasso(passoKg: number, unidade: UnidadeDeCarga): string {
  return unidade === 'kg' ? `${numeroParaTela(passoKg)} kg` : `${numeroParaTela(passoKg / KG_POR_LIBRA, 2)} lb`;
}

/** Nome por extenso, para o leitor de tela ("Peso da série 2, em libras"). */
export function nomeDaUnidade(unidade: UnidadeDeCarga): string {
  return unidade === 'kg' ? 'quilos' : 'libras';
}

/** Máscara do campo de carga: em libra, 1 casa (o que o ida e volta garante). Em kg, nenhuma (como sempre foi). */
export function mascaraDaCarga(unidade: UnidadeDeCarga): ((texto: string) => string) | undefined {
  return unidade === 'lb' ? (texto) => mascaraDeNumero(texto, CASAS_EM_LIBRA) : undefined;
}
