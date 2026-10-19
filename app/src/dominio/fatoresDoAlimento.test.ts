import { erroDoFatorCoccao, erroDoFatorCorrecao, textoDosFatores } from './fatoresDoAlimento';

describe('fatoresDoAlimento', () => {
  it('vazio é válido (não informado); fora da faixa ou com mais de duas casas, não', () => {
    expect(erroDoFatorCorrecao(null)).toBeNull();
    expect(erroDoFatorCorrecao(1)).toBeNull();
    expect(erroDoFatorCorrecao(20)).toBeNull();
    expect(erroDoFatorCorrecao(1.75)).toBeNull();
    expect(erroDoFatorCorrecao(0.99)).toBe('Use um valor de 1 a 20.');
    expect(erroDoFatorCorrecao(20.01)).toBe('Use um valor de 1 a 20.');
    expect(erroDoFatorCorrecao(1.234)).toBe('Use no máximo duas casas decimais.');
    expect(erroDoFatorCoccao(0.1)).toBeNull();
    expect(erroDoFatorCoccao(10)).toBeNull();
    expect(erroDoFatorCoccao(0.09)).toBe('Use um valor de 0,1 a 10.');
    expect(erroDoFatorCoccao(10.5)).toBe('Use um valor de 0,1 a 10.');
  });

  it('texto curto só com o que foi informado', () => {
    expect(textoDosFatores({ fatorCorrecao: 1.75, fatorCoccao: 2.5 })).toBe('FC 1,75 · FCc 2,5');
    expect(textoDosFatores({ fatorCorrecao: null, fatorCoccao: 0.7 })).toBe('FCc 0,7');
    expect(textoDosFatores({ fatorCorrecao: null, fatorCoccao: null })).toBeNull();
  });
});
