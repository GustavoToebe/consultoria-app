import type { AvaliacaoFisica, CampoDaMedida, DadosAvaliacaoFisica, MedidasCorporais } from '../api/avaliacaoFisicaTipos';
import type { MetaDoPeso } from '../api/tipos';
import { tomDaVariacaoDoPeso, type TomDoPeso } from './corDaVariacaoDoPeso';
import { dataNaFaixa, mensagemDaFaixa } from './datasValidas';
import { SEM_DADO } from './formatos';
import { pesoComCasas, textoDaDiferenca } from './variacaoDoPeso';

/**
 * Avaliação física (circunferências em cm por data): validação espelhada da API (`ValidacaoDaAvaliacao`: mudou uma,
 * mude a outra), formatação, a comparação de datas e a variação desde a avaliação anterior. Nada de percentual de
 * gordura, classificação ou texto que interprete. A única cor é a da meta do peso do aluno (27/11, pedido do Gustavo), no
 * peso e nas medidas que acompanham o peso (cintura, abdômen e quadril); o resto fica neutro. Ausente é "—", nunca zero;
 * variação zero é "0,0" sem seta e a primeira medida é "Primeira" (`variacaoCurta`).
 */

export const MEDIDA_MINIMA_CM = 5;
export const MEDIDA_MAXIMA_CM = 300;
export const OBSERVACAO_MAXIMA = 1000;
export const COMPARAR_MINIMO = 2;
export const COMPARAR_MAXIMO = 4;

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
  else if (!dataNaFaixa(d.data, 'REGISTRO', hoje)) erros.data = mensagemDaFaixa('Data da avaliação', 'REGISTRO', hoje);
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
  // Peso: a mesma regra de casas do Peso e dos PDFs da dieta ("+1,0 kg", nunca "+1 kg").
  if (unidade === 'kg') return textoDaDiferenca(d);
  const sinal = d > 0 ? '+' : d < 0 ? '−' : '';
  return `${sinal}${Math.abs(d).toFixed(1).replace('.', ',')} cm`;
}

/**
 * Quando o "Baixar comparativo" aparece (a funcionalidade `PDF` do plano é conferida à parte, por `NoPlano`). A equipe
 * sempre o tem. O aluno só com internet (o PDF baixa a logo e a rota não funciona sem rede) e com a marca da sessão.
 */
export function podeBaixarComparativo(o: { daEquipe: boolean; online: boolean; temMarca: boolean }): boolean {
  return o.daEquipe || (o.online && o.temMarca);
}

/** Uma medida para escolher no gráfico (só as que têm algum valor). `detalhe` = "3 datas". */
export interface OpcaoDeMedida {
  valor: CampoDaMedida;
  rotulo: string;
  detalhe: string;
}

export function valorDaMedida(a: AvaliacaoFisica, campo: CampoDaMedida): number | null {
  const v = a.medidas[campo];
  return v === null || v === undefined || Number.isNaN(v) ? null : v;
}

/** Medidas com pelo menos uma data medida, na ordem de `MEDIDAS`. Medida nunca medida não vira opção (nada a mostrar). */
export function opcoesDeMedida(avaliacoes: readonly AvaliacaoFisica[]): OpcaoDeMedida[] {
  return MEDIDAS.flatMap(({ campo, rotulo }) => {
    const n = avaliacoes.filter((a) => valorDaMedida(a, campo) !== null).length;
    return n ? [{ valor: campo, rotulo, detalhe: `${n} ${n === 1 ? 'data' : 'datas'}` }] : [];
  });
}

/** A escolhida, se ainda é opção (pode ter sido apagada); senão a primeira. Nula sem nenhuma medida. */
export function medidaEscolhida(opcoes: readonly OpcaoDeMedida[], escolhida: CampoDaMedida | null): CampoDaMedida | null {
  if (escolhida && opcoes.some((o) => o.valor === escolhida)) return escolhida;
  return opcoes[0]?.valor ?? null;
}

export interface SerieDaMedida {
  /** Só as datas que têm a medida, da mais antiga à mais nova (o eixo do gráfico). Ausente não vira ponto. */
  pontos: { data: string; valor: number }[];
  /** Todas as datas, da mais nova à mais antiga, com a medida ou nula ("—" na tela). */
  linhas: { id: string; data: string; valor: number | null }[];
}

/**
 * Série de uma medida ao longo das avaliações, pela data (não pela ordem da API). A data em que a medida não foi tomada
 * fica fora do gráfico: nada de zero, de repetir o valor anterior ou de interpolar; na lista ela aparece com "—".
 */
export function serieDaMedida(avaliacoes: readonly AvaliacaoFisica[], campo: CampoDaMedida): SerieDaMedida {
  const cronologicas = [...avaliacoes].sort((a, b) => a.data.localeCompare(b.data));
  const pontos = cronologicas.flatMap((a) => {
    const valor = valorDaMedida(a, campo);
    return valor === null ? [] : [{ data: a.data, valor }];
  });
  const linhas = [...cronologicas].reverse().map((a) => ({ id: a.id, data: a.data, valor: valorDaMedida(a, campo) }));
  return { pontos, linhas };
}

