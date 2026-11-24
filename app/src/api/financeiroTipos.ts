/**
 * Contratos do financeiro do aluno ao treinador (`api/.../pagamentos/PagamentosDtos.java`). Dinheiro sempre em
 * **centavos** inteiros; datas civis `AAAA-MM-DD`; `null` = sem dado (nunca zero inventado). O app nunca envia valor de
 * cobrança: ele sai do plano ou da contratação, no servidor.
 */

export type PeriodoDoPlano = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'PARCELA_UNICA';
export type SituacaoDaContratacao = 'ATIVA' | 'PAUSADA' | 'ENCERRADA';
/** `RENEGOCIADA` (D14): entrou num acordo; fica fora de totais, vencido, lembretes e "Pagar" (contrato em `financeiroRenegociar.ts`). */
export type SituacaoDaCobranca = 'ABERTA' | 'PAGA' | 'CANCELADA' | 'ESTORNADA' | 'CONTESTADA' | 'RENEGOCIADA';
/**
 * As quatro primeiras são do registro manual; `PIX` e `CARTAO` só vêm do recebimento online (InfinitePay) e `KIWIFY`, da
 * baixa automática da assinatura na Kiwify (contrato em `financeiroKiwify.ts`).
 */
export type FormaDePagamento = 'DINHEIRO' | 'PIX_DIRETO' | 'TRANSFERENCIA' | 'OUTRO' | 'PIX' | 'CARTAO' | 'KIWIFY';
/** Quem cobra a cobrança sozinho (D18): `KIWIFY` = mensalidade de plano com "Assinatura cobrada pela Kiwify"; nulo = ninguém. */
export type CobrancaAutomatica = 'KIWIFY';
export type TipoDeLancamento = 'ENTRADA' | 'SAIDA';
/**
 * `SAIDA` é a cobrança de saída (criada ao encerrar o plano); não tem link de pagamento. `AVULSA` é a lançada pelo treinador
 * para vários alunos (sem contratação nem plano: `descricao` diz o que é). `RENEGOCIACAO` é a parcela de um acordo (D14),
 * com as regras da avulsa e a descrição fixa do servidor. Não confundir com `TipoDeLancamento`.
 */
export type TipoDaCobranca = 'MENSALIDADE' | 'SAIDA' | 'AVULSA' | 'RENEGOCIACAO';
/** As formas de recebimento que o treinador liga (e que o aluno vê em `FinanceiroDoAluno.formasDePagamento`). `MANUAL` só informa. */
export type FormaDeRecebimento = 'INFINITEPAY' | 'LINK_PROPRIO' | 'PIX' | 'MANUAL';
export type TipoDeChavePix = 'CPF' | 'CNPJ' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA';

// ---- Plano comercial ----

/**
 * Opcionais nulos viram o padrão do servidor. `versao` só na edição. `tempoMinimoMeses` (1 a 60) só em plano `MENSAL`: em
 * outra periodicidade vai nulo (a API responde 422 `PLANO_INVALIDO` no campo). `regraDeSaida` é o texto do contrato (até 500;
 * em branco vira nulo no servidor). O `PUT` substitui inteiro: ao alterar, reenvie os dois com o valor atual.
 */
export interface PlanoRequest {
  nome: string;
  valorCentavos: number;
  periodicidade: PeriodoDoPlano;
  tempoMinimoMeses?: number | null;
  regraDeSaida?: string | null;
  /** Link de pagamento próprio (https, opcional, até 500). O `PUT` substitui inteiro: nulo APAGA, então reenvie o atual. */
  linkDePagamento?: string | null;
  /** O que o plano inclui (D13): obrigatórios; pelo menos um `true`, senão 422 `PLANO_INVALIDO` no `incluiTreino` (ausente vale `true`). */
  incluiTreino: boolean;
  incluiDieta: boolean;
  /** "Assinatura cobrada pela Kiwify" (só plano mensal). O `PUT` substitui inteiro: reenvie o gravado (`financeiroKiwify.ts`). */
  kiwifyAssinatura?: boolean;
  /** O id do produto na Kiwify: obrigatório com `kiwifyAssinatura`; nulo sem ela. */
  kiwifyProdutoId?: string | null;
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
  /** Mínimo em meses (só plano mensal); nulo = sem mínimo. */
  tempoMinimoMeses: number | null;
  /** Lembrete da regra de saída do contrato (texto do treinador); nulo = sem regra. Nunca vai ao aluno. */
  regraDeSaida: string | null;
  /** Link de pagamento próprio do plano (https); nulo = sem link. */
  linkDePagamento: string | null;
  /** O que o plano inclui (D13; os planos antigos nascem com os dois ligados). */
  incluiTreino: boolean;
  incluiDieta: boolean;
  /** Assinatura cobrada pela Kiwify (D17); opcional só no tipo (fixtures antigas): ausente = desligada. */
  kiwifyAssinatura?: boolean;
  kiwifyProdutoId?: string | null;
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
  primeiroPeriodoPago?: boolean;
}

