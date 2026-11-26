import { misturar, type Cores } from '../tema/tokens';

/**
 * Contorno do botão de perigo: 70% do caminho entre o fundo tonal e `perigo`. É o mínimo que passa 3:1 contra o fundo da
 * tela e as três superfícies nos nove temas (WCAG 1.4.11; a 40% dava ~2:1; o pior é o Oceano, 3,03).
 */
export const MISTURA_DA_BORDA_DE_PERIGO = 0.7;

/**
 * Botão de perigo tonal (26/11, pedido do Gustavo; o desenho do "Sair sem salvar" estendido a todo destrutivo): fundo
 * `perigoSuave` (a cor a 12% sobre o cartão, opaco), contorno de perigo e rótulo e ícone `perigo` (≥ 4,5:1 sobre o
 * fundo). Mouse em cima ou apertado: o contorno fica cheio; o fundo não escurece (mais tinta tiraria o rótulo de 4,5:1).
 */
export function coresDoBotaoDePerigo(cores: Pick<Cores, 'perigo' | 'perigoSuave'>) {
  return { fundo: cores.perigoSuave, borda: misturar(cores.perigoSuave, cores.perigo, MISTURA_DA_BORDA_DE_PERIGO), texto: cores.perigo, bordaAoPassar: cores.perigo };
}
