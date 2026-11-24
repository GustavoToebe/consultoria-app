/**
 * Janela única de criação da Agenda (agenda: criar unificado, 23/11; `docs/planos/agenda-criar-unificado.md`): o segmento
 * "Compromisso com aluno | Evento pessoal", o início sugerido (o fim aparece desde o começo), a duração escrita ao lado do
 * fim, o que a troca de tipo leva de um formulário ao outro e a dica do estado vazio da grade. Tudo puro: a tela só chama.
 */
import type { VisaoDoCalendario } from './agendaCalendario';
import { DURACAO_PADRAO_DO_EVENTO, type FormularioDoEvento, LIMITES_DO_EVENTO } from './agendaEvento';
import {
  DURACAO_PADRAO, type FormularioDoCompromisso, LIMITES_COMPROMISSO, minutosDaHora, horaDosMinutos, terminaNoDiaSeguinte, textoDaDuracao,
} from './agendaPresencial';
import { somarDias } from './formatos';

export type TipoDaCriacao = 'compromisso' | 'evento';

export const ROTULOS_DA_CRIACAO: Record<TipoDaCriacao, string> = { compromisso: 'Compromisso com aluno', evento: 'Evento pessoal' };

/** Passo do início sugerido: a próxima meia hora, como no Google Agenda. */
const PASSO_DO_INICIO_SUGERIDO = 30;
const MINUTOS_NO_DIA = 24 * 60;

/**
 * Data (AAAA-MM-DD) e início (HH:MM) de uma criação aberta pelo "Criar": a hora vem da próxima meia hora do relógio de
 * Brasília (`minutoDeAgora`, 0 a 1439; meia hora em ponto fica). Em hoje, passar da meia-noite leva ao dia seguinte às
 * 00:00; noutro dia, a hora só volta ao relógio (00:00 do mesmo dia). O clique na grade já traz a hora e não passa aqui.
 */
export function horarioSugerido(data: string, hoje: string, minutoDeAgora: number): { data: string; hora: string } {
  const minuto = Math.ceil(minutoDeAgora / PASSO_DO_INICIO_SUGERIDO) * PASSO_DO_INICIO_SUGERIDO;
  if (minuto < MINUTOS_NO_DIA) return { data, hora: horaDosMinutos(minuto) };
  return { data: data === hoje ? somarDias(data, 1) : data, hora: '00:00' };
}

/** A duração escrita ao lado do fim: "1 h", "45 min" e, passando da meia-noite, "1 h, dia seguinte". Entrada inválida = `null`. */
export function textoDaDuracaoDoHorario(hora: string, duracao: string): string | null {
  const minutos = /^\d+$/.test(duracao.trim()) ? Number(duracao.trim()) : NaN;
  if (minutosDaHora(hora) === null || !(minutos > 0)) return null;
  return `${textoDaDuracao(minutos)}${terminaNoDiaSeguinte(hora, minutos) ? ', dia seguinte' : ''}`;
}

/** Duração que cabe nos limites do tipo; fora deles (ou inválida), a padrão dele. */
function duracaoQueCabe(duracao: string, limites: { duracaoMinima: number; duracaoMaxima: number }, padrao: number): { valor: string; coube: boolean } {
  const n = /^\d+$/.test(duracao.trim()) ? Number(duracao.trim()) : NaN;
  const coube = n >= limites.duracaoMinima && n <= limites.duracaoMaxima;
  return { valor: coube ? String(n) : String(padrao), coube };
}

/** Junta os nomes em português: "alunos", "alunos e repetição", "título, repetição e dia inteiro". */
function lista(nomes: readonly string[]): string {
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export interface TrocaDeTipo {
  compromisso: FormularioDoCompromisso;
  evento: FormularioDoEvento;
  /** O que foi digitado no tipo de origem e o de destino não leva (vazio = nada); a tela avisa sem bloquear. */
  perdas: string[];
}

/**
 * Trocar o tipo no segmento: o destino recebe da origem o que os dois têm (data, início e fim, local e a observação, que
 * no evento se chama descrição); o resto do destino fica como estava (aluno, responsável, título, agenda, repetição). A
 * origem não muda: voltar ao tipo anterior mostra o que foi digitado nele. `comObservacao` = o compromisso tem o campo
 * (`ALUNO_SENSIVEL_ALTERAR`). Não migram e entram em `perdas` quando preenchidos: alunos, título, repetição, dia inteiro,
 * a duração acima do máximo do compromisso (volta a 1 h) e o texto que não cabe ou não tem campo no destino.
 */
export function trocarTipoDaCriacao(para: TipoDaCriacao, compromisso: FormularioDoCompromisso, evento: FormularioDoEvento,
  comObservacao: boolean): TrocaDeTipo {
  const perdas: string[] = [];
  if (para === 'evento') {
    const c = compromisso;
    if (c.alunoIds.length) perdas.push(c.alunoIds.length === 1 ? 'aluno' : 'alunos');
    if (c.repeticao.tipo !== 'NENHUMA') perdas.push('repetição');
    const duracao = duracaoQueCabe(c.duracao, LIMITES_DO_EVENTO, DURACAO_PADRAO_DO_EVENTO);
    return {
      compromisso,
      evento: {
        ...evento, data: c.data, hora: c.hora, duracao: duracao.valor, local: c.local.slice(0, LIMITES_DO_EVENTO.local),
        descricao: comObservacao ? c.observacao.slice(0, LIMITES_DO_EVENTO.descricao) : evento.descricao,
      },
      perdas,
    };
  }
  const e = evento;
  if (e.titulo.trim()) perdas.push('título');
  if (e.repeticao.tipo !== 'NENHUMA') perdas.push('repetição');
  if (e.diaInteiro) perdas.push('dia inteiro');
  const duracao = duracaoQueCabe(e.duracao, LIMITES_COMPROMISSO, DURACAO_PADRAO);
  if (!e.diaInteiro && e.hora && !duracao.coube) perdas.push('duração');
  const descricao = e.descricao.trim();
  if (descricao && (!comObservacao || descricao.length > LIMITES_COMPROMISSO.observacao)) perdas.push('descrição');
  return {
    evento,
    compromisso: {
      ...compromisso, data: e.data, hora: e.hora, duracao: duracao.valor, local: e.local.slice(0, LIMITES_COMPROMISSO.local),
      observacao: comObservacao ? e.descricao.slice(0, LIMITES_COMPROMISSO.observacao) : compromisso.observacao,
    },
    perdas,
  };
}

/** O aviso da troca para `para`, ou `null` sem perdas: "Fica só no compromisso: alunos e repetição." */
export function textoDasPerdas(para: TipoDaCriacao, perdas: readonly string[]): string | null {
  if (!perdas.length) return null;
  return `Fica só no ${para === 'evento' ? 'compromisso' : 'evento pessoal'}: ${lista(perdas)}.`;
}

/**
 * A dica no meio da grade vazia (Dia e Semana no PC). Só fala em clicar quando o clique num horário vazio cria de fato
 * (`podeCriarNoHorario`: web, grade e `AGENDA_ALTERAR`).
 */
export function dicaDaGradeVazia(visao: Extract<VisaoDoCalendario, 'dia' | 'semana'>, podeCriarNoHorario: boolean): string {
  const base = visao === 'dia' ? 'Nenhum compromisso neste dia.' : 'Nenhum compromisso nesta semana.';
  return podeCriarNoHorario ? `${base} Clique num horário para criar.` : base;
}
