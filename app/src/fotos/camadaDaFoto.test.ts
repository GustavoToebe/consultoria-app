import { CAMADA_DA_FOTO, contraste, ESCURO } from '../tema/tokens';

/** A camada (`rgba(0,0,0,a)`) sobre uma cor sólida `#rrggbb`. */
function sobAcamada(base: string): string {
  const alfa = Number(/[\d.]+\)$/.exec(CAMADA_DA_FOTO.fundo)?.[0].replace(')', ''));
  const canais = [1, 3, 5].map((i) => Math.round(parseInt(base.slice(i, i + 2), 16) * (1 - alfa)));
  return `#${canais.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

describe('seta desabilitada do visualizador de fotos (camada da foto)', () => {
  // No PC a seta fica no palco escuro; no celular, por cima da foto (qualquer cor, a pior é a branca).
  it.each([ESCURO.fundo, '#FFFFFF', '#808080', '#000000'])('sobre %s: ícone cinza ≥ 3:1 e bem diferente do branco do habilitado', (fundo) => {
    const composta = sobAcamada(fundo);
    expect(contraste(CAMADA_DA_FOTO.iconeDesabilitado, composta)).toBeGreaterThanOrEqual(3);
    expect(contraste(CAMADA_DA_FOTO.icone, CAMADA_DA_FOTO.iconeDesabilitado)).toBeGreaterThanOrEqual(1.8);
  });
});
