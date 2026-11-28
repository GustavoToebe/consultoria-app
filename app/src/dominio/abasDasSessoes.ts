import type { Sessao } from '../api/tipos';
import { textoDosTotaisDaSessao } from './contagemDoTreino';
import { DIAS_CURTOS, DIAS_SEMANA, rotuloDaSessao } from './editorTreino';
import type { ResumoDaSessaoPorContagem } from './inspetorDoTreino';
import { rotuloDoDia, rotuloDoTipo } from './semana';

/**
 * Textos das abas das Sessões e do cabeçalho da sessão no editor de treino (proposta de 27/11): a aba é ícone + dia curto +
 * nome + contagem; o dia de descanso fica discreto (sem contagem). O nome acessível continua o de `rotuloDaSessao`.
 */

export interface PartesDaSessao {
  /** Dia curto ("Seg"); nulo sem dia fixo. */
  dia: string | null;
  nome: string;
  /** Só `DESCANSO`: a aba fica discreta e sem contagem. `DESCANSO_ATIVO` tem exercícios e mantém ícone e contagem. */
  descanso: boolean;
  rotuloAcessivel: string;
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Nome inteiro da sessão ("Full Body 1"); só cai o prefixo do próprio dia ("Segunda - Costas" → "Costas"), seguido de
 * separador ou do fim. Sobrou vazio (o nome padrão "Quarta"): o tipo ("Descanso", "Treino"). Sem dia e sem nome: "Sessão N".
 */
export function partesDaSessao(s: Sessao, posicao: number): PartesDaSessao {
  const diaInteiro = s.diaSemana ? DIAS_SEMANA[s.diaSemana - 1] : null;
  const nomeTodo = s.nome.trim();
  // "Segunda-feira - Costas": o "-feira" (ou " feira") faz parte do dia, não é o separador.
  const nome = diaInteiro ? nomeTodo.replace(new RegExp(`^${escapar(diaInteiro)}(?:[-\\s]feira)?(?:\\s*[-–—·:]\\s*|$)`, 'i'), '').trim() : nomeTodo;
  const n = s.exercicios.length;
  return {
    dia: s.diaSemana ? DIAS_CURTOS[s.diaSemana - 1] : null,
    nome: nome || (diaInteiro ? rotuloDoTipo(s) : `Sessão ${posicao + 1}`),
    descanso: s.tipo === 'DESCANSO',
    rotuloAcessivel: `${rotuloDaSessao(s, posicao)}, ${n} ${n === 1 ? 'exercício' : 'exercícios'}`,
  };
}

/** "Segunda · Treino" ("Sem dia fixo" ou "3x na semana" sem dia). */
export function diaETipoDaSessao(s: Sessao): string {
  return `${rotuloDoDia(s)} · ${rotuloDoTipo(s)}`;
}

/** Linha do cabeçalho da sessão: "Segunda · Treino · 7 exercícios · 23 séries · 16 de trabalho". */
export function linhaDaSessao(s: Sessao, r: Pick<ResumoDaSessaoPorContagem, 'exercicios' | 'series' | 'seriesDeTrabalho'>): string {
  return `${diaETipoDaSessao(s)} · ${textoDosTotaisDaSessao(r)}`;
}
