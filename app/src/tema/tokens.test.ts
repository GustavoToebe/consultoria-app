import { CLARO, ESCURO, contraste, textoSobre } from './tokens';

it.each([CLARO, ESCURO])('preserva contraste AA nos detalhes de todas as superfícies', (cores) => {
  for (const superficie of [cores.superficie, cores.superficie2, cores.superficie3]) {
    expect(contraste(cores.textoSuave, superficie)).toBeGreaterThanOrEqual(4.5);
  }
});

it.each([CLARO, ESCURO])('campo, borda e cartão se distinguem do fundo e entre si', (cores) => {
  expect(contraste(cores.bordaCampo, cores.campo)).toBeGreaterThanOrEqual(3);
  expect(contraste(cores.borda, cores.superficie)).toBeGreaterThanOrEqual(1.4);
  expect(contraste(cores.fundo, cores.superficie)).toBeGreaterThanOrEqual(1.1);
});

describe('contraste do texto sobre a cor da marca', () => {
  it('usa branco em cores escuras e preto em cores claras', () => {
    expect(textoSobre('#C62828')).toBe('#FFFFFF');
    expect(textoSobre('#2563EB')).toBe('#FFFFFF');
    expect(textoSobre('#FACC15')).toBe('#000000');
    expect(textoSobre('#FFFFFF')).toBe('#000000');
  });

  it('calcula o contraste WCAG', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contraste('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});
