import { dataParaTela } from './formatos';
import { minutosParaSegundos, segundosParaMinutos, type ResultadoDoTreino } from './conclusaoDoTreino';
import type { ConclusaoDoTreino } from './sessoesConcluidas';

/**
 * Textos de "Concluir treino" que a tela mostra (frente Engajamento, passo 0.1). As regras (data, duração, comentário)
 * ficam em `conclusaoDoTreino.ts`; aqui só o que a pessoa lê e a leitura do campo em minutos.
 */

export const ROTULO_DO_RESULTADO: Record<ResultadoDoTreino, string> = {
  COMPLETA: 'Fiz tudo',
  PARCIAL: 'Fiz em parte',
};

/** Pergunta da Folha quando a duração é curta (P9). */
export const PERGUNTA_DURACAO_CURTA = 'Esse treino durou menos de 10 minutos. Quer ajustar a duração?';

/** "52 min"; abaixo de 1 min não acontece (o servidor recusa), mas sai "1 min" em vez de "0 min". */
export function textoDaDuracao(segundos: number): string {
  return `${Math.max(1, segundosParaMinutos(segundos))} min`;
}

/** Linha de baixo do "Treino concluído": "Fiz tudo · 52 min" (sem a duração quando não há). */
export function resumoDaConclusao(c: Pick<ConclusaoDoTreino, 'resultado' | 'duracaoSegundos'>): string {
  return [c.resultado ? ROTULO_DO_RESULTADO[c.resultado] : null, c.duracaoSegundos != null ? textoDaDuracao(c.duracaoSegundos) : null]
    .filter(Boolean)
    .join(' · ');
}

/** O campo de minutos aceita só dígitos (no máximo 3: até 6 h cabe em 360). */
export function soMinutos(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, 3);
}

/** Texto do campo → segundos do registro; vazio = sem duração. O que está no campo é o que vai. */
export function segundosDoCampo(texto: string): number | null {
  const limpo = soMinutos(texto);
  return limpo === '' ? null : minutosParaSegundos(Number(limpo));
}

/** Duração medida (segundos) → texto inicial do campo; sem medida, vazio. */
export function campoDaDuracao(segundos: number | null): string {
  return segundos === null ? '' : String(segundosParaMinutos(segundos));
}

/** Linha que substitui o botão em data futura. */
export function disponivelAPartirDe(data: string): string {
  return `Você poderá concluir este treino a partir de ${dataParaTela(data)}.`;
}

/** "Você marcou 3 de 15 séries." (ajuda da escolha do resultado). */
export function textoDasSeriesMarcadas(feitas: number, total: number): string {
  if (total === 0) return 'Este treino não tem séries para marcar.';
  return `Você marcou ${feitas} de ${total} ${total === 1 ? 'série' : 'séries'}.`;
}
