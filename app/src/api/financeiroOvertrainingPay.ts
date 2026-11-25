import { requisicao } from './cliente';
import type { JurosDoParcelamento } from './financeiroTipos';

/**
 * Contrato do Overtraining Pay (Asaas) para o treinador (`/financeiro/overtraining-pay`).
 * Segredos e documentos completos (`documento`, `agencia`, `conta`) são só de escrita:
 * a API nunca os devolve em texto aberto (apenas campos mascarados) e o app nunca os persiste no aparelho.
 */

export type SituacaoHomologacao =
  | 'NAO_CONFIGURADA'
  | 'DOCUMENTOS_PENDENTES'
  | 'PRONTA_PARA_TESTE'
  | 'ATIVA'
  | 'REJEITADA';

export type TipoPessoaTitular = 'PF' | 'PJ';
export type TipoContaRepasse = 'CORRENTE' | 'POUPANCA' | 'PAGAMENTO';
export type SituacaoCobrancaTeste = 'CRIADA' | 'PAGA' | 'HOMOLOGADA';

export interface EtapasHomologacaoApi {
  titular?: boolean;
  contaRepasse?: boolean;
  documentos?: boolean;
  cobrancaTeste?: boolean;
  /** Nomes equivalentes retornados pelo backend Java. */
  dadosCadastrados?: boolean;
  documentosAprovados?: boolean;
  testeHomologado?: boolean;
  ativa?: boolean;
}

export interface CobrancaTesteResponse {
  cobrancaTesteId: string;
  situacao: SituacaoCobrancaTeste;
  valorCentavos: number;
  qrCodeBase64: string | null;
  pixCopiaECola: string | null;
  expiraEm: string | null;
}

export interface OvertrainingPayConfigResponse {
  situacao: SituacaoHomologacao;
  etapas?: EtapasHomologacaoApi | null;
  tipoPessoa: TipoPessoaTitular | null;
  documentoMascarado: string | null;
  nomeTitular: string | null;
  emailFinanceiro: string | null;
  telefoneMascarado: string | null;
  cep: string | null;
  enderecoResumo: string | null;
  rendaMensalCentavos: number | null;
  bancoCodigo: string | null;
  bancoNome: string | null;
  tipoConta: TipoContaRepasse | null;
  agenciaMascarada: string | null;
  contaMascarada: string | null;
  repasseAutomatico: boolean;
  maxParcelas: number;
  jurosParcelamento: JurosDoParcelamento;
  onboardingUrl: string | null;
  cobrancasLiquidadas: number;
  homologadaEm: string | null;
  cobrancaTesteAtiva?: CobrancaTesteResponse | null;
  versao: number | null;
}

export interface OvertrainingPayConfigRequest {
  tipoPessoa: TipoPessoaTitular;
  /** Só de escrita: omitido quando o documento já está salvo e não foi alterado. */
  documento?: string;
  nomeTitular: string;
  emailFinanceiro: string;
  telefone?: string | null;
  cep: string;
  enderecoResumo: string;
  rendaMensalCentavos: number;
  bancoCodigo: string;
  bancoNome: string;
  tipoConta: TipoContaRepasse;
  /** Só de escrita: omitido quando a agência já está salva e não foi alterada. */
  agencia?: string;
  /** Só de escrita: omitido quando a conta já está salva e não foi alterada. */
  conta?: string;
  repasseAutomatico: boolean;
  maxParcelas: number;
  jurosParcelamento: JurosDoParcelamento;
  versao: number | null;
}

export const buscarOvertrainingPay = () =>
  requisicao<OvertrainingPayConfigResponse>('/financeiro/overtraining-pay');

export const salvarOvertrainingPay = (corpo: OvertrainingPayConfigRequest) =>
  requisicao<OvertrainingPayConfigResponse>('/financeiro/overtraining-pay', { metodo: 'PUT', corpo });

export const sincronizarStatusOvertrainingPay = () =>
  requisicao<OvertrainingPayConfigResponse>('/financeiro/overtraining-pay/sincronizar-status', { metodo: 'POST' });

export const gerarCobrancaTesteOvertrainingPay = () =>
  requisicao<CobrancaTesteResponse>('/financeiro/overtraining-pay/cobranca-teste', { metodo: 'POST' });

export const consultarCobrancaTesteOvertrainingPay = (id: string) =>
  requisicao<CobrancaTesteResponse>(`/financeiro/overtraining-pay/cobranca-teste/${encodeURIComponent(id)}`);

export const removerOvertrainingPay = (versao: number | null) =>
  requisicao<void>(`/financeiro/overtraining-pay${versao == null ? '' : `?versao=${versao}`}`, { metodo: 'DELETE' });
