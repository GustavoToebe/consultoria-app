import type {
  CobrancaDaConta,
  ContatoDaConta,
  EnderecoDaConta,
  EstadoDoConsumo,
  ItemDoConsumo,
  PeriodicidadeDaConta,
  SituacaoComercial,
} from '../api/tipos';
import { SEM_DADO } from './formatos';

/**
 * Regras de apresentação da Minha conta (sem tela): rótulos, selos e formatos. A API manda os dados prontos (documento,
 * CEP e telefone já formatados); aqui só se escolhe o texto. Ausência de dado é "—", nunca valor inventado.
 */

export type TipoDeSelo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

/** `1234.5` → `R$ 1.234,50`. Nulo → "—". Não depende de `Intl` (o Hermes do celular pode não ter pt-BR). */
export function moedaParaTela(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return SEM_DADO;
  const [inteiro, centavos] = Math.abs(valor).toFixed(2).split('.');
  const milhares = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${valor < 0 ? '-' : ''}R$ ${milhares},${centavos}`;
}

export function periodicidadeParaTela(p: PeriodicidadeDaConta | null | undefined): string {
  switch (p) {
    case 'MENSAL': return 'Mensal';
    case 'TRIMESTRAL': return 'Trimestral';
    case 'SEMESTRAL': return 'Semestral';
    case 'ANUAL': return 'Anual';
    default: return SEM_DADO;
  }
}

export function situacaoComercialParaTela(s: SituacaoComercial | null | undefined): { texto: string; tipo: TipoDeSelo } {
  switch (s) {
    case 'ATIVA': return { texto: 'Ativa', tipo: 'sucesso' };
    case 'TRIAL': return { texto: 'Período de teste', tipo: 'atencao' };
    case 'INADIMPLENTE': return { texto: 'Inadimplente', tipo: 'perigo' };
    case 'BLOQUEADA': return { texto: 'Bloqueada', tipo: 'perigo' };
    case 'CANCELADA': return { texto: 'Cancelada', tipo: 'neutro' };
    default: return { texto: SEM_DADO, tipo: 'neutro' };
  }
}

/** Vencida (aberta e passou do vencimento) aparece como tal; o resto segue a situação gravada. */
export function situacaoDaCobrancaParaTela(c: Pick<CobrancaDaConta, 'situacao' | 'vencida'>): { texto: string; tipo: TipoDeSelo } {
  if (c.vencida) return { texto: 'Vencida', tipo: 'perigo' };
  switch (c.situacao) {
    case 'PAGA': return { texto: 'Paga', tipo: 'sucesso' };
    case 'ABERTA': return { texto: 'Em aberto', tipo: 'atencao' };
    case 'CANCELADA': return { texto: 'Cancelada', tipo: 'neutro' };
    case 'ISENTA': return { texto: 'Isenta', tipo: 'neutro' };
    default: return { texto: SEM_DADO, tipo: 'neutro' };
  }
}

/** `2026-05-01`/`2026-05-31` → `05/2026` (competência de um mês) ou `05/2026 a 07/2026`. */
export function competenciaParaTela(inicio: string, fim: string): string {
  const mes = (iso: string) => {
    const [a, m] = iso.slice(0, 10).split('-');
    return a && m ? `${m}/${a}` : SEM_DADO;
  };
  const de = mes(inicio);
  const ate = mes(fim);
  return de === ate ? de : `${de} a ${ate}`;
}

/** Cobranças em aberto (a vencer ou vencidas), para o resumo do topo da aba Financeiro. */
export function resumoFinanceiro(cobrancas: CobrancaDaConta[]): { emAberto: number; vencidas: number } {
  return {
    emAberto: cobrancas.filter((c) => c.situacao === 'ABERTA').length,
    vencidas: cobrancas.filter((c) => c.vencida).length,
  };
}

/** Linhas do endereço sem partes vazias: `Rua Exemplo, 100 - Centro` e `Cidade/UF - CEP`. Tudo vazio → lista vazia. */
export function enderecoParaTela(e: EnderecoDaConta | null | undefined): string[] {
  if (!e) return [];
  const rua = [e.logradouro, e.numero].filter(Boolean).join(', ');
  const primeira = [rua, e.complemento, e.bairro].filter(Boolean).join(' - ');
  const cidade = [e.cidade, e.uf].filter(Boolean).join('/');
  const segunda = [cidade, e.cep].filter(Boolean).join(' - ');
  return [primeira, segunda].filter(Boolean);
}

/** O contato principal vem primeiro; a ordem dos demais é mantida. */
export function contatosOrdenados(contatos: ContatoDaConta[]): ContatoDaConta[] {
  return [...contatos].sort((a, b) => Number(b.principal) - Number(a.principal));
}

export function estadoDoConsumoParaTela(estado: EstadoDoConsumo): { texto: string; tipo: TipoDeSelo } {
  switch (estado) {
    case 'DISPONIVEL': return { texto: 'Dentro do limite', tipo: 'sucesso' };
    case 'ATENCAO': return { texto: 'Perto do limite', tipo: 'atencao' };
    case 'ATINGIDO': return { texto: 'Limite atingido', tipo: 'atencao' };
    case 'EXCEDIDO': return { texto: 'Acima do limite', tipo: 'perigo' };
    default: return { texto: 'Sem limite configurado', tipo: 'neutro' };
  }
}

/** "12 de 150" ou, sem limite configurado, só "12" (o limite nunca vira zero inventado). */
export function usoParaTela(item: Pick<ItemDoConsumo, 'usado' | 'limite'>): string {
  return item.limite === null ? String(item.usado) : `${item.usado} de ${item.limite}`;
}

/** Barra só com limite configurado; passa de 100% vira 1 (a barra cheia). Sem limite ou limite 0 → `null` (sem barra). */
export function fracaoDoConsumo(item: Pick<ItemDoConsumo, 'usado' | 'limite'>): number | null {
  if (item.limite === null || item.limite <= 0) return null;
  return Math.min(item.usado / item.limite, 1);
}