/**
 * O que o gráfico da medida mostra: `linha` com 2 pontos ou mais, `ponto` com 1 (o ponto, sem linha), `nada` sem ponto e
 * `desligado` quando a pessoa desligou os gráficos (fica só a lista).
 */
export function graficoDaMedida(pontos: number, graficosLigados: boolean): 'linha' | 'ponto' | 'nada' | 'desligado' {
  if (pontos === 0) return 'nada';
  if (!graficosLigados) return 'desligado';
  return pontos === 1 ? 'ponto' : 'linha';
}

// ---------- Variação desde a avaliação anterior (histórico em tabela e folha, 27/11) ----------

/** Uma coluna do histórico: o peso do dia ou uma circunferência. */
export type ColunaDoHistorico = CampoDaMedida | 'peso';

/** Só estas seguem a meta do peso do aluno (o peso e as que descem junto com ele); o resto não tem meta e fica neutro. */
export const COLUNAS_COM_META: readonly ColunaDoHistorico[] = ['peso', 'cintura', 'abdomen', 'quadril'];

export function valorDaColuna(a: AvaliacaoFisica, coluna: ColunaDoHistorico): number | null {
  if (coluna !== 'peso') return valorDaMedida(a, coluna);
  return a.pesoKg === null || !Number.isFinite(a.pesoKg) ? null : a.pesoKg;
}

/** "90,0" (kg) ou "39,5" (cm), sem a unidade (ela fica no cabeçalho); ausente = "—". */
export function valorParaTabela(coluna: ColunaDoHistorico, v: number | null): string {
  if (v === null) return SEM_DADO;
  return coluna === 'peso' ? pesoComCasas(v) : cmParaTela(v);
}

/**
 * Valor da coluna na avaliação mais recente ANTES de `data` (estritamente) que a tem: a que não mediu fica de fora (a
 * variação compara com a última medida de verdade, a mesma do "anterior" da folha). `excetoId` tira a que está em edição.
 */
export function valorAnterior(avaliacoes: readonly AvaliacaoFisica[], coluna: ColunaDoHistorico, data: string, excetoId?: string): number | null {
  let achada: { data: string; valor: number } | null = null;
  for (const a of avaliacoes) {
    if (a.id === excetoId || a.data >= data) continue;
    const valor = valorDaColuna(a, coluna);
    if (valor !== null && (!achada || a.data > achada.data)) achada = { data: a.data, valor };
  }
  return achada?.valor ?? null;
}

/** Sem avaliação anterior com a medida (decisão do Gustavo, 27/11): texto pequeno e secundário, nunca "—". */
export const TEXTO_PRIMEIRA = 'Primeira';

export interface VariacaoCurta {
  /**
   * `mudou` ("▲ 0,5"/"▼ 1,0"), `igual` ("0,0", sem seta), `primeira` (sem anterior: "Primeira") e `semValor` (a medida não
   * foi preenchida: "—").
   */
  tipo: 'mudou' | 'igual' | 'primeira' | 'semValor';
  /** "▲ 0,5", "▼ 1,0", "0,0", "Primeira" ou "—". Sem "+" e sem unidade. */
  texto: string;
  /** Neutro fora de `COLUNAS_COM_META`, sem meta, com `SEM_META` e fora do `mudou`. */
  tom: TomDoPeso;
  /** Para o leitor de tela, sem a seta: "desceu 1,0 cm, a favor da meta", "sem variação", "primeira medida"; vazio no "—". */
  falado: string;
}

/** A variação quando a medida não foi preenchida (o valor já mostra "—"). */
export const VARIACAO_SEM_VALOR: VariacaoCurta = { tipo: 'semValor', texto: SEM_DADO, tom: 'neutro', falado: '' };

/**
 * Atual − anterior (cm com 1 casa, kg com 2), com seta e a cor da meta só nas colunas que a têm. Zero é "0,0" neutro e sem
 * seta; sem anterior, "Primeira"; "—" só sem o valor atual. Regra única da tela (histórico e folha) e do PDF.
 */
export function variacaoCurta(coluna: ColunaDoHistorico, anterior: number | null, atual: number | null, meta: MetaDoPeso | null | undefined): VariacaoCurta {
  const kg = coluna === 'peso';
  if (atual === null) return VARIACAO_SEM_VALOR;
  if (anterior === null) return { tipo: 'primeira', texto: TEXTO_PRIMEIRA, tom: 'neutro', falado: 'primeira medida' };
  const d = diferenca(anterior, atual, kg ? 2 : 1) ?? 0;
  if (d === 0) return { tipo: 'igual', texto: kg ? pesoComCasas(0) : cmParaTela(0), tom: 'neutro', falado: 'sem variação' };
  const tom = COLUNAS_COM_META.includes(coluna) ? tomDaVariacaoDoPeso(d, meta) : 'neutro';
  const numero = kg ? pesoComCasas(Math.abs(d)) : cmParaTela(Math.abs(d));
  const daMeta = tom === 'positivo' ? ', a favor da meta' : tom === 'problema' ? ', contra a meta' : '';
  return { tipo: 'mudou', texto: `${d > 0 ? '▲' : '▼'} ${numero}`, tom, falado: `${d > 0 ? 'subiu' : 'desceu'} ${numero} ${kg ? 'kg' : 'cm'}${daMeta}` };
}
