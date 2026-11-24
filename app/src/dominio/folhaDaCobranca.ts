import type { CobrancaResponse } from '../api/financeiroTipos';
import { ehDoContratoFechado } from './contratoFechado';
import { atrasoParaTela, rotuloDaForma } from './financeiro';
import { dataParaTela, SEM_DADO } from './formatos';

/**
 * Regras de texto da folha da cobrança (folha da cobrança, 23/11; `docs/planos/folha-da-cobranca.md`): o prazo relativo
 * abaixo do valor, a linha de origem e o id encurtado. Só com o que a cobrança já traz; nada é calculado de valor.
 */

/** `suave` = texto secundário (sem juízo); os outros são as cores de situação do tema. */
export type TomDoPrazo = 'suave' | 'atencao' | 'perigo' | 'sucesso';

/** Até este número de dias antes do vencimento o prazo fica em âmbar ("Vence em 1 a 3 dias"). */
export const DIAS_DE_ATENCAO = 3;

/** Dias corridos de `de` até `ate` (datas ISO, `ate - de`). */
function diasEntre(de: string, ate: string): number {
  const [ya, ma, da] = de.slice(0, 10).split('-').map(Number);
  const [yb, mb, db] = ate.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/**
 * O prazo relativo da cobrança, em relação a hoje (Brasília, `hojeEmBrasilia`). Em aberto: "Vence em N dias" (suave),
 * "Vence hoje", "Vence amanhã" e "Vence em 2 ou 3 dias" (âmbar); vencida (a API decide pela marca `vencida`):
 * "N dias de atraso" (vermelho), com os dias da API e, sem eles, a conta pelas datas. Paga: "Paga em DD/MM/AAAA · forma"
 * (verde). Cancelada, estornada, contestada e renegociada: `null` (o selo já diz; a data exata fica nas Datas).
 */
export function prazoDaCobranca(
  c: Pick<CobrancaResponse, 'situacao' | 'vencida' | 'vencimento' | 'diasDeAtraso' | 'pagoEm' | 'forma'>,
  hoje: string,
): { texto: string; tom: TomDoPrazo } | null {
  if (c.situacao === 'PAGA') {
    if (!c.pagoEm) return null;
    const forma = rotuloDaForma(c.forma);
    return { texto: `Paga em ${dataParaTela(c.pagoEm)}${forma === SEM_DADO ? '' : ` · ${forma}`}`, tom: 'sucesso' };
  }
  if (c.situacao !== 'ABERTA') return null;
  const faltam = diasEntre(hoje, c.vencimento);
  if (c.vencida) {
    const dias = typeof c.diasDeAtraso === 'number' && c.diasDeAtraso > 0 ? c.diasDeAtraso : Math.max(1, -faltam);
    return { texto: atrasoParaTela(dias), tom: 'perigo' };
  }
  // Sem a marca de vencida, um vencimento que já passou (relógio do aparelho adiantado) fica em "Vence hoje", como o selo "Em aberto".
  if (faltam <= 0) return { texto: 'Vence hoje', tom: 'atencao' };
  if (faltam === 1) return { texto: 'Vence amanhã', tom: 'atencao' };
  return { texto: `Vence em ${faltam} dias`, tom: faltam <= DIAS_DE_ATENCAO ? 'atencao' : 'suave' };
}

/** O fim fixo que o servidor põe na descrição das parcelas: "Camiseta (Parcela 1/3)", "Renegociação (Parcela 2/3)". */
const PARCELA = /\s*\(Parcela (\d+)\/(\d+)\)\s*$/;

/**
 * De onde a cobrança vem, numa linha: "Mensalidade · Consultoria mensal", "Cobrança de saída · Consultoria mensal",
 * "Avulsa · Camiseta · Parcela 1 de 3" e "Parcela 2 de 3 do acordo". Sem o plano ou a descrição, só o tipo. A descrição
 * fora do formato fixo vai como veio.
 */
export function origemDaCobranca(c: Pick<CobrancaResponse, 'tipo' | 'planoNome' | 'descricao'> & { contratacaoId?: string | null }): string {
  const descricao = c.descricao?.trim() ?? '';
  const parcela = PARCELA.exec(descricao);
  const semParcela = parcela ? descricao.slice(0, parcela.index).trim() : descricao;
  const deN = parcela ? `Parcela ${parcela[1]} de ${parcela[2]}` : null;
  // Contrato fechado: entrada, pagamento do saldo e parcelas (descrição fixa do servidor) são do contrato, não avulsa nem acordo.
  if (ehDoContratoFechado(c)) return [descricao || 'Cobrança do contrato', c.planoNome ? `contrato ${c.planoNome}` : 'contrato fechado'].join(' · ');
  switch (c.tipo) {
    case 'RENEGOCIACAO':
      return deN ? `${deN} do acordo` : 'Parcela de acordo';
    case 'AVULSA':
      return ['Avulsa', semParcela || null, deN].filter(Boolean).join(' · ');
    case 'SAIDA':
      return c.planoNome ? `Cobrança de saída · ${c.planoNome}` : 'Cobrança de saída';
    default:
      return c.planoNome ? `Mensalidade · ${c.planoNome}` : 'Mensalidade';
  }
}

/** O id na folha: os 8 primeiros e os 4 últimos caracteres ("5adb0f9b…e838"); o inteiro vai na cópia e no nome acessível. */
export function idEncurtado(id: string): string {
  return id.length <= 13 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** A linha que substitui o "Copiar link de pagamento" quando o recebimento online ainda não está configurado. */
export const TEXTO_CONFIGURE_PARA_O_LINK = 'Configure o recebimento online para mandar o link.';