/**
 * O `PUT` substitui inteiro: `minimoAte` é sempre enviado (o atual, ou outro `AAAA-MM-DD`); nulo APAGA o mínimo. Entre o início
 * da contratação e 60 meses depois, só em contratação mensal (422 `CONTRATACAO_INVALIDA` no campo `minimoAte`).
 */
export interface AlterarContratacaoRequest {
  valorCentavos: number;
  motivoValor?: string | null;
  diaVencimento: number;
  minimoAte: string | null;
  versao: number;
}

export interface ContratacaoResponse {
  id: string;
  alunoId: string;
  alunoNome?: string | null;
  alunoTelefone?: string | null;
  planoComercialId: string;
  planoNome: string | null;
  periodicidade: PeriodoDoPlano;
  valorCentavos: number;
  motivoValor: string | null;
  inicio: string;
  diaVencimento: number;
  situacao: SituacaoDaContratacao;
  encerradaEm: string | null;
  terminoVigencia?: string | null;
  diasRestantesVigencia?: number | null;
  alertaRenovacao?: 'EM_DIA' | 'PROXIMO_VENCIMENTO' | null;
  criadoEm: string;
  versao: number;
  /** Fim do tempo mínimo (`AAAA-MM-DD`); nulo = sem mínimo. É a competência N+1 (início + N meses), não o último dia. */
  minimoAte: string | null;
}

// ---- Encerrar com cobrança de saída ----

export type OpcaoDeSaida = 'FALTAM' | 'VIGENTE' | 'OUTRO' | 'NAO_COBRAR';

/**
 * `FALTAM` e `VIGENTE`: o servidor confere `valorCentavos` com a conta dele (409 `VALOR_DA_SAIDA_MUDOU` se mudou); `FALTAM`
 * leva também `cobrancasACancelar` (os ids da prévia; `VIGENTE` com lista dá o mesmo 409). `OUTRO`: valor digitado, maior que
 * zero até 100.000.000 (R$ 1.000.000,00), sem cancelar nada. `vencimento` (`AAAA-MM-DD`) nulo = hoje; vai de hoje a hoje + 1 ano.
 */
export interface SaidaRequest {
  opcao: OpcaoDeSaida;
  valorCentavos?: number | null;
  vencimento?: string | null;
  cobrancasACancelar?: string[] | null;
}

/** `saida` ausente (ou `NAO_COBRAR`) encerra como sempre: as cobranças abertas ficam. `versao` é a da contratação. */
export interface EncerrarContratacaoRequest {
  versao: number;
  saida?: SaidaRequest | null;
}

export interface GrupoDeAbertas {
  quantidade: number;
  valorCentavos: number;
}

/** `motivo` (texto pronto) só quando indisponível; `valorCentavos` só em `FALTAM` e `VIGENTE` disponíveis. */
export interface OpcaoDaPrevia {
  opcao: OpcaoDeSaida;
  disponivel: boolean;
  valorCentavos: number | null;
  motivo: string | null;
}

/**
 * `GET /contratacoes/{id}/previa-de-encerramento` (`FINANCEIRO_LER`; contratação já encerrada = 409 `CONTRATACAO_ENCERRADA`).
 * `vencidas` ficam em aberto; `aVencerNoMinimo` são as que `FALTAM` cancela (ids em `cobrancasACancelar`, `comLinkVivo` delas
 * têm link ainda válido); `aVencerQueFicam` são as abertas a vencer que NENHUMA opção cancela (competência a partir de
 * `minimoAte` ou, sem mínimo, todas as a vencer). `mesesQueFaltam` = `aVencerNoMinimo.quantidade` + `mesesNaoGerados`.
 * `regraDeSaida` é o lembrete do contrato (texto do treinador). Todos os números são da API: a tela só desenha.
 */
