import { descricaoDosFatores, erroDoFatorCoccao, erroDoFatorCorrecao, estimarFatoresDoAlimento, previaDeConversao, textoDosFatores } from './fatoresDoAlimento';

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

  it('estima pelo nome, pelo grupo e pela caloria do arroz', () => {
    expect(estimarFatoresDoAlimento('Peito de frango grelhado', 'Carnes e derivados', 159, 100, 'g')).toMatchObject({ fatorCorrecao: 1.12, fatorCoccao: 0.78 });
    expect(estimarFatoresDoAlimento('Arroz branco', 'Cereais e derivados', 128, 100, 'g')).toMatchObject({ fatorCorrecao: 1, fatorCoccao: 2.6 });
    expect(estimarFatoresDoAlimento('Arroz branco', 'Cereais e derivados', 358, 100, 'g')).toMatchObject({ fatorCoccao: 1 });
    expect(estimarFatoresDoAlimento('Feijão carioca', null, 76, 100, 'g')).toMatchObject({ fatorCoccao: 1.85 });
    expect(estimarFatoresDoAlimento('Banana prata', 'Frutas e derivados')).toMatchObject({ fatorCorrecao: 1.45, fatorCoccao: 1 });
    expect(estimarFatoresDoAlimento('Aveia em flocos')).toMatchObject({ fatorCorrecao: 1, fatorCoccao: 1 });
    expect(estimarFatoresDoAlimento('Ovo mexido')).toMatchObject({ fatorCoccao: 0.9 });
    expect(estimarFatoresDoAlimento('Batata inglesa cozida')).toMatchObject({ fatorCorrecao: 1.25, fatorCoccao: 0.95 });
  });

  it('descreve peso direto ou a compra de 100 g', () => {
    expect(descricaoDosFatores({ grupo: 'Cereais e derivados', fatorCorrecao: 1, fatorCoccao: 1 })).toBe('Cereais e derivados · Peso direto (sem perda na limpeza/cocção)');
    expect(descricaoDosFatores({ grupo: 'Carnes e derivados', fatorCorrecao: 1.12, fatorCoccao: 0.78 })).toContain('100 g na dieta');
    expect(previaDeConversao(1.12, 0.78)).toContain('cru limpo');
    expect(previaDeConversao(1.12, 0.78)).toContain('kg a comprar');
  });
});
