import { requisicao } from './cliente';
import type { MinhaConta } from './tipos';

export interface PoliticaSplitMinhaConta {
  modo: 'ISENTO' | 'ABATER_MENSALIDADE' | 'TAXA_PLATAFORMA' | 'TAXA_PERCENTUAL' | string;
  percentualBps?: number | null;
  metaMensalCentavos?: number | null;
  abatidoMesCentavos?: number | null;
  restanteAbaterCentavos?: number | null;
  cobrancaCentralId?: string | null;
}

export interface PixMinhaContaAsaasResponse {
  cobrancaId: string;
  idExterno: string;
  valorCentavos: number;
  qrCodeBase64: string;
  codigoCopiaECola: string;
  expiraEm: string | null;
}

export interface SituacaoMinhaContaResponse {
  cobrancaId: string;
  situacao: string;
  pagoEm: string | null;
}

type MinhaContaEstendida = MinhaConta & {
  provedorAtivo?: 'ASAAS' | 'INFINITEPAY' | 'MERCADOPAGO' | string | null;
  politicaSplit?: PoliticaSplitMinhaConta | null;
};

/** Lê os campos aditivos de Asaas e política de Split de `GET /minha-conta` sem alterar `tipos.ts`. */
export function lerDetalhesAsaasMinhaConta(conta: MinhaConta): {
  provedorAtivo: string | null;
  suportaCheckoutTransparente: boolean;
  politicaSplit: PoliticaSplitMinhaConta | null;
} {
  const ext = conta as MinhaContaEstendida;
  const provedorAtivo = ext.provedorAtivo ?? null;
  return {
    provedorAtivo,
    suportaCheckoutTransparente: provedorAtivo === 'ASAAS',
    politicaSplit: ext.politicaSplit ?? null,
  };
}

/** `POST /minha-conta/cobrancas/{cobrancaId}/asaas/pix` */
export function gerarPixMinhaContaAsaas(cobrancaId: string, cpfCnpj?: string): Promise<PixMinhaContaAsaasResponse> {
  const corpo = cpfCnpj?.trim() ? { cpfCnpj: cpfCnpj.trim() } : {};
  return requisicao<PixMinhaContaAsaasResponse>(`/minha-conta/cobrancas/${cobrancaId}/asaas/pix`, {
    metodo: 'POST',
    corpo,
  });
}

/** `GET /minha-conta/cobrancas/{cobrancaId}/situacao` */
export function consultarSituacaoMinhaConta(cobrancaId: string): Promise<SituacaoMinhaContaResponse> {
  return requisicao<SituacaoMinhaContaResponse>(`/minha-conta/cobrancas/${cobrancaId}/situacao`, {
    semCache: true,
  });
}
