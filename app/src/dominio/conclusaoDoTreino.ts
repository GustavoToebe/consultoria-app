import type { Sessao } from '../api/tipos';
import { somarDias } from './formatos';
import { totalDeSeries } from './semana';

/**
 * Regras puras de "Concluir treino" (frente Engajamento, passo 0.1). Espelham as do servidor para o app nunca produzir
 * um registro que vira RECUSADO para sempre: data de hoje até 60 dias atrás, resultado coerente com `concluida`,
 * duração nula ou de 60 s a 6 h, comentário de até 300 caracteres. Os textos da pergunta e dos botões ficam na tela.
 */

export type ResultadoDoTreino = 'COMPLETA' | 'PARCIAL';

/** Duração aceita pelo servidor: de 1 minuto a 6 horas (ou nenhuma). */
export const DURACAO_MINIMA_SEGUNDOS = 60;
export const DURACAO_MAXIMA_SEGUNDOS = 21_600;
/** Abaixo disto (10 min) o app pergunta se a duração está certa (P9): "Ajustar duração" ou "Manter". */
export const DURACAO_SUSPEITA_SEGUNDOS = 600;
/**
 * Tamanho máximo do comentário, contado depois do strip. O servidor conta code points e o app, unidades UTF-16 (um
 * emoji vale 2 aqui e 1 lá): o app é o mais restrito, então nunca deixa passar o que o servidor recusaria.
 */
export const COMENTARIO_MAXIMO = 300;
/** Quantos dias para trás o servidor aceita concluir (e nenhum para frente). */
export const DIAS_PARA_TRAS_DA_CONCLUSAO = 60;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** A data é de hoje até 60 dias atrás? Data futura nunca: o servidor recusaria para sempre. */
export function podeConcluirEm(data: string, hoje: string): boolean {
  return ISO.test(data) && data <= hoje && data >= somarDias(hoje, -DIAS_PARA_TRAS_DA_CONCLUSAO);
}

/**
 * Séries previstas na sessão e quantas estão feitas. `feita` diz se a série (pelo `uid`) está concluída na data da
 * tela (o `registroDe(uid)?.concluida` do `useSessaoDoDia`).
 */
export function contagemDeSeries(sessao: Sessao, feita: (serieUid: string) => boolean): { total: number; feitas: number } {
  const feitas = sessao.exercicios.reduce((n, e) => n + e.series.filter((s) => feita(s.uid)).length, 0);
  return { total: totalDeSeries(sessao), feitas };
}

/**
 * Sugestão do resultado: COMPLETA quando todas as séries previstas estão feitas, senão PARCIAL. Sessão sem série
 * prevista nunca é "completa" (não há o que ter completado); o aluno ainda pode escolher.
 */
export function sugestaoDoResultado(totalDeSeriesPrevistas: number, seriesFeitas: number): ResultadoDoTreino {
  return totalDeSeriesPrevistas > 0 && seriesFeitas >= totalDeSeriesPrevistas ? 'COMPLETA' : 'PARCIAL';
}

/**
 * Segundos entre o início do treino (a primeira série marcada, guardada só no aparelho) e `agora`, arredondado.
 * `null` quando não se sabe: sem início, início ilegível, relógio que andou para trás (negativo) ou mais de 6 h
 * (esquecido aberto; o teto seria um valor inventado, então a tela pede a duração ao aluno). Abaixo de 60 s devolve o
 * valor cru: `precisaAjustarDuracao` pergunta e `validarConclusao` impede de salvar.
 */
export function duracaoDoTreino(inicioIso: string | null, agora: Date): number | null {
  if (!inicioIso) return null;
  const inicio = Date.parse(inicioIso);
  if (Number.isNaN(inicio)) return null;
  const segundos = Math.round((agora.getTime() - inicio) / 1000);
  return segundos < 0 || segundos > DURACAO_MAXIMA_SEGUNDOS ? null : segundos;
}

