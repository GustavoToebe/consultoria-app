/**
 * Contratos do financeiro do aluno ao treinador (`api/.../pagamentos/PagamentosDtos.java`). Dinheiro sempre em
 * **centavos** inteiros; datas civis `AAAA-MM-DD`; `null` = sem dado (nunca zero inventado). O app nunca envia valor de
 * cobrança: ele sai do plano ou da contratação, no servidor.
 */

export type PeriodoDoPlano = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'PARCELA_UNICA';
export type SituacaoDaContratacao = 'ATIVA' | 'PAUSADA' | 'ENCERRADA';
export type SituacaoDaCobranca = 'ABERTA' | 'PAGA' | 'CANCELADA' | 'ESTORNADA' | 'CONTESTADA';
/** As quatro primeiras são do registro manual; `PIX` e `CARTAO` só vêm do recebimento online (InfinitePay). */
export type FormaDePagamento = 'DINHEIRO' | 'PIX_DIRETO' | 'TRANSFERENCIA' | 'OUTRO' | 'PIX' | 'CARTAO';
export type TipoDeLancamento = 'ENTRADA' | 'SAIDA';

// ---- Plano comercial ----

/** Opcionais nulos viram o padrão do servidor. `versao` só na edição. */
export interface PlanoRequest {
  nome: string;
  valorCentavos: number;
  periodicidade: PeriodoDoPlano;
  versao?: number | null;
}

