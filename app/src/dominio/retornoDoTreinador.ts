import type { SerieComRecorde, SessaoConcluidaDoServidor } from '../api/tipos';
import { resumoDaConclusao } from './conclusaoNaTela';
import { textoDoRecorde } from './recordesPessoais';

/**
 * Textos do treinador para o retorno ao aluno (frente Engajamento, passo 0.5): "Recordes da semana" e a lista de treinos
 * concluídos com o "Visto". Regras puras; as telas são `treinador/CartaoRecordesDaSemana` e `CartaoTreinosConcluidos`.
 */

/** "Supino: Maior carga · 70 kg · Maior volume · 700 kg". */
export function textoDaSerieComRecorde(s: Pick<SerieComRecorde, 'exercicioNome' | 'recordes'>): string {
  return `${s.exercicioNome}: ${s.recordes.map(textoDoRecorde).join(' · ')}`;
}

/** "1 série com recorde nos últimos 7 dias" / "3 séries...". */
export function textoDoTotalDeRecordes(total: number): string {
  return `${total} ${total === 1 ? 'série com recorde' : 'séries com recorde'} nos últimos 7 dias`;
}

/** Só as concluídas (reaberta não aparece), da mais recente à mais antiga, como vieram do servidor. */
export function treinosConcluidos(sessoes: readonly SessaoConcluidaDoServidor[]): SessaoConcluidaDoServidor[] {
  return sessoes.filter((s) => s.concluida && !!s.id);
}

/** Metadados da linha: "Fiz tudo · 52 min" (o que o aluno informou); sem nada, vazio. */
export function metadadosDoTreino(s: Pick<SessaoConcluidaDoServidor, 'resultado' | 'duracaoSegundos'>): string {
  return resumoDaConclusao(s);
}

/** "12 treinos concluídos no total" (o histórico inteiro do aluno). */
export function textoDoTotalDeTreinos(total: number): string {
  return `${total} ${total === 1 ? 'treino concluído' : 'treinos concluídos'} no total`;
}
