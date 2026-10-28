import type { LembreteDaCobranca, Lembretes, LembretesDaCobranca, TipoDeLembrete } from '../api/financeiroTipos';
import { hojeEmBrasilia } from './financeiro';
import { dataParaTela } from './formatos';

/**
 * Lembretes de cobrança: a configuração do Financeiro (dias antes, no dia, dias depois; mesmos limites da API), os textos
 * da lista na folha da cobrança e o link do WhatsApp que o treinador abre à mão. O texto da mensagem vem pronto da API
 * (`whatsapp.mensagem`, o mesmo do e-mail): aqui só se monta o endereço `wa.me`. Nada daqui é guardado no aparelho.
 */

export const DIAS_ANTES_MAXIMO = 15;
export const DIAS_DEPOIS_MAXIMO = 30;

export const TEXTO_LEMBRETES =
  'O app manda ao aluno, por e-mail, um lembrete da mensalidade em aberto: antes do vencimento, no dia e depois. Só por e-mail e só com o e-mail do app ligado. Uma cobrança paga, cancelada ou de contratação pausada não recebe lembrete.';
export const TEXTO_EMAIL_DESLIGADO =
  'O e-mail do app está desligado: enquanto ele não for ligado, nenhum lembrete é enviado, mesmo com os lembretes ligados aqui.';

/** Lê o campo de dias: só inteiro de 0 ao máximo. Vazio ou fora disso = erro (nunca vira 0 sozinho). */
export function lerDias(texto: string, maximo: number): { valor: number | null; erro: string | null } {
  const limpo = texto.trim();
  if (!/^\d{1,3}$/.test(limpo)) return { valor: null, erro: `Use um número de 0 a ${maximo}.` };
  const valor = Number(limpo);
  return valor > maximo ? { valor: null, erro: `Use um número de 0 a ${maximo}.` } : { valor, erro: null };
}

function dias(n: number): string {
  return n === 1 ? '1 dia' : `${n} dias`;
}

/** "3 dias antes, no dia e 3 dias depois"; "Desligados"; "Nenhum lembrete escolhido". */
export function resumoDosLembretes(l: Pick<Lembretes, 'ligado' | 'diasAntes' | 'noDia' | 'diasDepois'>): string {
  if (!l.ligado) return 'Desligados';
  const partes: string[] = [];
  if (l.diasAntes > 0) partes.push(`${dias(l.diasAntes)} antes`);
  if (l.noDia) partes.push('no dia');
  if (l.diasDepois > 0) partes.push(`${dias(l.diasDepois)} depois`);
  if (partes.length === 0) return 'Nenhum lembrete escolhido';
  const texto = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const ROTULO_DO_TIPO: Record<TipoDeLembrete, string> = {
  ANTES: 'Antes do vencimento',
  NO_DIA: 'No dia do vencimento',
  DEPOIS: 'Depois do vencimento',
};

export function rotuloDoTipo(tipo: TipoDeLembrete): string {
  return ROTULO_DO_TIPO[tipo] ?? 'Lembrete';
}

/** Por que um lembrete foi cancelado, em palavras (código desconhecido = só "Cancelado"). */
const MOTIVOS: Record<string, string> = {
  COBRANCA_NAO_ABERTA: 'a cobrança não estava mais em aberto',
  NAO_E_MAIS_DEVIDO: 'os lembretes foram mudados ou desligados',
  CONTRATACAO_NAO_ATIVA: 'contratação pausada ou encerrada',
  ALUNO_INATIVO: 'aluno inativo',
  SEM_EMAIL: 'o aluno não tem e-mail',
  EMAIL_DESLIGADO: 'e-mail do app desligado',
};

/** A data de Brasília de um instante da API (ISO com fuso). */
function diaDeBrasilia(instante: string): string {
  const data = new Date(instante);
  return Number.isNaN(data.getTime()) ? instante.slice(0, 10) : hojeEmBrasilia(data);
}

/** O selo e o texto de um lembrete na folha da cobrança. */
export function situacaoDoLembrete(l: LembreteDaCobranca): { selo: string; tom: 'sucesso' | 'atencao' | 'perigo' | 'neutro'; texto: string } {
  switch (l.situacao) {
    case 'ENVIADO':
      return { selo: 'Enviado', tom: 'sucesso', texto: `Enviado em ${dataParaTela(diaDeBrasilia(l.enviadoEm ?? l.atualizadoEm))}` };
    case 'PENDENTE':
      return { selo: 'Agendado', tom: 'atencao', texto: `Previsto para ${dataParaTela(l.dataPrevista)}` };
    case 'FALHOU':
      return { selo: 'Falhou', tom: 'perigo', texto: `Não foi enviado (${dataParaTela(diaDeBrasilia(l.atualizadoEm))})` };
    default: {
      const motivo = l.motivo ? MOTIVOS[l.motivo] : undefined;
      return { selo: 'Cancelado', tom: 'neutro', texto: motivo ? `Não enviado: ${motivo}` : 'Não enviado' };
    }
  }
}

/**
 * O número no formato do `wa.me` (só dígitos, com o 55 do Brasil). Aceita o telefone como a API grava, `(45) 99999-8888`,
 * ou já com +55. Fora de 10 ou 11 dígitos (sem o 55) = `null`: não há o que abrir.
 */
export function numeroDoWhatsApp(telefone: string | null | undefined): string | null {
  if (!telefone) return null;
  let digitos = telefone.replace(/\D/g, '');
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) digitos = digitos.slice(2);
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  return `55${digitos}`;
}

/** `https://wa.me/55...?text=...`, aberto fora do app (sem token). `null` sem número válido ou sem mensagem. */
export function linkDoWhatsApp(telefone: string | null | undefined, mensagem: string | null | undefined): string | null {
  const numero = numeroDoWhatsApp(telefone);
  if (!numero || !mensagem || !mensagem.trim()) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

export const MOTIVO_SEM_TELEFONE = 'O aluno não tem telefone no cadastro.';

/**
 * O botão "Abrir WhatsApp com a mensagem" na folha: some (`null`) quando a API não manda a mensagem (cobrança que não está
 * em aberto, aluno inativo) e fica desabilitado, com o porquê, sem telefone válido. Nada é registrado como enviado.
 */
export function botaoDoWhatsApp(dados: LembretesDaCobranca | null | undefined): { link: string | null; motivo: string | null } | null {
  if (!dados?.whatsapp) return null;
  const link = linkDoWhatsApp(dados.whatsapp.telefone, dados.whatsapp.mensagem);
  return link ? { link, motivo: null } : { link: null, motivo: MOTIVO_SEM_TELEFONE };
}