/** O aviso "abaixo de 10 min": verdadeiro com duração conhecida menor que 600 s. Sem duração não há o que perguntar. */
export function precisaAjustarDuracao(segundos: number | null): boolean {
  return segundos !== null && segundos < DURACAO_SUSPEITA_SEGUNDOS;
}

/** Duração que o servidor aceita: nenhuma, ou inteira de 60 a 21600 s. */
export function duracaoValida(segundos: number | null): boolean {
  return segundos === null || (Number.isInteger(segundos) && segundos >= DURACAO_MINIMA_SEGUNDOS && segundos <= DURACAO_MAXIMA_SEGUNDOS);
}

/** O campo "Ajustar duração" é em minutos; o registro, em segundos. */
export function minutosParaSegundos(minutos: number): number {
  return Math.round(minutos * 60);
}

export function segundosParaMinutos(segundos: number): number {
  return Math.round(segundos / 60);
}

export interface EntradaDaConclusao {
  data: string;
  /** "Hoje" do aparelho (`hojeIso()`). */
  hoje: string;
  resultado: string | null | undefined;
  duracaoSegundos: number | null | undefined;
  comentario: string | null | undefined;
}

/** Um texto por campo com problema (curto, para mostrar junto do campo); `geral` é o que não é de campo nenhum. */
export interface ProblemasDaConclusao {
  data?: string;
  resultado?: string;
  duracao?: string;
  comentario?: string;
  geral?: string;
}

/** O que vai para o registro: já normalizado (comentário sem espaços nas pontas, em branco = nulo). */
export interface ConclusaoNormalizada {
  data: string;
  resultado: ResultadoDoTreino;
  duracaoSegundos: number | null;
  comentario: string | null;
}

export type ValidacaoDaConclusao =
  | { valida: true; registro: ConclusaoNormalizada }
  | { valida: false; problemas: ProblemasDaConclusao };

/**
 * Comentário sem espaços nas pontas; em branco vira `null`. O caractere nulo (`\u0000`) sai: o Postgres não o guarda e o
 * servidor recusa o registro inteiro, que ficaria para sempre como falha na fila do aparelho.
 */
export function normalizarComentario(comentario: string | null | undefined): string | null {
  const limpo = (comentario ?? '').replace(/\u0000/g, '').trim();
  return limpo === '' ? null : limpo;
}

/**
 * Confere uma conclusão ("Concluir treino") antes de gravar. Devolve os problemas por campo ou o registro normalizado.
 * "Manter" uma duração abaixo de 60 s não salva: a regra devolve que precisa ajustar.
 */
export function validarConclusao(entrada: EntradaDaConclusao): ValidacaoDaConclusao {
  const problemas: ProblemasDaConclusao = {};
  if (!podeConcluirEm(entrada.data, entrada.hoje)) {
    problemas.data = 'Só dá para concluir um treino de hoje até 60 dias atrás.';
  }
  if (entrada.resultado !== 'COMPLETA' && entrada.resultado !== 'PARCIAL') {
    problemas.resultado = 'Escolha se o treino foi completo ou parcial.';
  }
  const duracao = entrada.duracaoSegundos ?? null;
  if (!duracaoValida(duracao)) {
    problemas.duracao =
      duracao !== null && duracao < DURACAO_MINIMA_SEGUNDOS
        ? 'Ajuste a duração: o mínimo é 1 minuto.'
        : 'A duração precisa ficar entre 1 minuto e 6 horas.';
  }
  const comentario = normalizarComentario(entrada.comentario);
  if (comentario !== null && comentario.length > COMENTARIO_MAXIMO) {
    problemas.comentario = `O comentário pode ter até ${COMENTARIO_MAXIMO} caracteres.`;
  }
  if (Object.keys(problemas).length > 0) return { valida: false, problemas };
  return {
    valida: true,
    registro: { data: entrada.data, resultado: entrada.resultado as ResultadoDoTreino, duracaoSegundos: duracao, comentario },
  };
}
