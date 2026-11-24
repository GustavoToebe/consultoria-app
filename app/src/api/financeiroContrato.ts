import { requisicao } from './cliente';
import type { ContratacaoResponse, FormaDePagamento, ModoDeCobranca } from './financeiroTipos';

/**
 * Contrato fechado (Fase 1, `docs/planos/contrato-fechado.md`, D1 a D12): entrada + parcelas fixas ou entrada + saldo livre.
 * Tipos escritos à mão no padrão de `financeiroRenegociar.ts`; a API (`pagamentos/`) segue este arquivo e a sessão principal
 * reconcilia as diferenças. O app NUNCA calcula dinheiro (D14): soma, divisão do restante, saldo, limite e "a soma fecha"
 * vêm do servidor. Centavos inteiros; datas `AAAA-MM-DD`.
 *
 * Contrato da API (fechado em 24/11):
 * - Contrato fechado = `ContratacaoResponse.contrato` não nulo (o modo está em `contrato.modo`).
 * - Prévia: a Entrada é a PRIMEIRA linha (`numero` nulo, "Entrada"), depois "Parcela k/n" (`numero` 1..n); `somaCentavos`
 *   inclui a entrada e `diferencaCentavos` = total − soma. Soma errada = 200 com `fecha: false`; campo inválido = 422.
 * - No fechado o servidor ignora `valorCentavos`, `motivoValor`, `primeiroPeriodoPago` e `gerarMesesAnteriores` e o
 *   `diaVencimento` é opcional (usa o dia do início): a tela não manda nenhum deles.
 * - O saldo livre também chama a prévia, só com o total e a entrada (`fecha` = soma ≤ total); entrada acima do total é
 *   o 422 `CONTRATO_INVALIDO` no campo `entrada.valorCentavos`, que a tela mostra no campo.
 */

export type ModoFechado = Exclude<ModoDeCobranca, 'RECORRENTE'>;

/** Entrada (D3): vira uma cobrança AVULSA "Entrada"; `jaPaga` com `forma` = baixa manual na mesma transação. */
export interface EntradaDoContrato {
  valorCentavos: number;
  data: string;
  jaPaga: boolean;
  forma?: FormaDePagamento | null;
}

export interface ParcelaDoContrato {
  vencimento: string;
  valorCentavos: number;
}

/**
 * `POST /alunos/{id}/contratacoes` no modo fechado. `parcelas` só em `PARCELADO_FIXO` (1 a 12; a tela manda sempre a lista
 * da última prévia que fechou, sem a linha da Entrada). 422 `CONTRATO_INVALIDO` com `fieldErrors` em `valorTotalCentavos`,
 * `entrada.valorCentavos`, `entrada.data`, `entrada.forma`, `parcelas`, `parcelas[i].vencimento`, `parcelas[i].valorCentavos`
 * e `modoCobranca` (plano Kiwify, D11). Limites: entrada e parcela até R$ 1 mi, total até R$ 10 mi, 1 a 12 parcelas.
 */
export interface ContratarContratoRequest {
  planoComercialId: string;
  inicio: string;
  modoCobranca: ModoFechado;
  valorTotalCentavos: number;
  entrada?: EntradaDoContrato | null;
  parcelas?: ParcelaDoContrato[] | null;
}

/**
 * `POST /contratacoes/previa-do-contrato` (só leitura). Sem `parcelas`: o servidor divide o restante (total − entrada) em
 * `quantidade` parcelas iguais, a sobra na ÚLTIMA, vencimentos mensais desde `primeiroVencimento`. Com `parcelas`: só
 * soma e confere. Até 12 parcelas.
 */
export interface PreviaDoContratoRequest {
  modoCobranca: ModoFechado;
  valorTotalCentavos: number;
  entrada?: EntradaDoContrato | null;
  quantidade?: number;
  primeiroVencimento?: string;
  parcelas?: ParcelaDoContrato[];
}

export interface ParcelaDaPreviaDoContrato extends ParcelaDoContrato {
  /** Nulo na linha da Entrada (a primeira); 1..n nas parcelas. */
  numero: number | null;
  /** Descrição fixa do servidor ("Entrada", "Parcela 1/3"). */
  descricao: string;
}

export interface PreviaDoContrato {
  /** A Entrada (se houver) e as parcelas, nessa ordem. */
  parcelas: ParcelaDaPreviaDoContrato[];
  /** Entrada + parcelas. */
  somaCentavos: number;
  /** Parcelas fixas: diferença zero; saldo livre: soma ≤ total. Só com `true` o "Criar contrato" habilita. */
  fecha: boolean;
  diferencaCentavos: number;
}

/**
 * `POST /contratacoes/{id}/pagamentos-do-saldo` (D4): uma AVULSA nova de valor exato, ligada à contratação SALDO_ABERTO ATIVA.
 * Descrição "Pagamento do saldo". `pedidoId` nasce ao abrir a folha (201; repetir o mesmo = 200). 422 `SALDO_INVALIDO` no
 * campo `valorCentavos`, 422 `CONTRATO_INVALIDO` nos outros campos; 409 `CONTRATO_NAO_ACEITA_SALDO` (outro modo ou
 * pausada), `CONTRATACAO_ENCERRADA` e `PEDIDO_JA_USADO`.
 */
export interface PagamentoDoSaldoRequest {
  pedidoId: string;
  valorCentavos: number;
  vencimento: string;
  jaPaga: boolean;
  forma?: FormaDePagamento | null;
}

export interface PagamentoDoSaldoResponse {
  cobrancaId: string;
  contratacao: ContratacaoResponse;
}

/** `GET /financeiro/alunos-em-atraso?meus=` (D8): alunos com ao menos uma ABERTA vencida; `truncado` acima do teto. */
export interface AlunosEmAtraso {
  alunoIds: string[];
  truncado: boolean;
}

const seg = (valor: string) => encodeURIComponent(valor);

/** O mesmo `POST /alunos/{id}/contratacoes` do recorrente, com o corpo do contrato fechado. */
export const contratarContrato = (alunoId: string, corpo: ContratarContratoRequest) =>
  requisicao<ContratacaoResponse>(`/alunos/${seg(alunoId)}/contratacoes`, { metodo: 'POST', corpo });

export const previaDoContrato = (corpo: PreviaDoContratoRequest) =>
  requisicao<PreviaDoContrato>('/contratacoes/previa-do-contrato', { metodo: 'POST', corpo });

export const registrarPagamentoDoSaldo = (contratacaoId: string, corpo: PagamentoDoSaldoRequest) =>
  requisicao<PagamentoDoSaldoResponse>(`/contratacoes/${seg(contratacaoId)}/pagamentos-do-saldo`, { metodo: 'POST', corpo });

export const alunosEmAtraso = (meus: boolean) =>
  requisicao<AlunosEmAtraso>(`/financeiro/alunos-em-atraso${meus ? '?meus=true' : ''}`);
