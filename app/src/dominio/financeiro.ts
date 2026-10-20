import type {
  CartoesDoPainel,
  CobrancaDoAluno,
  CobrancaResponse,
  FiltroDeSituacao,
  FormaDePagamento,
  Liquido,
  MesDoPainel,
  Painel,
  PeriodoDoPlano,
  SituacaoDaCobranca,
  SituacaoDaContratacao,
  ValorEQuantidade,
} from '../api/financeiroTipos';
import { centavosParaTela, SEM_DADO } from './formatos';
import { contagemParaTela, rotuloDoMes, rotuloDoMesCompleto } from './numeros';

/**
 * Regras puras do financeiro do aluno ao treinador. Dinheiro em centavos inteiros; `null` da API é "sem dado" e aparece
 * como "—" (nunca zero inventado). `vencida` e `diasDeAtraso` vêm da API, calculados em Brasília: nada aqui decide
 * "vencida" pela data do aparelho. O app nunca calcula valor de cobrança.
 */

// ---- Textos fixos ----

/** Dito ao lado de inadimplência, previsto e atrasado: o painel só enxerga cobranças que já existem. */
export const NOTA_CONSIDERA_GERADAS = 'considera as cobranças já geradas';

/** Rótulo fixo do resultado do mês: não é lucro, só o que foi registrado. */
export const ROTULO_RESULTADO_DO_MES = 'Resultado do mês (entradas − saídas registradas)';

export const TEXTO_LIQUIDO_INDISPONIVEL = 'indisponível';

export const AVISO_LIQUIDO =
  'O valor líquido ainda não é calculado: nenhuma taxa é descontada nem estimada. Os valores acima são os brutos.';

/** Texto recolhível "Como calculamos estes números". */
export const COMO_CALCULAMOS: readonly string[] = [
  'Recebido: soma das cobranças pagas no período, pela data do pagamento.',
  'A receber: cobranças em aberto com vencimento de hoje em diante.',
  'Em atraso: cobranças em aberto com vencimento anterior a hoje (horário de Brasília).',
  'Inadimplência: entre as cobranças que já venceram no período e não foram canceladas, a parte do valor que segue em aberto.',
  'Receita recorrente mensal: contratações ativas, sem parcela única, com o valor dividido pelos meses da periodicidade do plano.',
  `Previsto, atrasado e inadimplência ${NOTA_CONSIDERA_GERADAS}: cobranças que ainda não foram geradas não entram.`,
  'Resultado do mês: entradas menos saídas registradas, somando o recebido das cobranças com os lançamentos avulsos. Não é um resultado contábil.',
  'Com o filtro "Meus", os lançamentos avulsos ficam de fora, porque não pertencem a um aluno.',
];

// ---- Datas ----

