import { ALVO_TOQUE, espaco } from '../tema/tokens';

/**
 * Folga no fim de uma rolagem para o botão flutuante de voltar ao topo (`RolagemComTopo`) não cobrir o último item:
 * a margem de baixo (16), o botão (44) e o respiro (8). Arquivo puro (sem React) para as medidas do exercício do aluno,
 * testadas em jest sem carregar o ícone, usarem o mesmo valor.
 */
export const FOLGA_DO_BOTAO = espaco(2) + ALVO_TOQUE + espaco(1);