export interface PreviaDoEncerramento {
  contratacaoId: string;
  periodicidade: PeriodoDoPlano;
  situacao: SituacaoDaContratacao;
  minimoAte: string | null;
  mesesQueFaltam: number;
  regraDeSaida: string | null;
  vencidas: GrupoDeAbertas;
  aVencerNoMinimo: GrupoDeAbertas;
  aVencerQueFicam: GrupoDeAbertas;
  cobrancasACancelar: string[];
  comLinkVivo: number;
  mesesNaoGerados: number;
  valorDosNaoGeradosCentavos: number;
  opcoes: OpcaoDaPrevia[];
}

/**
 * `GET /alunos/{id}/resumo-da-saida` (`FINANCEIRO_LER`; 503 com o financeiro desligado): o que inativar o aluno faz com o
 * financeiro (todas as contratações). `aCancelar` = mensalidades abertas que ainda não venceram; `emAberto` = fica (vencidas e
 * cobrança de saída). `mesesQueFaltam` > 0 = o mínimo se perde sem cobrança de saída. `minimoAte` nulo = sem mínimo.
 */
export interface ResumoDaSaidaDoAluno {
  aCancelar: GrupoDeAbertas;
  emAberto: GrupoDeAbertas;
  minimoAte: string | null;
  mesesQueFaltam: number;
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
  /** Nulo só na `AVULSA` (como `planoNome` e `competencia`). */
  contratacaoId: string | null;
  alunoId: string;
  alunoNome: string | null;
  planoNome: string | null;
  competencia: string | null;
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
  /** Quando a linha da cobrança foi gerada (a "Emissão"). Opcional só no tipo (fixtures antigas); a API sempre manda. */
  criadoEm?: string;
  /** A transação no provedor (pagamento online); nulo na baixa manual. */
  idExterno?: string | null;
  /** CPF do aluno, só com `ALUNO_SENSIVEL_LER` (nulo sem ela ou sem CPF). Dado sensível: nunca em log nem no endereço. */
  alunoCpf?: string | null;
  /** `SAIDA` = cobrança de saída: sem link de pagamento; no app do aluno nunca se chama "Mensalidade". */
  tipo: TipoDaCobranca;
  /** O que é a cobrança, só na `AVULSA` (até 150 com o "(Parcela k/n)") e na `RENEGOCIACAO` (texto fixo); nulo nas outras. */
  descricao: string | null;
  /** O acordo de renegociação (D14): nas originais RENEGOCIADA e nas parcelas RENEGOCIACAO. Opcional só no tipo (fixtures antigas). */
  acordoId?: string | null;
  /** `KIWIFY` = mensalidade cobrada pela Kiwify (D18); nulo ou ausente = não. */
  cobrancaAutomatica?: CobrancaAutomatica | null;
}

/** `POST /cobrancas/baixa-em-lote`: o mesmo registro manual de cada cobrança, sem valor (o servidor decide), 1 a 100 itens. */
export interface BaixaEmLoteRequest {
  itens: { cobrancaId: string; versao: number }[];
  data: string;
  forma: FormaDePagamento;
  observacao?: string | null;
}

/**
 * `codigo` nulo quando deu certo; senão o código estável da recusa (o mesmo da baixa individual). `url` só no lote de links
 * (`POST /cobrancas/link-em-lote`), nos itens `ok`.
 */
export interface ResultadoDoItemDoLote {
  cobrancaId: string;
  ok: boolean;
  codigo: string | null;
  url?: string | null;
}

/** `POST /cobrancas/cancelar-em-lote`: o mesmo cancelamento de cada cobrança, 1 a 100 itens, com `versao` e um motivo comum. */
export interface CancelarEmLoteRequest {
  itens: { cobrancaId: string; versao: number }[];
  motivo?: string | null;
}

/** `POST /cobrancas/link-em-lote` e `POST /financeiro/exportacao/selecionadas` (esta devolve o CSV): 1 a 100 ids. */
export interface CobrancasSelecionadasRequest {
  cobrancaIds: string[];
}

/** `POST /financeiro/cobrancas-avulsas`: `valorCentavos` é o de CADA cobrança (cada parcela, cada aluno); segunda exceção da regra do valor do servidor. */
export interface CobrancaAvulsaRequest {
  /** UUID do pedido, criado ao abrir a Folha (D11): repetido, a API devolve 200 com o que já gerou, sem gerar de novo. */
  pedidoId: string;
  alunoIds: string[];
  descricao: string;
  valorCentavos: number;
  primeiroVencimento: string;
  parcelas: number;
}

