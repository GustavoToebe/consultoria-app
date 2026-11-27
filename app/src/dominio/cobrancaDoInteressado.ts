import type { ContratarComGeracaoRequest } from '../api/financeiroF1';
import type { SituacaoDaContratacao } from '../api/financeiroTipos';
import type {
  AlterarInscricaoRequest,
  InscricaoDetalhe,
  PagamentoInscricao,
  SituacaoInscricao,
} from '../api/inscricoesTipos';
import { estaAberta } from './inscricoes';

/**
 * "Confirmar pagamento" e "Gerar cobrança" de Interessados (pedido 7, item 4, de 27/11). A inscrição ainda não é aluno e a
 * cobrança só existe para aluno (D2 de `docs/planos/ficha-rapida-pos-whatsapp.md`): antes do aceite só se registra o
 * pagamento (manual, o app não confere); depois do aceite, "Gerar cobrança" contrata o plano escolhido pelo caminho do
 * Financeiro, com o valor do plano gravado no servidor. Nada aqui calcula dinheiro.
 */

/** Só inscrição em atendimento e ainda sem pagamento confirmado. */
export const podeConfirmarPagamento = (situacao: SituacaoInscricao, pagamento: PagamentoInscricao) =>
  estaAberta(situacao) && pagamento !== 'CONFIRMADO_MANUAL';

/**
 * Corpo do `PUT /inscricoes/{id}` que confirma o pagamento: etapa e responsável como estão gravados (nunca o andamento ainda
 * não salvo da folha) e a versão vista.
 */
export function corpoDaConfirmacao(d: { situacao: SituacaoInscricao; responsavelId: string | null; versao: number }): AlterarInscricaoRequest {
  return { situacao: d.situacao, pagamento: 'CONFIRMADO_MANUAL', responsavelId: d.responsavelId, versao: d.versao };
}

/**
 * Plano do interessado: o da proposta vale mais (mesmo escrito à mão, sem id: aí não há plano do Financeiro para cobrar);
 * sem plano na proposta, o que a pessoa escolheu na página.
 */
export function planoDoInteressado(d: Pick<InscricaoDetalhe, 'proposta' | 'planoComercialId' | 'planoComercialNome'>): { id: string | null; nome: string | null } {
  const p = d.proposta;
  if (p.planoId || p.planoNome) return { id: p.planoId, nome: p.planoNome };
  return { id: d.planoComercialId, nome: d.planoComercialNome };
}

/** "Gerar cobrança" só para inscrição aceita, ligada a um aluno e que não foi cortesia. */
export const podeGerarCobranca = (d: { situacao: SituacaoInscricao; alunoId: string | null; aceitaSemCobranca?: boolean }) =>
  d.situacao === 'ACEITA' && !!d.alunoId && !d.aceitaSemCobranca;

/** Contratação que ainda vale (ativa ou pausada): contratar de novo daria 409 `CONTRATACAO_VIGENTE`. */
export const temContratacaoVigente = (lista: readonly { situacao: SituacaoDaContratacao }[]) =>
  lista.some((c) => c.situacao !== 'ENCERRADA');

/**
 * Corpo do contratar: valor nulo (= o do plano, decidido no servidor), início hoje (`AAAA-MM-DD` de Brasília), vencimento
 * no dia de hoje e sem gerar meses anteriores. `primeiroPeriodoPago` faz a primeira cobrança nascer paga (baixa manual do
 * servidor), para quem já confirmou o pagamento na inscrição.
 */
export function pedidoDeContratacao(planoComercialId: string, hoje: string, primeiroPeriodoPago: boolean): ContratarComGeracaoRequest {
  return {
    planoComercialId,
    valorCentavos: null,
    inicio: hoje,
    diaVencimento: Number(hoje.slice(8, 10)),
    primeiroPeriodoPago,
    gerarMesesAnteriores: false,
  };
}

/** A proposta combinou outro valor: a tela avisa que a cobrança sai no valor do plano (só compara, não calcula). */
export const propostaComOutroValor = (valorDaProposta: number | null, valorDoPlano: number) =>
  valorDaProposta !== null && valorDaProposta !== valorDoPlano;
