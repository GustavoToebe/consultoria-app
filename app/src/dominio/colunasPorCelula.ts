/**
 * Tela larga: revisão (24/11). Colunas de cartões pela largura medida, sem esticar: quantas células de pelo menos
 * `minimo` px cabem (com `vao` entre elas), de 1 a `maximo`. A sobra de uma linha incompleta fica vazia (as células
 * não crescem para preencher). Usada nos Perfis da Equipe.
 */
export function colunasPorCelula(largura: number, minimo: number, vao: number, maximo = 4): number {
  if (largura <= 0 || minimo <= 0) return 1;
  return Math.max(1, Math.min(maximo, Math.floor((largura + vao) / (minimo + vao))));
}

/** Coluna do hub de Configurações: em 2 colunas o bloco tem os 1040 px de antes (`LARGURA_EDITOR`). */
export const CELULA_DO_HUB = 508;
export const VAO_DO_HUB = 24;
/** Abaixo disto o hub fica numa coluna (a regra da `Grade`). */
const DUAS_COLUNAS_NO_HUB = 760;

/**
 * Colunas do hub de Configurações: 1 abaixo de 760 px, depois de 2 a 4 colunas de `CELULA_DO_HUB`, conforme cabem. Com
 * `grupos` cartões, não passa do número de grupos (mínimo 2, o desenho de sempre) e, se a última linha ficaria com um
 * cartão sozinho, tira uma coluna enquanto houver mais de 2. `grupos` são os do perfil, não os da busca: a grade não
 * muda de largura enquanto a pessoa digita.
 */
export function colunasDoHub(largura: number, grupos: number): number {
  if (largura < DUAS_COLUNAS_NO_HUB) return 1;
  let colunas = Math.min(colunasPorCelula(largura, CELULA_DO_HUB, VAO_DO_HUB), Math.max(2, grupos));
  colunas = Math.max(2, colunas);
  while (colunas > 2 && grupos % colunas === 1) colunas -= 1;
  return colunas;
}

/** Largura do bloco do hub com `colunas` colunas (2 = 1040 px). */
export const larguraDoHub = (colunas: number): number => colunas * CELULA_DO_HUB + (colunas - 1) * VAO_DO_HUB;
