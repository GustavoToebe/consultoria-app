/**
 * Valor que o aluno digitou num campo cujo valor gravado chega depois (a gravação no aparelho é assíncrona: o
 * `AlunoProvider` grava e recarrega, e só então a tela recebe o número novo). Sem isto, a caixa voltava ao número antigo
 * até a gravação terminar, e a tecla seguinte era somada a ele ("5" e depois "0" gravava 420; reunião de 30/10, B1).
 *
 * Regra: a caixa mostra o pendente enquanto ele existir. Ele some quando o valor gravado passa a ser o último digitado
 * (a gravação chegou) ou quando o gravado muda por fora para um valor que o campo nunca mandou (sincronização, outra
 * ação). O gravado que chega igual a uma tecla anterior ainda em voo (o "5" de "50") é eco da própria digitação: o
 * pendente continua. Nada aqui grava, calcula carga ou marca a série: só decide o que a caixa mostra.
 *
 * `undefined` é "sem pendente"; `null` é um valor de verdade (o campo esvaziado).
 */
export interface ValorPendente<T> {
  /** O último valor digitado: o que a caixa mostra. */
  valor: T;
  /** Tudo o que o campo mandou gravar desde que o pendente começou (o eco desses valores é da própria digitação). */
  enviados: readonly T[];
  /** O último valor gravado que o campo viu. */
  visto: T;
}

/** O aluno digitou `valor` com `gravado` ainda valendo: abre o pendente ou acrescenta a tecla ao que já existe. */
export function digitarPendente<T>(pendente: ValorPendente<T> | undefined, valor: T, gravado: T): ValorPendente<T> {
  return { valor, enviados: [...(pendente?.enviados ?? []), valor], visto: pendente ? pendente.visto : gravado };
}

/**
 * O pendente diante do valor gravado de agora: o mesmo objeto quando nada mudou (a tela usa a identidade como guarda do
 * estado derivado durante o render), outro com `visto` novo quando chegou o eco de uma tecla anterior, ou `undefined`
 * quando a gravação do último valor chegou ou o gravado mudou por fora.
 */
export function acompanharPendente<T>(pendente: ValorPendente<T> | undefined, gravado: T): ValorPendente<T> | undefined {
  if (!pendente) return undefined;
  if (Object.is(gravado, pendente.visto)) return pendente;
  if (Object.is(gravado, pendente.valor)) return undefined;
  if (pendente.enviados.some((v) => Object.is(v, gravado))) return { ...pendente, visto: gravado };
  return undefined;
}

/** O que a caixa mostra: o pendente, se houver; senão o gravado. */
export const valorExibido = <T>(pendente: ValorPendente<T> | undefined, gravado: T): T => (pendente ? pendente.valor : gravado);