/** 201 (ou 200 quando o `pedidoId` já foi gerado): só contagens (tudo ou nada). */
export interface CobrancaAvulsaResponse {
  alunos: number;
  cobrancas: number;
}

export interface ResultadoDoLote {
  resultados: ResultadoDoItemDoLote[];
}

/** Calculados pelo servidor sobre o filtro inteiro (todas as páginas); cancelada e estornada ficam fora, em aberto inclui a vencida. */
export interface TotaisDasCobrancas {
  totalCentavos: number;
  pagoCentavos: number;
  emAbertoCentavos: number;
  vencidoCentavos: number;
}

export interface PaginaCobrancas {
  itens: CobrancaResponse[];
  total: number;
  pagina: number;
  totais: TotaisDasCobrancas;
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

/**
 * Um mês da série (`mes` = `AAAA-MM`). `previstoCentavos` só de hoje em diante; as avulsas são nulas com o filtro "meus".
 * `resultadoCentavos` é nulo se faltar o recebido, as entradas ou as saídas (nunca soma ausência como zero).
 */
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

/**
 * Rótulo fixo "entradas − saídas registradas": não é lucro. Avulsas nulas com o filtro "meus"; `resultadoCentavos` é nulo
 * se faltar o recebido, as entradas ou as saídas.
 */
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

/**
 * `GET /financeiro/visao-geral` (`FINANCEIRO_LER`): sem período; com `meus`, só os alunos do responsável autenticado (renovações e projeção anual). `renovacoesProximas*`:
 * contratações ATIVAS cujo fim do ciclo cai nos próximos 40 dias (conta da API; nunca "já venceu"); `projecaoAnualCentavos`: valor ×
 * parcelas por ano das ATIVAS (parcela única fica fora). `encerraramSemRenovar*` é um grupo à parte, nunca somado às renovações: parcela
 * única ATIVA cujo término passou há até 30 dias (a mais recente primeiro, até 50 itens; `Count` é o total). Pausada e encerrada à mão não entram.
 */
export interface VisaoGeralDoFinanceiro {
  renovacoesProximasCount: number;
  renovacoesProximasCentavos: number;
  projecaoAnualCentavos: number;
  encerraramSemRenovarCount: number;
  encerraramSemRenovar: EncerradoSemRenovar[];
}

export interface EncerradoSemRenovar {
  contratacaoId: string;
  alunoId: string;
  alunoNome: string | null;
  /** AAAA-MM-DD: o fim do único ciclo (início + 1 mês). */
  terminoVigencia: string;
  valorCentavos: number;
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
  /**
   * Informativo (13/11): `true` quando parte do histórico financeiro da consultoria foi removida numa limpeza anterior. Não
   * muda valor, fórmula nem permissão e nunca diz quais períodos estão completos; ausente (API antiga, mocks) vale `false`.
   */
  historicoFinanceiroParcial?: boolean;
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
  /** Link de pagamento próprio do plano (https), aberto fora do app, sem token; nulo = sem link. */
  linkDePagamento: string | null;
  // A API ainda não manda a vigência no plano do aluno (só `GET /aluno/contratacao`, que o app não usa): hoje não chega.
  terminoVigencia?: string | null;
  diasRestantesVigencia?: number | null;
}

export interface CobrancaDoAluno {
  id: string;
  /** Nulo na `AVULSA`. */
  competencia: string | null;
  /** O que é a cobrança, só na `AVULSA`. Fora do contrato escrito (confirmar com a API); ausente ou nulo = sem descrição. */
  descricao?: string | null;
  vencimento: string;
  valorCentavos: number;
  situacao: SituacaoDaCobranca;
  vencida: boolean;
  forma: FormaDePagamento | null;
  pagoEm: string | null;
  /** `SAIDA`: só informa (sem botão de pagar nem link; a API responde 409 `COBRANCA_SEM_LINK`). */
  tipo: TipoDaCobranca;
  /** `KIWIFY`: a Kiwify cobra sozinha (D18): o aluno vê só "Cobrança automática pela Kiwify". Nulo ou ausente = não. */
  cobrancaAutomatica?: CobrancaAutomatica | null;
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
  /** As formas que o treinador ligou e que se aplicam às cobranças do aluno (`MANUAL` só informa). */
  formasDePagamento: FormaDeRecebimento[];
}

/** `POST /aluno/financeiro/cobrancas/{id}/pix`: o BR Code copia e cola, montado pelo servidor (só cobrança ABERTA do próprio aluno). */
export interface CodigoPix {
  codigo: string;
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

// ---- Formas de recebimento (`GET/PUT /financeiro/formas-de-recebimento`) ----

/** A chave Pix nunca volta inteira: só `chaveMascarada` e `chaveConfigurada`. É dado pessoal (CPF): nunca em log nem mensagem. */
export interface PixConfigResponse {
  tipoChave: TipoDeChavePix;
  chaveMascarada: string | null;
  chaveConfigurada: boolean;
  nomeRecebedor: string;
  cidade: string;
}

/** `pixConfig` nulo = Pix nunca configurado. `versao` nula = a consultoria nunca gravou as formas (vale o padrão de hoje). */
export interface FormasDeRecebimento {
  infinitePay: boolean;
  linkProprio: boolean;
  pix: boolean;
  /** Sempre ligado. */
  manual: boolean;
  pixConfig: PixConfigResponse | null;
  versao: number | null;
}

/** `chave` só quando o treinador digitou uma nova (ausente mantém a gravada). Nome do recebedor até 25 e cidade até 15. */
export interface PixConfigRequest {
  tipoChave: TipoDeChavePix;
  chave?: string;
  nomeRecebedor: string;
  cidade: string;
}

/** `manual` sempre `true`; `pixConfig` obrigatório com `pix` ligado. */
export interface FormasDeRecebimentoRequest {
  infinitePay: boolean;
  linkProprio: boolean;
  pix: boolean;
  manual: true;
  pixConfig?: PixConfigRequest;
  versao: number | null;
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
  | 'ESTORNO_INFORMADO'
  // Kiwify (D19; `financeiroKiwify.ts`). `VALOR_DIFERENTE` e `CONSULTA_FALHOU` também valem para ela.
  | 'KIWIFY_EMAIL_SEM_ALUNO'
  | 'KIWIFY_EMAIL_DE_VARIOS_ALUNOS'
  | 'KIWIFY_SEM_CONTRATACAO_NO_PLANO'
  | 'KIWIFY_SEM_MENSALIDADE_ABERTA'
  | 'KIWIFY_ASSINATURA_CANCELADA'
  | 'KIWIFY_REEMBOLSO'
  | 'KIWIFY_CHARGEBACK';

/** Quem avisou o pagamento. Ausente (fixtures antigas) = InfinitePay. */
export type ProvedorDaConferencia = 'INFINITEPAY' | 'KIWIFY';

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
  provedor?: ProvedorDaConferencia;
  /** A venda no provedor (`order_id` da Kiwify, `transaction_nsu` da InfinitePay), para achá-la no painel dele; nulo se não veio. */
  idExterno?: string | null;
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

/** Por que `whatsapp` veio nulo (código fixo da API; ver `dominio/lembretesDeCobranca`). */
export type MotivoSemWhatsapp = 'COBRANCA_NAO_ABERTA' | 'ALUNO_ANONIMIZADO' | 'ALUNO_INATIVO';

/**
 * Os lembretes de uma cobrança e a mensagem pronta para o WhatsApp (o mesmo texto do e-mail, para hoje; o da saída é próprio).
 * `whatsapp` nulo = cobrança que não está em aberto, aluno anonimizado ou inativo com mensalidade ainda não vencida (de inativo
 * só a vencida e a de saída têm mensagem); `motivoSemWhatsapp` diz qual e vem nulo quando há mensagem; `telefone` nulo = o aluno
 * não tem telefone.
 */
export interface LembretesDaCobranca {
  itens: LembreteDaCobranca[];
  whatsapp: { telefone: string | null; mensagem: string } | null;
  motivoSemWhatsapp: MotivoSemWhatsapp | null;
  /** O aluno desligou os lembretes por e-mail para si (`PUT /aluno/lembretes-de-cobranca`); o WhatsApp manual segue valendo. */
  alunoDesligou: boolean;
  /**
   * O aluno tem responsável financeiro (D15) com e-mail válido e/ou telefone: os lembretes vão a ele (cada canal cai no aluno
   * sozinho, e `whatsapp.telefone` já é o do responsável quando ele tem telefone). O nome dele nunca vem aqui.
   */
  paraResponsavel: boolean;
}

/** `GET/PUT /aluno/lembretes-de-cobranca`: se o aluno quer receber os lembretes de pagamento por e-mail (ligado por padrão). */
export interface LembretesDoAluno {
  receber: boolean;
}
