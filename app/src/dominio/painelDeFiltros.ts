import { type RegraDeData, dataDaTelaNaFaixa, erroDaData as erroDaFaixa } from './datasValidas';
import { periodoDigitado } from './filtrosComuns';
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

/**
 * Erro de uma data digitada no filtro: vazia não é erro; pela metade, impossível ou (com `regra`) fora da faixa, sim. A
 * mensagem da faixa é a mesma que o `CampoData` mostra sozinho (`dominio/datasValidas`).
 */
function erroDaData(texto: string, regra: RegraDeData | undefined, nome: string, hoje?: string): string | null {
  if (!texto) return null;
  if (texto.length < 10) return 'Complete a data (DD/MM/AAAA) ou apague.';
  if (regra) return erroDaFaixa(texto, nome, regra, hoje);
  return dataDaTela(texto) === undefined ? 'Data inválida.' : null;
}

export interface RegrasDoPeriodo {
  /** As duas datas ou nenhuma (o intervalo aberto não vale; Atualizações). */
  osDois?: boolean;
  /** Período mais longo aceito, em dias, contando as duas pontas. */
  maximoDias?: number;
  /** Faixa das datas (`dominio/datasValidas`); sem ela só a data impossível é erro. */
  regra?: RegraDeData;
  /** Nome de cada campo na mensagem da faixa ("Entrada, data inicial"). */
  nomes?: { de: string; ate: string };
  hoje?: string;
}

/**
 * Erros do par De/Até como digitado (DD/MM/AAAA), um por campo, na mesma ordem do `periodoDigitado`: cada data sozinha;
 * com as duas certas, "Até" antes de "De" (no Até), só uma das duas onde a tela pede as duas (no campo vazio) e período
 * longo demais (no Até). A tela mostra cada um junto do campo dele; nunca um intervalo que a tela já aceita aberto vira erro.
 */
export function errosDoPeriodoDigitado(de: string, ate: string, regras: RegrasDoPeriodo = {}): { de: string | null; ate: string | null } {
  const { osDois = false, maximoDias, regra, nomes = { de: 'Data inicial', ate: 'Data final' }, hoje } = regras;
  const erroDe = erroDaData(de, regra, nomes.de, hoje);
  const erroAte = erroDaData(ate, regra, nomes.ate, hoje);
  if (erroDe || erroAte) return { de: erroDe, ate: erroAte };
  const ler = (t: string) => (regra ? dataDaTelaNaFaixa(t, regra, hoje) : dataDaTela(t));
  const r = periodoDigitado(ler(de), ler(ate), osDois, maximoDias);
  if (!('problema' in r)) return { de: null, ate: null };
  switch (r.problema) {
    case 'ordem': return { de: null, ate: 'Fim antes do início.' };
    case 'par': return de ? { de: null, ate: 'Preencha a data final ou apague a inicial.' } : { de: 'Preencha a data inicial ou apague a final.', ate: null };
    case 'longo': return { de: null, ate: `Escolha um período de até ${maximoDias} dias.` };
    // 'data' já saiu acima (as duas datas foram conferidas uma a uma).
    default: return { de: null, ate: null };
  }
}

/** Como o aviso de seleção limpa chama o que estava marcado (concordância de gênero e número). */
export interface TextoDaSelecao { um: string; varios: (n: number) => string }
export const SELECAO_DE_COBRANCAS: TextoDaSelecao = { um: 'A cobrança marcada saiu', varios: (n) => `As ${n} cobranças marcadas saíram` };
export const SELECAO_DE_ALUNOS: TextoDaSelecao = { um: 'O aluno marcado saiu', varios: (n) => `Os ${n} alunos marcados saíram` };

/**
 * Seleção em lote depois de aplicar filtros (regra das Cobranças e dos Alunos, D9): filtros diferentes limpam a seleção, com
 * aviso (a lista nova pode esconder itens marcados, e o lote nunca leva o que a pessoa não vê); aplicar o mesmo que já estava
 * (Aplicar sem mudar nada) não mexe nela. Cancelar, X, Esc e o fundo nem chegam aqui. As chaves são as da lista; `texto` diz o
 * que está marcado (padrão: cobranças).
 */
export function selecaoDepoisDosFiltros<T>(selecao: readonly T[], chaveAntes: string, chaveDepois: string, texto: TextoDaSelecao = SELECAO_DE_COBRANCAS):
  { selecao: readonly T[]; aviso: string | null } {
  if (chaveAntes === chaveDepois || selecao.length === 0) return { selecao, aviso: null };
  const n = selecao.length;
  return { selecao: [], aviso: `${n === 1 ? texto.um : texto.varios(n)} da seleção porque os filtros mudaram.` };
}
