import { LARGURA_DA_PREVIA_NA_LARGA } from '../../dominio/colunasDaMobilidade';
import { espaco, LARGURA_DUAS_COLUNAS, LARGURA_FORMULARIO } from '../../tema/tokens';

/** Vão entre o formulário e a prévia ao lado. */
export const VAO_DA_PREVIA = espaco(3);
/** Largura medida da tela da Marca a partir da qual a prévia vai para uma coluna de 320 ao lado dos ajustes. */
export const PREVIA_AO_LADO = LARGURA_DUAS_COLUNAS - 80;
/**
 * A partir daqui o formulário inteiro fica numa coluna de `LARGURA_FORMULARIO` (640) e a prévia ocupa o resto, com pelo
 * menos a largura da prévia da mobilidade na faixa larga (440): 1104 px medidos, o que 1920 dentro de Configurações já dá.
 */
export const FORMULARIO_E_PREVIA = LARGURA_FORMULARIO + VAO_DA_PREVIA + LARGURA_DA_PREVIA_NA_LARGA;
/** Teto do desenho da prévia na coluna larga: a largura do app do aluno na web (720); a coluna para nele mais o recuo do cartão. */
export const LARGURA_DO_APP_DO_ALUNO = 720;

/**
 * Onde a prévia da marca fica, pela largura MEDIDA da tela (não a janela: o menu e a coluna de Configurações comem largura):
 * `acima` (compacta, no topo da Aparência), `lado` (coluna de 320 ao lado dos ajustes), `larga` (formulário de 640 e a
 * prévia no resto). `null` sem medida: nenhuma prévia pisca.
 */
export type ArranjoDaMarca = 'acima' | 'lado' | 'larga';

export function arranjoDaMarca(largura: number | null | undefined): ArranjoDaMarca | null {
  if (typeof largura !== 'number' || !(largura > 0)) return null;
  if (largura >= FORMULARIO_E_PREVIA) return 'larga';
  return largura >= PREVIA_AO_LADO ? 'lado' : 'acima';
}
