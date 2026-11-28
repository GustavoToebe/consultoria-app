import { misturar, type Cores } from '../../tema/tokens';

/** Quanto do texto entra no contorno do campo sobre o cartão pintado: o mínimo que leva o pior caso a 3:1 (`cartaoDaRegra.test.ts`). */
const REFORCO_DO_CONTORNO = 0.1;

/**
 * Contorno dos campos (número e escolha da pergunta) no cartão ligado das Regras de atenção: o `bordaCampo` puxado 10% para o
 * texto. Sobre o canto mais forte da pintura (Verde-água e Laranja no Escuro) o `bordaCampo` puro dava 2,99:1 (WCAG 1.4.11
 * pede 3:1); assim fica em 3,6:1 ou mais em toda paleta e cor de ação. Mistura de cores do tema, sem token novo.
 */
export function contornoDoCampoPintado(cores: Pick<Cores, 'bordaCampo' | 'texto'>): string {
  return misturar(cores.bordaCampo, cores.texto, REFORCO_DO_CONTORNO);
}