/** "Hoje" de Brasília (UTC−3 fixo), independente do fuso do aparelho. Use em vez de `hojeIso` nas regras do financeiro. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Dias corridos entre duas datas ISO (`b - a`). */
function diasEntre(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

// ---- Rótulos ----

const PERIODICIDADES: Record<PeriodoDoPlano, string> = {
  MENSAL: 'Mensal',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
  PARCELA_UNICA: 'Parcela única',
};

export const OPCOES_DE_PERIODICIDADE: readonly { valor: PeriodoDoPlano; rotulo: string }[] = (
  Object.keys(PERIODICIDADES) as PeriodoDoPlano[]
).map((valor) => ({ valor, rotulo: PERIODICIDADES[valor] }));

export function rotuloDaPeriodicidade(p: PeriodoDoPlano | null | undefined): string {
  return p ? (PERIODICIDADES[p] ?? SEM_DADO) : SEM_DADO;
}

const FORMAS: Record<FormaDePagamento, string> = {
  DINHEIRO: 'Dinheiro',
  PIX_DIRETO: 'Pix direto',
  TRANSFERENCIA: 'Transferência',
  OUTRO: 'Outro',
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CARTAO: 'Cartão',
};

export function rotuloDaForma(f: FormaDePagamento | null | undefined): string {
  return f ? (FORMAS[f] ?? SEM_DADO) : SEM_DADO;
}

/** Só estas quatro podem ser escolhidas numa baixa manual; as demais só vêm de um provedor. */
export const FORMAS_MANUAIS: readonly { valor: FormaDePagamento; rotulo: string }[] = (
  ['DINHEIRO', 'PIX_DIRETO', 'TRANSFERENCIA', 'OUTRO'] as const
).map((valor) => ({ valor, rotulo: FORMAS[valor] }));

export type TomDoSelo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

export interface SeloFinanceiro {
  tom: TomDoSelo;
  rotulo: string;
}

/** Verde paga; âmbar em aberto; vermelho vencida (vem da API); cinza cancelada, estornada e contestada. */
export function seloDaCobranca(c: { situacao: SituacaoDaCobranca; vencida?: boolean }): SeloFinanceiro {
  switch (c.situacao) {
    case 'PAGA':
      return { tom: 'sucesso', rotulo: 'Paga' };
    case 'ABERTA':
      return c.vencida ? { tom: 'perigo', rotulo: 'Vencida' } : { tom: 'atencao', rotulo: 'Em aberto' };
    case 'CANCELADA':
      return { tom: 'neutro', rotulo: 'Cancelada' };
    case 'ESTORNADA':
      return { tom: 'neutro', rotulo: 'Estornada' };
    case 'CONTESTADA':
      return { tom: 'neutro', rotulo: 'Contestada' };
    default:
      return { tom: 'neutro', rotulo: SEM_DADO };
  }
}

export function seloDaContratacao(situacao: SituacaoDaContratacao): SeloFinanceiro {
  switch (situacao) {
    case 'ATIVA':
      return { tom: 'sucesso', rotulo: 'Ativa' };
    case 'PAUSADA':
      return { tom: 'atencao', rotulo: 'Pausada' };
    case 'ENCERRADA':
      return { tom: 'neutro', rotulo: 'Encerrada' };
    default:
      return { tom: 'neutro', rotulo: SEM_DADO };
  }
}

/** "3 dias de atraso", "1 dia de atraso"; sem dado da API, "—". */
export function atrasoParaTela(dias: number | null | undefined): string {
  if (typeof dias !== 'number' || !Number.isFinite(dias)) return SEM_DADO;
  if (dias <= 0) return SEM_DADO;
  return dias === 1 ? '1 dia de atraso' : `${dias} dias de atraso`;
}

// ---- Filtros da lista de cobranças ----

export const FILTROS_DE_SITUACAO: { valor: FiltroDeSituacao; rotulo: string }[] = [
  { valor: 'TODAS', rotulo: 'Todas' },
  { valor: 'ABERTA', rotulo: 'Em aberto' },
  { valor: 'VENCIDA', rotulo: 'Vencidas' },
  { valor: 'PAGA', rotulo: 'Pagas' },
  { valor: 'CANCELADA', rotulo: 'Canceladas' },
];

// ---- O que cada botão pode fazer (a API confere de novo) ----

/** Registrar pagamento e cancelar: só cobrança em aberto (as vencidas incluídas). */
export function podeRegistrarPagamento(c: Pick<CobrancaResponse, 'situacao'>): boolean {
  return c.situacao === 'ABERTA';
}

export function podeCancelarCobranca(c: Pick<CobrancaResponse, 'situacao'>): boolean {
  return c.situacao === 'ABERTA';
}

/** Desfazer: só uma baixa manual. Pagamento de provedor não se desfaz por aqui. */
export function podeDesfazerBaixa(c: Pick<CobrancaResponse, 'situacao' | 'provedor'>): boolean {
  return c.situacao === 'PAGA' && c.provedor === 'MANUAL';
}

// ---- Período do painel ----

export type AtalhoDePeriodo = '3m' | '6m' | '12m' | 'ano';

export const ATALHOS_DE_PERIODO: { valor: AtalhoDePeriodo; rotulo: string }[] = [
  { valor: '3m', rotulo: '3 meses' },
  { valor: '6m', rotulo: '6 meses' },
  { valor: '12m', rotulo: '12 meses' },
  { valor: 'ano', rotulo: 'Este ano' },
];

/**
 * `de` = primeiro dia do mês inicial; `ate` = último dia do mês final. Os atalhos de meses terminam no mês corrente;
 * "Este ano" vai de 1º de janeiro a 31 de dezembro (os meses futuros trazem o previsto).
 */
export function periodoDoPainel(atalho: AtalhoDePeriodo, hoje: string): { de: string; ate: string } {
  const [ano, mes] = hoje.split('-').map(Number);
  if (atalho === 'ano') return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
  const meses = atalho === '3m' ? 3 : atalho === '6m' ? 6 : 12;
  const inicio = new Date(Date.UTC(ano, mes - 1 - (meses - 1), 1));
  const ia = inicio.getUTCFullYear();
  const im = inicio.getUTCMonth() + 1;
  return {
    de: `${ia}-${doisDigitos(im)}-01`,
    ate: `${ano}-${doisDigitos(mes)}-${doisDigitos(ultimoDiaDoMes(ano, mes))}`,
  };
}

/** O mês de `hoje`, do dia 1 ao último dia (resultado do mês corrente). */
export function periodoDoMes(hoje: string): { de: string; ate: string } {
  const [ano, mes] = hoje.split('-').map(Number);
  return { de: `${ano}-${doisDigitos(mes)}-01`, ate: `${ano}-${doisDigitos(mes)}-${doisDigitos(ultimoDiaDoMes(ano, mes))}` };
}

// ---- Contas do painel ----

/** `12.5` → `12,5%`; nulo → "—" (nada venceu no período). */
export function percentualParaTela(p: number | null | undefined): string {
  if (typeof p !== 'number' || !Number.isFinite(p)) return SEM_DADO;
  const texto = Number.isInteger(p) ? String(p) : p.toFixed(1).replace('.', ',');
  return `${texto}%`;
}

/** Valor e quantidade: `R$ 300,00 (2 cobranças)`; sem valor, "—". */
export function valorEQuantidadeParaTela(v: ValorEQuantidade | null | undefined): string {
  if (!v || v.valorCentavos === null || v.valorCentavos === undefined) return SEM_DADO;
  const n = v.cobrancas;
  const quantidade = n === 1 ? '1 cobrança' : `${n} cobranças`;
  return `${centavosParaTela(v.valorCentavos)} (${quantidade})`;
}

export interface CartaoDoPainel {
  chave: string;
  titulo: string;
  valor: string;
  /** Linha pequena sob o valor. */
  detalhe?: string;
}

/** Os seis cartões, na ordem da tela. */
export function cartoesDoPainel(c: CartoesDoPainel): CartaoDoPainel[] {
  return [
    { chave: 'recebido', titulo: 'Recebido no período', valor: centavosParaTela(c.recebidoCentavos) },
    {
      chave: 'aReceber',
      titulo: 'A receber',
      valor: centavosParaTela(c.aReceberCentavos),
      detalhe: NOTA_CONSIDERA_GERADAS,
    },
    {
      chave: 'emAtraso',
      titulo: 'Em atraso',
      valor: centavosParaTela(c.emAtraso?.valorCentavos),
      detalhe:
        c.emAtraso && c.emAtraso.valorCentavos !== null
          ? `${contagemParaTela(c.emAtraso.cobrancas)} ${c.emAtraso.cobrancas === 1 ? 'cobrança' : 'cobranças'} - ${NOTA_CONSIDERA_GERADAS}`
          : NOTA_CONSIDERA_GERADAS,
    },
    {
      chave: 'recorrente',
      titulo: 'Receita recorrente mensal',
      valor: centavosParaTela(c.receitaRecorrenteMensalCentavos),
    },
    { chave: 'pagantes', titulo: 'Alunos pagantes', valor: contagemParaTela(c.alunosPagantes) },
    {
      chave: 'medio',
      titulo: 'Valor médio por aluno',
      valor: centavosParaTela(c.valorMedioPorAlunoCentavos),
    },
  ];
}

/** Linha de inadimplência: `12,5% - R$ 300,00 vencidos de R$ 2.400,00 cobrados`. */
export function inadimplenciaParaTela(i: Painel['inadimplencia'] | null | undefined): {
  percentual: string;
  detalhe: string;
} {
  if (!i) return { percentual: SEM_DADO, detalhe: NOTA_CONSIDERA_GERADAS };
  const percentual = percentualParaTela(i.percentual);
  if (i.percentual === null || i.vencidoCentavos === null || i.cobradoCentavos === null) {
    return { percentual, detalhe: `Nada venceu no período - ${NOTA_CONSIDERA_GERADAS}` };
  }
  return {
    percentual,
    detalhe: `${centavosParaTela(i.vencidoCentavos)} em aberto de ${centavosParaTela(i.cobradoCentavos)} que já venceram - ${NOTA_CONSIDERA_GERADAS}`,
  };
}

/** Líquido: sempre "indisponível" na Fase 1; nunca um desconto inventado. Mostra o bruto, quando houver. */
export function liquidoParaTela(l: Liquido | null | undefined): { valor: string; detalhe: string } {
  if (!l || !l.disponivel) {
    const bruto = l && l.brutoCentavos !== null && l.brutoCentavos !== undefined ? ` Bruto: ${centavosParaTela(l.brutoCentavos)}.` : '';
    return {
      valor: TEXTO_LIQUIDO_INDISPONIVEL,
      detalhe: `${l?.motivo ?? AVISO_LIQUIDO}${bruto}`,
    };
  }
  // Fases futuras: com taxa conhecida a API passa a mandar `disponivel`; até lá, o app não calcula nada.
  return { valor: centavosParaTela(l.brutoCentavos), detalhe: l.motivo ?? '' };
}

export interface ResultadoDoMesNaTela {
  rotulo: string;
  mes: string;
  recebido: string;
  entradas: string;
  saidas: string;
  resultado: string;
}

export function resultadoDoMesParaTela(r: Painel['resultadoDoMes'] | null | undefined): ResultadoDoMesNaTela {
  return {
    rotulo: ROTULO_RESULTADO_DO_MES,
    mes: rotuloDoMes(r?.mes),
    recebido: centavosParaTela(r?.recebidoCentavos),
    entradas: centavosParaTela(r?.entradasAvulsasCentavos),
    saidas: centavosParaTela(r?.saidasAvulsasCentavos),
    resultado: centavosParaTela(r?.resultadoCentavos),
  };
}

// ---- Gráfico mês a mês ----

export interface BarraDoMes {
  rotulo: string;
  realizado: number | null;
  previsto: number | null;
}

/** Série do painel em barras: realizado (recebido) e previsto. Valor ausente continua `null` (sem barra, "—" na tabela). */
export function serieDoGrafico(serie: readonly MesDoPainel[] | null | undefined): BarraDoMes[] {
  return (serie ?? []).map((m) => ({
    rotulo: rotuloDoMesCompleto(m),
    realizado: typeof m.recebidoCentavos === 'number' ? m.recebidoCentavos : null,
    previsto: typeof m.previstoCentavos === 'number' ? m.previstoCentavos : null,
  }));
}

/** Maior valor da série (para a escala do gráfico); 0 quando não há nenhum dado. */
export function maiorValorDoGrafico(barras: readonly BarraDoMes[]): number {
  let max = 0;
  for (const b of barras) {
    if (b.realizado !== null && b.realizado > max) max = b.realizado;
    if (b.previsto !== null && b.previsto > max) max = b.previsto;
  }
  return max;
}

/** A série tem algum valor para desenhar? */
export function graficoTemDados(barras: readonly BarraDoMes[]): boolean {
  return barras.some((b) => b.realizado !== null || b.previsto !== null);
}

/** Uma frase por mês, para leitor de tela e para quem prefere texto. */
export function descricaoDoGrafico(barras: readonly BarraDoMes[]): string {
  if (!graficoTemDados(barras)) return 'Sem valores recebidos ou previstos no período.';
  return barras
    .map((b) => {
      const partes = [`recebido ${centavosParaTela(b.realizado)}`];
      if (b.previsto !== null) partes.push(`previsto ${centavosParaTela(b.previsto)}`);
      return `${b.rotulo}: ${partes.join(', ')}`;
    })
    .join('. ');
}

/** Rótulo curto do eixo, a partir de reais (não centavos): 500 → `R$ 500`; 1.200 → `R$ 1,2 mil`; 2.500.000 → `R$ 2,5 mi`. */
export function reaisCompactos(reais: number): string {
  const abs = Math.abs(reais);
  const sinal = reais < 0 ? '-' : '';
  const curto = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  if (abs >= 1_000_000) return `${sinal}R$ ${curto(abs / 1_000_000)} mi`;
  if (abs >= 1000) return `${sinal}R$ ${curto(abs / 1000)} mil`;
  return `${sinal}R$ ${curto(abs)}`;
}

/** Linhas da tabela alternativa ao gráfico (celular ou gráficos desligados). */
export function linhasDaTabelaDoGrafico(barras: readonly BarraDoMes[]): {
  rotulo: string;
  realizado: string;
  previsto: string;
}[] {
  return barras.map((b) => ({
    rotulo: b.rotulo,
    realizado: centavosParaTela(b.realizado),
    previsto: centavosParaTela(b.previsto),
  }));
}

// ---- Validações dos formulários (a API confere de novo) ----

export const LIMITES = {
  nomeDoPlano: 80,
  observacao: 300,
  motivo: 300,
  motivoDoValor: 200,
  descricaoDoLancamento: 120,
  categoria: 60,
} as const;

/** Mesmo teto da API: R$ 10 milhões em centavos. */
export const VALOR_MAXIMO_CENTAVOS = 1_000_000_000;

export function validarValor(centavos: number | null): string | null {
  if (centavos === null) return 'Informe um valor maior que zero, por exemplo 150,00.';
  if (centavos > VALOR_MAXIMO_CENTAVOS) return 'Esse valor passa do máximo permitido (R$ 10.000.000,00).';
  return null;
}

/** Baixa manual: data obrigatória e nunca no futuro (Brasília). A forma vem de uma lista fixa. */
export function validarBaixa(dados: { data: string | null | undefined; forma: string | null }, hoje: string): string | null {
  if (!dados.data) return 'Informe a data do pagamento.';
  if (dados.data > hoje) return 'A data do pagamento não pode ser no futuro.';
  if (!dados.forma || !FORMAS_MANUAIS.some((f) => f.valor === dados.forma)) return 'Escolha a forma de pagamento.';
  return null;
}

export function validarPlano(dados: { nome: string; valorCentavos: number | null }): string | null {
  const nome = dados.nome.trim();
  if (!nome) return 'Informe o nome do plano.';
  if (nome.length > LIMITES.nomeDoPlano) return `O nome pode ter até ${LIMITES.nomeDoPlano} caracteres.`;
  return validarValor(dados.valorCentavos);
}

/**
 * Valor diferente do plano exige o motivo. Valor igual (ou em branco) usa o do plano. Sem o valor do plano à mão (plano
 * arquivado, ao alterar), a API decide.
 */
export function validarContratacao(dados: {
  planoId: string | null;
  valorCentavos: number | null;
  valorDoPlanoCentavos: number | null;
  motivoValor: string;
  inicio: string | null | undefined;
  diaVencimento: number | null | undefined;
}): string | null {
  if (!dados.planoId) return 'Escolha o plano.';
  if (!dados.inicio) return 'Informe a data de início.';
  const dia = dados.diaVencimento;
  if (typeof dia !== 'number' || !Number.isInteger(dia) || dia < 1 || dia > 31) return 'O dia de vencimento vai de 1 a 31.';
  if (dados.valorCentavos !== null) {
    const erro = validarValor(dados.valorCentavos);
    if (erro) return erro;
    if (dados.valorDoPlanoCentavos !== null && dados.valorCentavos !== dados.valorDoPlanoCentavos && !dados.motivoValor.trim()) {
      return 'Explique por que o valor é diferente do plano.';
    }
  }
  if (dados.motivoValor.length > LIMITES.motivoDoValor) return `O motivo pode ter até ${LIMITES.motivoDoValor} caracteres.`;
  return null;
}

export function validarLancamento(dados: {
  data: string | null | undefined;
  descricao: string;
  valorCentavos: number | null;
  categoria: string;
}): string | null {
  if (!dados.data) return 'Informe a data do lançamento.';
  const descricao = dados.descricao.trim();
  if (!descricao) return 'Descreva o lançamento.';
  if (descricao.length > LIMITES.descricaoDoLancamento) return `A descrição pode ter até ${LIMITES.descricaoDoLancamento} caracteres.`;
  if (dados.categoria.trim().length > LIMITES.categoria) return `A categoria pode ter até ${LIMITES.categoria} caracteres.`;
  return validarValor(dados.valorCentavos);
}

// ---- Aluno ----

/** Dias de antecedência a partir dos quais uma cobrança em aberto vira pendência no Início do aluno. */
export const DIAS_DE_AVISO_DO_PAGAMENTO = 3;

/**
 * Cobrança que merece aviso ao aluno: vencida (decidido pela API) ou que vence em até 3 dias. Cobrança só vence
 * "em breve" se ainda está aberta; paga ou cancelada nunca aparece.
 */
export function pagamentoPendente(abertas: readonly CobrancaDoAluno[] | null | undefined, hoje: string): CobrancaDoAluno[] {
  return (abertas ?? []).filter(
    (c) => c.situacao === 'ABERTA' && (c.vencida || diasEntre(hoje, c.vencimento) <= DIAS_DE_AVISO_DO_PAGAMENTO),
  );
}

// ---- Exportação ----

/** `financeiro-2026-01-a-2026-06.csv`: o nome é montado aqui porque a requisição não expõe o cabeçalho da resposta. */
export function nomeDoCsv(de: string, ate: string): string {
  return `financeiro-${de}-a-${ate}.csv`;
}
