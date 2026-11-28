import type { FaixaDeLargura } from '../tema/tokens';
import { colunasPorCelula } from './colunasPorCelula';

/**
 * Conta do aluno na web (27/11, contêiner do treinador): as seções em colunas empilhadas pela altura medida
 * (`aluno/inicio/ColunasMedidas`, a mesma do Início e da Dieta; a `ui/Alvenaria` de Configurações escolhe a coluna na
 * ordem, pela mais baixa na hora, e deixava ~250 px de buraco quando "App", a seção mais alta, chegava no fim). Teto por
 * faixa da `Tela`: 1 na compacta (celular e tablet), 2 na normal e 3 na larga e na ultralarga; dentro dele, quantas colunas
 * de pelo menos `CELULA_MINIMA_DA_CONTA` cabem, sem passar do número de peças (nunca coluna vazia).
 */
const TETO: Record<FaixaDeLargura, number> = { compacta: 1, normal: 2, larga: 3, ultralarga: 3 };

/** Uma linha da seção ("Trocar senha", com o resumo) cabe em até duas linhas de texto a partir daqui. */
export const CELULA_MINIMA_DA_CONTA = 440;

export function colunasDaConta(largura: number, faixa: FaixaDeLargura, vao: number, pecas: number): number {
  return Math.max(1, Math.min(TETO[faixa], pecas, colunasPorCelula(largura, CELULA_MINIMA_DA_CONTA, vao, 3)));
}
