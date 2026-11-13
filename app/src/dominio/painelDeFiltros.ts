import { dataDaTela } from './formatos';

/**
 * Regras do painel lateral de filtros (`docs/planos/filtros-laterais.md`, D4 a D9): o rascunho fica no painel e só vale no
 * "Aplicar filtros", que antes confere os campos; o resto (contagem = critérios ligados, etiquetas) é de cada tela, um
 * chip por critério. Funções puras.
 */

/** O que o "Aplicar filtros" faz: aplica, ou fica no painel com a frase do rodapé e os campos marcados. */
export function resultadoDoAplicar(problemas: number): { ok: true } | { ok: false; mensagem: string } {
  if (problemas <= 0) return { ok: true };
  return { ok: false, mensagem: problemas === 1 ? 'Corrija o campo marcado para aplicar os filtros.' : `Corrija os ${problemas} campos marcados para aplicar os filtros.` };
}

/** Erro de uma data digitada no filtro: vazia não é erro; pela metade ou impossível, sim. */
function erroDaData(texto: string): string | null {
  if (!texto) return null;
  if (dataDaTela(texto) !== undefined) return null;
  return texto.length < 10 ? 'Complete a data (DD/MM/AAAA) ou apague.' : 'Data inválida.';
}

/**
 * Erros do par De/Até como digitado (DD/MM/AAAA): cada data sozinha e, com as duas certas, "Até" antes de "De". A tela
 * mostra cada um junto do campo dele.
 */
export function errosDoPeriodoDigitado(de: string, ate: string): { de: string | null; ate: string | null } {
  const erroDe = erroDaData(de);
  const erroAte = erroDaData(ate);
  if (erroDe || erroAte) return { de: erroDe, ate: erroAte };
  const inicio = dataDaTela(de);
  const fim = dataDaTela(ate);
  return { de: null, ate: inicio && fim && fim < inicio ? 'Fim antes do início.' : null };
}

/**
 * Seleção em lote depois de aplicar filtros (regra das Cobranças, D9): filtros diferentes limpam a seleção, com aviso (a
 * lista nova pode esconder itens marcados, e o lote nunca leva o que a pessoa não vê); aplicar o mesmo que já estava
 * (Aplicar sem mudar nada) não mexe nela. Cancelar, X, Esc e o fundo nem chegam aqui. As chaves são as da lista.
 */
export function selecaoDepoisDosFiltros<T>(selecao: readonly T[], chaveAntes: string, chaveDepois: string):
  { selecao: readonly T[]; aviso: string | null } {
  if (chaveAntes === chaveDepois || selecao.length === 0) return { selecao, aviso: null };
  const n = selecao.length;
  return { selecao: [], aviso: `${n === 1 ? 'A cobrança marcada saiu' : `As ${n} cobranças marcadas saíram`} da seleção porque os filtros mudaram.` };
}
