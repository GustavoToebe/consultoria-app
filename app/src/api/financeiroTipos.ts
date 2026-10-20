/**
 * Contratos do financeiro do aluno ao treinador (`api/.../pagamentos/PagamentosDtos.java`). Dinheiro sempre em
 * **centavos** inteiros; datas civis `AAAA-MM-DD`; `null` = sem dado (nunca zero inventado). O app nunca envia valor de
 * cobrança: ele sai do plano ou da contratação, no servidor.
 */

export type PeriodoDoPlano = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'PARCELA_UNICA';
export type TaxaDoCartao = 'ALUNO' | 'TREINADOR';
export type SituacaoDaContratacao = 'ATIVA' | 'PAUSADA' | 'ENCERRADA';
export type SituacaoDaCobranca = 'ABERTA' | 'PAGA' | 'CANCELADA' | 'ESTORNADA' | 'CONTESTADA';
/** As quatro primeiras são do registro manual; as outras só vêm de um provedor (Fase 2). */
export type FormaDePagamento = 'DINHEIRO' | 'PIX_DIRETO' | 'TRANSFERENCIA' | 'OUTRO' | 'PIX' | 'BOLETO' | 'CARTAO';
export type TipoDeLancamento = 'ENTRADA' | 'SAIDA';

// ---- Plano comercial ----

/** Opcionais nulos viram o padrão do servidor. `versao` só na edição. */
export interface PlanoRequest {
  nome: string;
  valorCentavos: number;
  periodicidade: PeriodoDoPlano;
  aceitaPix?: boolean | null;
  aceitaBoleto?: boolean | null;
  aceitaCartao?: boolean | null;
  aceitaManual?: boolean | null;
  maxParcelas?: number | null;
  taxaCartao?: TaxaDoCartao | null;
  versao?: number | null;
}

export interface PlanoResponse {
  id: string;
  nome: string;
  valorCentavos: number;
  periodicidade: PeriodoDoPlano;
  aceitaPix: boolean;
  aceitaBoleto: boolean;
  aceitaCartao: boolean;
  aceitaManual: boolean;
  maxParcelas: number;
  taxaCartao: TaxaDoCartao;
  arquivado: boolean;
  criadoEm: string;
  versao: number;
}

export interface VersaoRequest {
  versao: number;
}

// ---- Contratação ----

/** `valorCentavos` nulo = o valor do plano; valor diferente do plano exige `motivoValor`. */
export interface ContratarRequest {
  planoComercialId: string;
  valorCentavos?: number | null;
  motivoValor?: string | null;
  inicio: string;
  diaVencimento: number;
}

export interface AlterarContratacaoRequest {
  valorCentavos: number;
  motivoValor?: string | null;
  diaVencimento: number;
  versao: number;
}

export interface ContratacaoResponse {
  id: string;
  alunoId: string;
  planoComercialId: string;
  planoNome: string | null;
  periodicidade: PeriodoDoPlano;
  valorCentavos: number;
  motivoValor: string | null;
  inicio: string;
  diaVencimento: number;
  situacao: SituacaoDaContratacao;
  encerradaEm: string | null;
  criadoEm: string;
  versao: number;
}

// ---- Cobrança ----

export interface BaixaManualRequest {
  data: string;
  forma: FormaDePagamento;
  observacao?: string | null;
  versao: number;
}

/** Desfazer a baixa e cancelar a cobrança: motivo obrigatório, versão conferida. */
export interface MotivoRequest {
  motivo: string;
  versao: number;
}

/** `vencida` e `diasDeAtraso` vêm calculados pela API (Brasília): a tela nunca decide vencida pela data do aparelho. */
export interface CobrancaResponse {
  id: string;
  contratacaoId: string;
  alunoId: string;
  alunoNome: string | null;
  planoNome: string | null;
  competencia: string;
  vencimento: string;
  valorCentavos: number;
  situacao: SituacaoDaCobranca;
  vencida: boolean;
  diasDeAtraso: number | null;
  forma: FormaDePagamento | null;
  provedor: string | null;
  pagoEm: string | null;
  baixaPor: string | null;
  baixaPorNome: string | null;
  observacao: string | null;
  motivo: string | null;
  versao: number;
}

export interface PaginaCobrancas {
  itens: CobrancaResponse[];
  total: number;
  pagina: number;
}

/** `VENCIDA` é só filtro: é ABERTA com vencimento anterior a hoje (Brasília). `ABERTA` inclui as vencidas. */
export type FiltroDeSituacao = 'TODAS' | 'ABERTA' | 'VENCIDA' | 'PAGA' | 'CANCELADA' | 'ESTORNADA' | 'CONTESTADA';

// ---- Lançamentos avulsos ----

