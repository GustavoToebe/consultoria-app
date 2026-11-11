import { ROTULO_DO_RESULTADO } from './conclusaoNaTela';
import type { ResultadoDoTreino } from './mapaDeTreinos';

/** Limite do texto pronto (o post da comunidade aceita mais; o pronto fica curto e editável). */
export const LIMITE_DO_TEXTO_PRONTO = 280;

/**
 * Texto pronto do "Publicar na comunidade" (C11) na tela "Bom trabalho!": só o nome do treino, o resultado e quantos
 * recordes saíram no dia. Nunca carga, peso, medida, dieta ou o comentário do aluno (a função nem os recebe). O nome
 * longo é cortado com "…" para o texto caber em 280.
 */
export function textoDoResultado({ treino, resultado, recordes }: { treino: string; resultado: ResultadoDoTreino | null; recordes: number }): string {
  const fim = [
    resultado ? `, ${ROTULO_DO_RESULTADO[resultado].toLowerCase()}` : '',
    '.',
    recordes > 0 ? ` Bati ${recordes} ${recordes === 1 ? 'recorde pessoal' : 'recordes pessoais'} hoje!` : '',
  ].join('');
  const comeco = 'Treino concluído: ';
  const nome = treino.trim() || 'treino do dia';
  const cabe = LIMITE_DO_TEXTO_PRONTO - comeco.length - fim.length;
  return `${comeco}${nome.length > cabe ? `${nome.slice(0, cabe - 1).trimEnd()}…` : nome}${fim}`;
}
