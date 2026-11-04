import { numeroParaTela } from './formatos';

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

/** Passo da grade de kg preferida ao converter (todo `arredondamentoKg` da metodologia é múltiplo dele). */
const GRADE_EM_KG = 0.05;

/**
 * Número digitado na unidade da pessoa → kg a guardar (2 casas). Em kg, o próprio valor, como sempre foi.
 *
 * Em libra, vários kg de 2 casas mostram o mesmo número (a janela de 0,1 lb tem ~0,045 kg). Entre eles, prefere o
 * múltiplo de 0,05 kg: assim a carga que veio do plano ou de um registro em kg (60 kg = "132,3 lb") volta igual quando o
 * aluno digita o que está vendo (132,3 → 60, não 60,01), sem recorde falso nem "mesma carga" que deixa de casar. Como a
 * janela é menor que 0,05, há no máximo um múltiplo nela: todo kg múltiplo de 0,05 faz ida e volta exata. Sem múltiplo
 * na janela, vale o arredondamento normal de 2 casas, que também lê de volta o mesmo número em lb.
 */
export function telaParaKg(valor: number | null | undefined, unidade: UnidadeDeCarga): number | null {
  if (!finito(valor)) return null;
  if (unidade === 'kg') return valor;
  const exato = valor * KG_POR_LIBRA;
  const naGrade = arredondar(Math.round(exato / GRADE_EM_KG) * GRADE_EM_KG, CASAS_GUARDADAS_KG);
  return kgParaTela(naGrade, 'lb') === arredondar(valor, CASAS_EM_LIBRA) ? naGrade : arredondar(exato, CASAS_GUARDADAS_KG);
}

/** O número de "62,5 kg" ou "137,8 lb" sem a unidade (vírgula decimal); sem valor, "—". */
export function numeroDaCarga(kg: number | null | undefined, unidade: UnidadeDeCarga): string {
  return numeroParaTela(kgParaTela(kg, unidade), unidade === 'kg' ? CASAS_GUARDADAS_KG : CASAS_EM_LIBRA);
}

/** "62,5 kg" ou "137,8 lb". Sem valor, "— kg" (como o resto do app). */
export function textoDaCarga(kg: number | null | undefined, unidade: UnidadeDeCarga): string {
  return `${numeroDaCarga(kg, unidade)} ${unidade}`;
}

/** Menor passo dos botões −/+ em libra, e o múltiplo a que o passo se arredonda (anilhas de 2,5 lb). */
const PASSO_MINIMO_EM_LIBRA = 2.5;

/**
 * Passo dos botões −/+ no que a pessoa vê (decisão do Gustavo, 04/11). Em kg, o `arredondamentoKg` da metodologia como é.
 * Em libra, ele convertido e arredondado ao múltiplo de 2,5 lb mais próximo, no mínimo 2,5 lb (2,5 kg = 5 lb; 1 kg = 2,5 lb;
 * 5 kg = 10 lb): o aluno em libra anda de anilha em anilha, e não por 105,5 lb.
 */
export function passoNaTela(passoKg: number, unidade: UnidadeDeCarga): number {
  if (unidade === 'kg') return passoKg;
  return Math.max(PASSO_MINIMO_EM_LIBRA, Math.round(passoKg / KG_POR_LIBRA / PASSO_MINIMO_EM_LIBRA) * PASSO_MINIMO_EM_LIBRA);
}

/** Passo dos botões −/+ no rótulo: "0,5 kg" ou "5 lb" (`passoNaTela`). */
export function textoDoPasso(passoKg: number, unidade: UnidadeDeCarga): string {
  return `${numeroParaTela(passoNaTela(passoKg, unidade))} ${unidade}`;
}

/** Nome por extenso, para o leitor de tela ("Peso da série 2, em libras"). */
export function nomeDaUnidade(unidade: UnidadeDeCarga): string {
  return unidade === 'kg' ? 'quilos' : 'libras';
}

/** Número com separador decimal: o que a máscara em libra corta para 1 casa. */
const NUMERO_COM_CASAS = /^\s*(-?\d+)[.,](\d*)\s*$/;

/**
 * Máscara do campo de carga: em libra, corta o número para 1 casa (o que o ida e volta garante). Só mexe num número
 * bem formado: texto que não é número ("abc", "6x2") fica como foi digitado, para o campo marcar "Número inválido." e
 * travar o ✓ como em kg (apagar o que não é número deixaria o campo vazio e o ✓ livre). Em kg, nenhuma (como sempre foi).
 */
export function mascaraDaCarga(unidade: UnidadeDeCarga): ((texto: string) => string) | undefined {
  if (unidade !== 'lb') return undefined;
  return (texto) => {
    const m = NUMERO_COM_CASAS.exec(texto);
    return m ? `${m[1]},${m[2].slice(0, CASAS_EM_LIBRA)}` : texto;
  };
}
