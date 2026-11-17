import type { ChaveDaTroca, ExercicioDaTroca, TrocaDeExercicio, TrocasDeExercicio } from '../api/tipos';
import { dataRelativa } from './datasRelativas';
import { SEM_DADO } from './formatos';

/**
 * Alertas de troca de exercício (`docs/planos/alertas-de-troca.md`): textos e chave das trocas "só hoje" que o treinador vê
 * na ficha e no Início. Só nomes de exercício e de sessão, nunca carga, repetições nem texto do aluno. O aluno não é avisado
 * do "Visto". Regras puras, sem React.
 */

/** A chave natural que o `PUT`/`DELETE .../visto` recebe: a alternativa é o exercício que o aluno fez no lugar. */
export function chaveDaTroca(t: Pick<TrocaDeExercicio, 'data' | 'planoVersaoId' | 'exercicioUid' | 'alternativa'>): ChaveDaTroca {
  return { data: t.data, planoVersaoId: t.planoVersaoId, exercicioUid: t.exercicioUid, alternativaId: t.alternativa.exercicioId };
}

/** Identificador estável da troca na tela (a mesma troca pode se repetir no dia em outra versão do plano). */
export function idDaTroca(t: Pick<TrocaDeExercicio, 'data' | 'planoVersaoId' | 'exercicioUid' | 'alternativa'>): string {
  const c = chaveDaTroca(t);
  return `${c.data}|${c.planoVersaoId}|${c.exercicioUid}|${c.alternativaId}`;
}

const nome = (e: ExercicioDaTroca) => e.nome?.trim() || SEM_DADO;

/** "Supino reto trocado por Supino com halteres". */
export const textoDaTroca = (t: Pick<TrocaDeExercicio, 'principal' | 'alternativa'>): string =>
  `${nome(t.principal)} trocado por ${nome(t.alternativa)}`;

/** Linha de apoio: sessão, quando e quantas séries foram feitas na alternativa ("Treino A · ontem · 3 séries"). */
export function metadadosDaTroca(t: Pick<TrocaDeExercicio, 'sessao' | 'data' | 'series'>, hoje: string): string {
  const series = t.series > 0 ? `${t.series} ${t.series === 1 ? 'série' : 'séries'}` : null;
  return [t.sessao?.trim() || null, dataRelativa(t.data, hoje), series].filter(Boolean).join(' · ');
}

export interface SeloDaTroca {
  texto: string;
  tipo: 'atencao' | 'neutro';
}

/**
 * Selo da situação: vista é neutra ("Visto"); não vista é âmbar ("Para ver") só para quem pode marcar (quem age, regra da
 * cor por situação); quem só lê vê "Não vista", neutro.
 */
export function seloDaTroca(t: Pick<TrocaDeExercicio, 'vistoEm'>, podeReagir: boolean): SeloDaTroca {
  if (t.vistoEm) return { texto: 'Visto', tipo: 'neutro' };
  return podeReagir ? { texto: 'Para ver', tipo: 'atencao' } : { texto: 'Não vista', tipo: 'neutro' };
}

/** Nomes acessíveis das duas ações: começam pelo texto do botão (WCAG 2.5.3) e dizem qual troca. */
export function rotulosDoVisto(t: TrocaDeExercicio, hoje: string): { marcar: string; desfazer: string } {
  const qual = `${textoDaTroca(t)}, ${dataRelativa(t.data, hoje)}`;
  return { marcar: `Marcar como visto: ${qual}`, desfazer: `Desfazer o visto: ${qual}` };
}

/** Faixa do cartão: o período e quantas faltam ver. */
export function descricaoDasTrocas(trocas: readonly Pick<TrocaDeExercicio, 'vistoEm'>[], podeReagir: boolean): string {
  const n = trocas.filter((t) => !t.vistoEm).length;
  if (n === 0) return 'Últimos 7 dias · todas vistas';
  if (podeReagir) return `Últimos 7 dias · ${n} para ver`;
  return `Últimos 7 dias · ${n} ${n === 1 ? 'não vista' : 'não vistas'}`;
}

/** A lista com o `vistoEm` novo na troca de `id` (resposta da API); o resto fica igual. */
export function comVisto(dados: TrocasDeExercicio, id: string, vistoEm: string | null): TrocasDeExercicio {
  return { ...dados, trocas: dados.trocas.map((t) => (idDaTroca(t) === id ? { ...t, vistoEm } : t)) };
}
