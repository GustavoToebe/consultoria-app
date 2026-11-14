import { coresComBordasReforcadas, coresComContraste } from '../dominio/preferencias';
import { contraste, coresDeDestaque, PALETAS, type Cores, type VarianteDoTema } from '../tema/tokens';

/**
 * Barra do resultado da enquete (`BlocoDaEnquete`, D9): azul de destaque sobre a trilha `fundo`, dentro da opção em
 * `superficie` (normal), `superficie2` (hover) ou `superficie3` (o seu voto). A barra é a parte do dado (WCAG 1.4.11): 3:1
 * contra a trilha e contra o fundo da opção, em todas as paletas e preferências. A trilha era `divisor`, que com as bordas
 * reforçadas (OCEANO, CAFE) ficava em 2,9:1 com o azul.
 */
const VARIANTES: [string, Cores, VarianteDoTema][] = Object.entries(PALETAS).flatMap(([nome, p]) => {
  const escuro = p.modo === 'ESCURO';
  return [
    [nome, p.cores, p.variante],
    [`${nome} com contraste alto`, coresComContraste(p.cores, 'ALTO', escuro), p.variante],
    [`${nome} com bordas reforçadas`, coresComBordasReforcadas(p.cores, true), p.variante],
  ] as [string, Cores, VarianteDoTema][];
});

it.each(VARIANTES)('%s: a barra da enquete passa 3:1 sobre a trilha e o fundo da opção', (_nome, cores, variante) => {
  const azul = coresDeDestaque(cores, variante).azul.cor;
  for (const fundo of [cores.fundo, cores.superficie, cores.superficie2, cores.superficie3]) {
    expect(contraste(azul, fundo)).toBeGreaterThanOrEqual(3);
  }
});
