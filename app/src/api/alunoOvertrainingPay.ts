import { requisicao } from './cliente';
import type { FinanceiroDoAluno, JurosDoParcelamento } from './financeiroTipos';

export interface PixOvertrainingPayResponse {
  cobrancaId: string;
  asaasCobrancaId: string;
  valorCentavos: number;
  qrCodeBase64: string;
  codigoCopiaECola: string;
  expiraEm: string | null;
}

export interface SituacaoCobrancaAlunoResponse {
  cobrancaId: string;
  situacao: string;
  pagoEm: string | null;
}

/** Extensão aditiva de `FinanceiroDoAluno` quando o backend envia os campos do Overtraining Pay. */
export interface OpcoesOvertrainingPayDoAluno {
  overtrainingPayDisponivel: boolean;
  overtrainingPayMaxParcelas: number;
  overtrainingPayJuros: JurosDoParcelamento;
  cpfPagadorCadastrado: boolean;
}

type FinanceiroDoAlunoExtendido = FinanceiroDoAluno & {
  overtrainingPayDisponivel?: boolean;
  overtrainingPayMaxParcelas?: number;
  overtrainingPayJuros?: JurosDoParcelamento;
  cpfPagadorCadastrado?: boolean;
};

/** Lê os campos aditivos de Overtraining Pay do payload `GET /aluno/financeiro` sem exigir mudança em `financeiroTipos.ts`. */
export function lerOpcoesOvertrainingPay(dados: FinanceiroDoAluno | undefined): OpcoesOvertrainingPayDoAluno {
  const ext = dados as FinanceiroDoAlunoExtendido | undefined;
  return {
    overtrainingPayDisponivel: ext?.overtrainingPayDisponivel === true,
    overtrainingPayMaxParcelas: typeof ext?.overtrainingPayMaxParcelas === 'number' && ext.overtrainingPayMaxParcelas >= 1
      ? Math.min(12, Math.floor(ext.overtrainingPayMaxParcelas))
      : 12,
    overtrainingPayJuros: ext?.overtrainingPayJuros === 'TREINADOR' ? 'TREINADOR' : 'ALUNO',
    cpfPagadorCadastrado: ext?.cpfPagadorCadastrado === true,
  };
}

/** `POST /aluno/financeiro/cobrancas/{cobrancaId}/overtraining-pay/pix` */
export function gerarPixOvertrainingPay(cobrancaId: string, cpfPagador?: string): Promise<PixOvertrainingPayResponse> {
  const corpo = cpfPagador?.trim() ? { cpfPagador: cpfPagador.trim() } : {};
  return requisicao<PixOvertrainingPayResponse>(`/aluno/financeiro/cobrancas/${cobrancaId}/overtraining-pay/pix`, {
    metodo: 'POST',
    corpo,
  });
}

/**
 * `POST /aluno/financeiro/cobrancas/{cobrancaId}/overtraining-pay/fatura`: a página de pagamento do Asaas (cartão), aberta
 * fora do app. O app nunca recebe nem envia dado de cartão.
 */
export function faturaOvertrainingPay(cobrancaId: string): Promise<{ url: string }> {
  return requisicao<{ url: string }>(`/aluno/financeiro/cobrancas/${cobrancaId}/overtraining-pay/fatura`, { metodo: 'POST' });
}

/** `GET /aluno/financeiro/cobrancas/{cobrancaId}/situacao` */
export function consultarSituacaoCobrancaAluno(cobrancaId: string): Promise<SituacaoCobrancaAlunoResponse> {
  return requisicao<SituacaoCobrancaAlunoResponse>(`/aluno/financeiro/cobrancas/${cobrancaId}/situacao`, {
    semCache: true,
  });
}
