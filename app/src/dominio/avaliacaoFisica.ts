import type { AvaliacaoFisica, CampoDaMedida, DadosAvaliacaoFisica, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import { SEM_DADO } from './formatos';

/**
 * Avaliação física (circunferências em cm por data): validação espelhada da API (`ValidacaoDaAvaliacao`: mudou uma,
 * mude a outra), formatação e a comparação de 2 a 4 datas. Só guarda e compara: nada de percentual de gordura,
 * classificação, cor de "bom/ruim" ou texto que interprete. Ausente é "—", nunca zero.
 */

export const MEDIDA_MINIMA_CM = 5;
export const MEDIDA_MAXIMA_CM = 300;
export const OBSERVACAO_MAXIMA = 1000;
export const COMPARAR_MINIMO = 2;
export const COMPARAR_MAXIMO = 4;
const PRIMEIRA_DATA = '1900-01-01';

/** Na ordem da tela, do PDF e da API (`Medidas.porCampo`). */
export const MEDIDAS: readonly { campo: CampoDaMedida; rotulo: string }[] = [
  { campo: 'bracoDireito', rotulo: 'Braço direito' },
  { campo: 'bracoEsquerdo', rotulo: 'Braço esquerdo' },
  { campo: 'peitoral', rotulo: 'Peitoral' },
  { campo: 'cintura', rotulo: 'Cintura' },
  { campo: 'abdomen', rotulo: 'Abdômen' },
  { campo: 'quadril', rotulo: 'Quadril' },
  { campo: 'coxaDireita', rotulo: 'Coxa direita' },
  { campo: 'coxaEsquerda', rotulo: 'Coxa esquerda' },
  { campo: 'panturrilhaDireita', rotulo: 'Panturrilha direita' },
  { campo: 'panturrilhaEsquerda', rotulo: 'Panturrilha esquerda' },
];

export function medidasVazias(): MedidasCorporais {
  return Object.fromEntries(MEDIDAS.map((m) => [m.campo, null])) as MedidasCorporais;
}

/** Quantas medidas foram preenchidas (para a lista: "4 medidas"). */
export function medidasPreenchidas(m: MedidasCorporais): number {
  return MEDIDAS.filter(({ campo }) => m[campo] !== null && m[campo] !== undefined).length;
}

/** Mais de uma casa decimal (80,25)? Conta como a API: zeros à direita não contam. */
function casasDecimais(v: number): number {
  const texto = String(v);
  if (texto.includes('e')) return 99;
  const [, decimais = ''] = texto.split('.');
  return decimais.length;
}

/**
 * Problemas por campo, com as mesmas chaves do `fieldErrors` da API (`data`, `medidas`, `medidas.<campo>`,
 * `observacao`). Objeto vazio = pode salvar. As mensagens nunca repetem o valor.
 */
export function problemasDaAvaliacao(d: DadosAvaliacaoFisica, hoje: string): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!d.data) erros.data = 'Informe a data da avaliação.';
  else if (d.data > hoje) erros.data = 'A data não pode ser no futuro.';
  else if (d.data < PRIMEIRA_DATA) erros.data = 'Confira a data.';
  let alguma = false;
  for (const { campo } of MEDIDAS) {
    const v = d.medidas[campo];
    if (v === null || v === undefined) continue;
    alguma = true;
    if (v < MEDIDA_MINIMA_CM || v > MEDIDA_MAXIMA_CM) erros[`medidas.${campo}`] = `Use um valor entre ${MEDIDA_MINIMA_CM} e ${MEDIDA_MAXIMA_CM} cm.`;
    else if (casasDecimais(v) > 1) erros[`medidas.${campo}`] = 'Use no máximo uma casa decimal.';
  }
  if (!alguma) erros.medidas = 'Preencha ao menos uma medida.';
  if (d.observacao && d.observacao.trim().length > OBSERVACAO_MAXIMA) erros.observacao = `Use no máximo ${OBSERVACAO_MAXIMA} caracteres.`;
  return erros;
}

/** Corpo do POST/PUT: observação sem espaços nas pontas (vazia = nula); `versao` só quando é edição. */
export function corpoDaAvaliacao(data: string | null, medidas: MedidasCorporais, observacao: string, versao?: number): DadosAvaliacaoFisica {
  const corpo: DadosAvaliacaoFisica = { data, medidas: { ...medidas }, observacao: observacao.trim() || null };
  if (versao !== undefined) corpo.versao = versao;
  return corpo;
}