export interface PlanoResponse {
  id: string;
  nome: string;
  valorCentavos: number;
  periodicidade: PeriodoDoPlano;
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

/**
 * `plano` nulo = nenhum plano comercial contratado. `pagamentoOnline`: a consultoria tem o recebimento online configurado
 * e ligado (a InfiniteTag nunca vai ao aluno); só então o "Pagar" aparece (na web sempre; no celular, só com a chave da
 * plataforma ligada, `pagarNoIos`/`pagarNoAndroid` do `/eu`).
 */
export interface FinanceiroDoAluno {
  plano: PlanoDoAluno | null;
  abertas: CobrancaDoAluno[];
  historico: CobrancaDoAluno[];
  pagamentoOnline: boolean;
}

// ---- Recebimento online (InfinitePay, conta do treinador) ----

/** O que a API guarda do recebimento online. A API Key nunca volta: só `apiKeyConfigurada`. `versao` nula = nada configurado. */
export interface RecebimentoOnline {
  habilitado: boolean;
  configurado: boolean;
  infiniteTag: string | null;
  apiKeyConfigurada: boolean;
  /** Quem paga os juros do parcelamento no cartão; nulo quando não há credencial. */
  jurosDoParcelamento: JurosDoParcelamento | null;
  versao: number | null;
}

/** `TREINADOR` (ele absorve os juros) só vale com a API Key configurada. */
export type JurosDoParcelamento = 'ALUNO' | 'TREINADOR';

/**
 * `apiKey` ausente mantém a que existe; `removerApiKey` a apaga (não mande as duas). `versao` fica nula ao criar e é
 * obrigatória (a que a API devolveu) ao alterar.
 */
export interface RecebimentoOnlineRequest {
  infiniteTag: string;
  apiKey?: string;
  removerApiKey?: boolean;
  /** Omitido ao criar = `ALUNO`; omitido ao alterar = não muda. `TREINADOR` sem API Key dá 422 no campo. */
  jurosDoParcelamento?: JurosDoParcelamento;
  versao?: number | null;
}

/** O que a volta do navegador depois do pagamento manda à API (`POST /aluno/financeiro/retorno-pagamento`, 204). */
export interface RetornoDoPagamento {
  orderNsu: string;
  transactionNsu: string;
  slug?: string;
  captureMethod?: string;
}

/** Link de pagamento de uma cobrança em aberto (`https`, aberto fora do app, sem token). */
export interface LinkDePagamento {
  url: string;
}

// ---- Pagamentos para conferir ----

/**
 * Por que um pagamento recebido pelo provedor não deu baixa sozinho. Nada é baixado: o treinador decide. `ESTORNO_INFORMADO`:
 * um pagamento já baixado que a InfinitePay informou estornado; a cobrança continua PAGA e o treinador a ajusta à mão.
 */
export type MotivoDaConferencia =
  | 'COBRANCA_CANCELADA'
  | 'COBRANCA_JA_PAGA'
  | 'VALOR_DIFERENTE'
  | 'LINK_DIFERENTE'
  | 'FORMA_DESCONHECIDA'
  | 'COBRANCA_NAO_ENCONTRADA'
  | 'CONSULTA_FALHOU'
  | 'ESTORNO_INFORMADO';

/**
 * `alunoId`, `alunoNome`, `cobrancaId`, `competencia` e `valorCobrancaCentavos` são nulos quando o pagamento não casou com
 * uma cobrança desta consultoria (a API só acha o aluno pela cobrança). `valorPagoCentavos` é o que o provedor confirmou:
 * nulo só quando a consulta ao provedor falhou. `competencia` é a data civil `AAAA-MM-DD` da cobrança e `recebidoEm`, o
 * instante ISO-8601 em UTC do aviso.
 */
export interface ConferenciaDePagamento {
  id: string;
  alunoId: string | null;
  alunoNome: string | null;
  cobrancaId: string | null;
  competencia: string | null;
  valorCobrancaCentavos: number | null;
  valorPagoCentavos: number | null;
  motivo: MotivoDaConferencia;
  recebidoEm: string;
}

export interface ConferenciasDePagamento {
  itens: ConferenciaDePagamento[];
}

// ---- Lembretes de cobrança por e-mail ----

/**
 * Configuração dos lembretes (`GET/PUT /financeiro/lembretes`). Sem configuração gravada vem desligada, com 3 dias antes, no
 * dia e 3 dias depois, e `versao` nula. `emailDisponivel` falso = o e-mail do app está desligado e nenhum lembrete sai.
 */
export interface Lembretes {
  ligado: boolean;
  diasAntes: number;
  noDia: boolean;
  diasDepois: number;
  versao: number | null;
  emailDisponivel: boolean;
}

/** `diasAntes` de 0 a 15 e `diasDepois` de 0 a 30 (0 = aquele lembrete não sai). `versao` nula só ao criar. */
export interface LembretesRequest {
  ligado: boolean;
  diasAntes: number;
  noDia: boolean;
  diasDepois: number;
  versao: number | null;
}

export type TipoDeLembrete = 'ANTES' | 'NO_DIA' | 'DEPOIS';
export type SituacaoDoLembrete = 'PENDENTE' | 'ENVIADO' | 'FALHOU' | 'CANCELADO';

/** Um lembrete da cobrança. `motivo` só no cancelado (código fixo, ver `dominio/lembretesDeCobranca`). */
export interface LembreteDaCobranca {
  id: string;
  tipo: TipoDeLembrete;
  situacao: SituacaoDoLembrete;
  motivo: string | null;
  dataPrevista: string;
  enviadoEm: string | null;
  atualizadoEm: string;
}

/**
 * Os lembretes de uma cobrança e a mensagem pronta para o WhatsApp (o mesmo texto do e-mail, para hoje). `whatsapp` nulo =
 * cobrança que não está em aberto ou aluno inativo; `telefone` nulo = o aluno não tem telefone.
 */
export interface LembretesDaCobranca {
  itens: LembreteDaCobranca[];
  whatsapp: { telefone: string | null; mensagem: string } | null;
  /** O aluno desligou os lembretes por e-mail para si (`PUT /aluno/lembretes-de-cobranca`); o WhatsApp manual segue valendo. */
  alunoDesligou: boolean;
}

/** `GET/PUT /aluno/lembretes-de-cobranca`: se o aluno quer receber os lembretes de pagamento por e-mail (ligado por padrão). */
export interface LembretesDoAluno {
  receber: boolean;
}
