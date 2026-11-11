import type { Compromisso } from '../api/agendaTipos';
import { resumoDosParticipantes } from './agendaPresencial';

/**
 * Legibilidade dos itens da agenda (reunião de 30/10 com o Saraiva: "a cor ocupa pouco do evento"). A cor da agenda
 * aparece só numa faixa de 8 px à esquerda, sobre o fundo neutro (o fundo tingido saiu com o guia de 11/11: cor é sinal);
 * o texto do item é sempre a cor `texto` do tema, nunca a cor da agenda, e o status vai escrito (selo) ou, no bloco que
 * não cabe, em ícone com o nome acessível.
 */

/** Largura da faixa da cor da agenda, à esquerda do item (antes eram 4 px). */
export const LARGURA_DA_FAIXA = 8;
/** Texto ≥ 4,5:1 (WCAG 1.4.3); faixa e ícones ≥ 3:1 (WCAG 1.4.11). */
export const CONTRASTE_DO_TEXTO = 4.5;
export const CONTRASTE_DO_GRAFICO = 3;

/** "09:00" vira "9h"; "09:30", "9h30". Texto que não é hora fica como veio. */
function horaPorExtenso(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  return `${Number(m[1])}h${m[2] === '00' ? '' : m[2]}`;
}

/** "a" concorda com a hora: a 0h e a 1h são singular ("à 1h", "da 1h"), as outras plural ("às 9h", "das 9h"). */
const singular = (hhmm: string) => /^0?[01]:/.test(hhmm);

/** Minutos desde a meia-noite de "HH:MM"; `null` quando o texto não é hora. */
function minutosDoDia(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * O horário no nome acessível do compromisso: "das 9h às 10h" quando há fim, e só o início ("09:00") quando não há,
 * como era antes de existir o fim. Fim no dia seguinte ("das 23h à 0h do dia seguinte"): a duração vai de 5 a 480
 * minutos, então fim igual ou antes do início (na hora de Brasília) só acontece quando o compromisso passa da
 * meia-noite (decisão D18 do Gustavo, 03/11).
 */
export function horarioNoRotuloDoCompromisso(hora: string, horaFim?: string | null): string {
  if (!horaFim) return hora;
  const inicio = minutosDoDia(hora);
  const fim = minutosDoDia(horaFim);
  const diaSeguinte = inicio !== null && fim !== null && fim <= inicio ? ' do dia seguinte' : '';
  return `${singular(hora) ? 'da' : 'das'} ${horaPorExtenso(hora)} ${singular(horaFim) ? 'à' : 'às'} ${horaPorExtenso(horaFim)}${diaSeguinte}`;
}

/**
 * O status do compromisso no fim do nome acessível (", cancelado", ", realizado", ", 2 de 3 realizados · 1 faltou"). Vazio
 * quando todos ainda estão agendados: o nome continua o de antes ("Abrir compromisso de Ana, das 9h às 10h").
 */
export function statusNoRotuloDoCompromisso(c: Pick<Compromisso, 'cancelado' | 'participantes'>): string {
  if (!c.cancelado && c.participantes.every((p) => p.situacao === 'AGENDADO')) return '';
  const resumo = resumoDosParticipantes(c);
  return `, ${resumo.charAt(0).toLowerCase()}${resumo.slice(1)}`;
}

/** Como o bloco da grade se arranja na altura e na largura que tem. */
export interface ArranjoDoBloco {
  /** Horário numa linha própria embaixo do título; senão, uma linha só "09:00 Título". */
  horarioSeparado: boolean;
  linhasDoTitulo: 1 | 2;
  /** `selo` escrito, `icone` (o status vai no nome acessível e na folha) ou nada (evento sem status). */
  status: 'selo' | 'icone' | null;
}

/**
 * Largura mínima do bloco (com a faixa de 8 px) para o selo curto ("Cancelado", "Realizado") caber numa linha com o ícone,
 * sem cortar; cresce junto com o tamanho do texto.
 */
export const LARGURA_PARA_SELO = 124;
/** Na faixa de dia inteiro o selo fica ao lado do título ("Atrasada há 12 dias"): só a partir desta largura. */
export const LARGURA_PARA_SELO_AO_LADO = 260;
/** Bordas (1 + 1), respiro do lugar (1 + 1) e do bloco (2 + 2): o que sobra para o texto é a altura menos isso. */
const MOLDURA_DO_BLOCO = 8;
const ESPACO = 2;

/**
 * Arranjo do bloco pela altura e largura medidas e pela altura de linha do texto (16 px, vezes o tamanho do texto que a
 * pessoa escolheu): só entra o que cabe inteiro, para nada ser cortado pela borda sem reticências. O selo tem a altura
 * da linha mais 6 px (respiro e borda). Largura 0 (antes de medir) = ícone.
 */
export function arranjoDoBloco(altura: number, largura: number, temStatus: boolean, linha = 16): ArranjoDoBloco {
  const util = altura - MOLDURA_DO_BLOCO;
  const selo = linha + 6;
  const horarioSeparado = util >= 2 * linha + ESPACO;
  if (!horarioSeparado) return { horarioSeparado, linhasDoTitulo: 1, status: temStatus ? 'icone' : null };
  const cabeSelo = temStatus && largura >= (LARGURA_PARA_SELO * linha) / 16 && util >= 2 * linha + selo + 2 * ESPACO;
  const resto = util - (cabeSelo ? selo + ESPACO : 0);
  const linhasDoTitulo = resto >= 3 * linha + 2 * ESPACO ? 2 : 1;
  return { horarioSeparado, linhasDoTitulo, status: temStatus ? (cabeSelo ? 'selo' : 'icone') : null };
}

/**
 * Item de dia inteiro (uma linha de 44 px): o selo vai ao lado do título quando a largura medida deixa (o Dia, no PC); na
 * Semana, a coluna é estreita e o status fica no ícone antes do título (e escrito no nome acessível e na ficha).
 */
export function statusNoDiaInteiro(largura: number, temStatus: boolean, linha = 16): 'selo' | 'icone' | null {
  if (!temStatus) return null;
  return largura >= (LARGURA_PARA_SELO_AO_LADO * linha) / 16 ? 'selo' : 'icone';
}

/**
 * Texto do item na célula do mês: hora de início e título (ou só o título no dia inteiro e na atualização).
 * Cancelado escreve a palavra; o riscado sozinho não diz o status.
 */
export function textoDoItemNoMes(item: {
  titulo: string; diaInteiro: boolean; origem: string; cancelado: boolean; inicioCurto: string;
}): string {
  const base = item.diaInteiro || item.origem === 'ATUALIZACAO' ? item.titulo : `${item.inicioCurto} ${item.titulo}`;
  return item.cancelado ? `${base} · Cancelado` : base;
}