/** Uma casa decimal com vírgula ("80,0", "35,5"); ausente = "—". */
export function cmParaTela(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return SEM_DADO;
  return v.toFixed(1).replace('.', ',');
}

export function pesoParaTela(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return SEM_DADO;
  return `${(Math.round(v * 100) / 100).toString().replace('.', ',')} kg`;
}

/** Última − primeira, só quando os dois existem; arredondada às `casas` (evita 0,1 + 0,2). */
export function diferenca(primeiro: number | null | undefined, ultimo: number | null | undefined, casas = 1): number | null {
  if (primeiro === null || primeiro === undefined || ultimo === null || ultimo === undefined) return null;
  const fator = 10 ** casas;
  const d = Math.round((ultimo - primeiro) * fator) / fator;
  return Object.is(d, -0) ? 0 : d;
}

/** "+1,5 cm", "−2,0 cm", "0,0 cm" (sem sinal) ou "—". Só o número com sinal: sem cor nem palavra de avaliação. */
export function diferencaParaTela(d: number | null, unidade: 'cm' | 'kg' = 'cm'): string {
  if (d === null) return SEM_DADO;
  const casas = unidade === 'cm' ? 1 : 2;
  const absoluto = unidade === 'cm' ? Math.abs(d).toFixed(1) : String(Math.round(Math.abs(d) * 10 ** casas) / 10 ** casas);
  const sinal = d > 0 ? '+' : d < 0 ? '−' : '';
  return `${sinal}${absoluto.replace('.', ',')} ${unidade}`;
}

/** Marca ou desmarca uma avaliação para comparar; acima do máximo não entra (a tela avisa pelo `motivo`). */
export function alternarEscolha(escolhidas: readonly string[], id: string): string[] {
  if (escolhidas.includes(id)) return escolhidas.filter((e) => e !== id);
  if (escolhidas.length >= COMPARAR_MAXIMO) return [...escolhidas];
  return [...escolhidas, id];
}

export function podeComparar(escolhidas: readonly string[]): boolean {
  return escolhidas.length >= COMPARAR_MINIMO && escolhidas.length <= COMPARAR_MAXIMO;
}

/**
 * Quando o "Baixar comparativo" aparece (a funcionalidade `PDF` do plano é conferida à parte, por `NoPlano`). A equipe
 * sempre o tem. O aluno só com internet (o PDF baixa a logo e a rota não funciona sem rede) e com a marca da sessão.
 */
export function podeBaixarComparativo(o: { daEquipe: boolean; online: boolean; temMarca: boolean }): boolean {
  return o.daEquipe || (o.online && o.temMarca);
}

export interface LinhaDaComparacao {
  chave: CampoDaMedida | 'peso';
  rotulo: string;
  unidade: 'cm' | 'kg';
  /** Um valor por coluna (data), na ordem das colunas; nulo = "—". */
  valores: (number | null)[];
  /** Última coluna − primeira, só com os dois valores. */
  diferenca: number | null;
}

export interface Comparacao {
  /** Datas em ordem cronológica (a primeira e a última são as da diferença). */
  colunas: { id: string; data: string }[];
  linhas: LinhaDaComparacao[];
}

/**
 * Tabela medida × data das avaliações escolhidas, em ordem cronológica, mais a linha do peso (do registro de peso da
 * mesma data). Linha sem nenhum valor nas datas escolhidas não aparece (nada a comparar).
 */
export function comparar(todas: readonly AvaliacaoFisica[], escolhidas: readonly string[]): Comparacao {
  const avaliacoes = todas.filter((a) => escolhidas.includes(a.id)).sort((a, b) => a.data.localeCompare(b.data));
  const linha = (chave: LinhaDaComparacao['chave'], rotulo: string, unidade: 'cm' | 'kg', valor: (a: AvaliacaoFisica) => number | null): LinhaDaComparacao => {
    const valores = avaliacoes.map((a) => valor(a) ?? null);
    const dif = valores.length < COMPARAR_MINIMO ? null : diferenca(valores[0], valores[valores.length - 1], unidade === 'cm' ? 1 : 2);
    return { chave, rotulo, unidade, valores, diferenca: dif };
  };
  const linhas = [
    ...MEDIDAS.map(({ campo, rotulo }) => linha(campo, rotulo, 'cm', (a) => a.medidas[campo])),
    linha('peso', 'Peso', 'kg', (a) => a.pesoKg),
  ].filter((l) => l.valores.some((v) => v !== null));
  return { colunas: avaliacoes.map((a) => ({ id: a.id, data: a.data })), linhas };
}
