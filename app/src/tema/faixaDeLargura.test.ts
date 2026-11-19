import { faixaDeLargura } from './tokens';

describe('faixaDeLargura', () => {
  it('classifica exatamente nos limites da área de conteúdo', () => {
    expect(faixaDeLargura(0)).toBe('compacta');
    expect(faixaDeLargura(-10)).toBe('compacta');
    expect(faixaDeLargura(Number.NaN)).toBe('compacta');
    expect(faixaDeLargura(1023)).toBe('compacta');

    expect(faixaDeLargura(1024)).toBe('normal');
    expect(faixaDeLargura(1599)).toBe('normal');

    expect(faixaDeLargura(1600)).toBe('larga');
    expect(faixaDeLargura(2399)).toBe('larga');

    expect(faixaDeLargura(2400)).toBe('ultralarga');
    expect(faixaDeLargura(3840)).toBe('ultralarga');
  });
});