export interface LancamentoRequest {
  data: string;
  descricao: string;
  valorCentavos: number;
  tipo: TipoDeLancamento;
  categoria?: string | null;
  versao?: number | null;
}

export interface LancamentoResponse {
  id: string;
  data: string;
  descricao: string;
  valorCentavos: number;
  tipo: TipoDeLancamento;
  categoria: string | null;
  criadoEm: string;
  versao: number;
}

export interface PaginaLancamentos {
  itens: LancamentoResponse[];
  total: number;
  pagina: number;
}

// ---- Painel ----

export interface PeriodoDoPainel {
  de: string;
  ate: string;
}

export interface ValorEQuantidade {
  valorCentavos: number | null;
  cobrancas: number;
}

export interface CartoesDoPainel {
  recebidoCentavos: number | null;
  aReceberCentavos: number | null;
  emAtraso: ValorEQuantidade;
  receitaRecorrenteMensalCentavos: number | null;
  alunosPagantes: number | null;
  valorMedioPorAlunoCentavos: number | null;
}

/** Um mês da série (`mes` = `AAAA-MM`). `previstoCentavos` só de hoje em diante; as avulsas são nulas com o filtro "meus". */
export interface MesDoPainel {
  mes: string;
  parcial: boolean;
  recebidoCentavos: number | null;
  previstoCentavos: number | null;
  entradasAvulsasCentavos: number | null;
  saidasAvulsasCentavos: number | null;
  resultadoCentavos: number | null;
}

/** `percentual` de 0 a 100 com uma casa; nulo quando nada venceu no período. */
export interface InadimplenciaDoPainel {
  percentual: number | null;
  vencidoCentavos: number | null;
  cobradoCentavos: number | null;
}

export interface PorForma {
  forma: FormaDePagamento;
  cobrancas: number;
  valorCentavos: number;
}

export interface PorPlano {
  planoId: string;
  nome: string;
  cobrancas: number;
  valorCentavos: number;
}

export interface MovimentoDeAlunos {
  mes: string;
  contratacoesNovas: number | null;
  contratacoesEncerradas: number | null;
}

export interface ProximosRecebimentos {
  /** De onde vem o previsto (`VENCIMENTO` na Fase 1; um provedor, depois). */
  fonte: string;
  em7Dias: ValorEQuantidade;
  em30Dias: ValorEQuantidade;
}

/** Rótulo fixo "entradas − saídas registradas": não é lucro. Avulsas nulas com o filtro "meus". */
export interface ResultadoDoMes {
  rotulo: string;
  mes: string;
  recebidoCentavos: number | null;
  entradasAvulsasCentavos: number | null;
  saidasAvulsasCentavos: number | null;
  resultadoCentavos: number | null;
}

/** Na Fase 1 não há taxa conhecida: `disponivel` é sempre falso e nada é descontado. */
export interface Liquido {
  disponivel: boolean;
  motivo: string | null;
  brutoCentavos: number | null;
}

export interface Painel {
  periodo: PeriodoDoPainel;
  somenteMeus: boolean;
  cartoes: CartoesDoPainel;
  serie: MesDoPainel[];
  inadimplencia: InadimplenciaDoPainel;
  porForma: PorForma[];
  porPlano: PorPlano[];
  movimentoDeAlunos: MovimentoDeAlunos[];
  proximosRecebimentos: ProximosRecebimentos;
  resultadoDoMes: ResultadoDoMes;
  liquido: Liquido;
}

export interface Inadimplente {
  cobrancaId: string;
  alunoId: string;
  alunoNome: string | null;
  valorCentavos: number;
  vencimento: string;
  diasDeAtraso: number;
}

export interface PaginaInadimplentes {
  itens: Inadimplente[];
  total: number;
  valorTotalCentavos: number | null;
  pagina: number;
}

// ---- Aluno ----

/** O que o aluno vê do próprio plano: sem observação interna, motivo nem quem deu a baixa. */
export interface PlanoDoAluno {
  contratacaoId: string;
  planoNome: string | null;
  valorCentavos: number;
  periodicidade: PeriodoDoPlano;
  situacao: SituacaoDaContratacao;
  proximoVencimento: string | null;
}

export interface CobrancaDoAluno {
  id: string;
  competencia: string;
  vencimento: string;
  valorCentavos: number;
  situacao: SituacaoDaCobranca;
  vencida: boolean;
  forma: FormaDePagamento | null;
  pagoEm: string | null;
}

/** `plano` nulo = nenhum plano comercial contratado. */
export interface FinanceiroDoAluno {
  plano: PlanoDoAluno | null;
  abertas: CobrancaDoAluno[];
  historico: CobrancaDoAluno[];
}
