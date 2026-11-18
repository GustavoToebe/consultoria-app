import { ArrowDown, ArrowUp } from 'lucide-react-native';

import type { AcaoDoMenu } from './FolhaDeAcoes';

/**
 * "Mover para cima" e "Mover para baixo" do ⋯ de um item de lista: a alternativa sem arrastar ao arrastar pela alça (WCAG
 * 2.5.7) e o caminho do teclado (arrastar, 18/11). Na ponta da lista a ação que não cabe some. O nome acessível começa
 * pelo texto visível e traz o "Subir X"/"Descer X" de antes no detalhe (WCAG 2.5.3, o nome contém o rótulo visível).
 */
export function acoesDeMover({ nome, posicao, total, aoMover }: { nome: string; posicao: number; total: number; aoMover: (delta: -1 | 1) => void }): AcaoDoMenu[] {
  const acoes: (AcaoDoMenu | null)[] = [
    posicao > 0 ? { rotulo: 'Mover para cima', detalhe: `Subir ${nome} uma posição.`, Icone: ArrowUp, aoTocar: () => aoMover(-1) } : null,
    posicao < total - 1 ? { rotulo: 'Mover para baixo', detalhe: `Descer ${nome} uma posição.`, Icone: ArrowDown, aoTocar: () => aoMover(1) } : null,
  ];
  return acoes.filter((a): a is AcaoDoMenu => a !== null);
}
