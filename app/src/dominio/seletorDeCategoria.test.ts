import { categoriaDoDigitado, limparNomeDaCategoria } from './seletorDeCategoria';

const CATS = [{ id: 'a', nome: 'Injetáveis' }, { id: 'b', nome: 'Medicamentos' }, { id: 'c', nome: 'Orais de teste' }];

describe('categoriaDoDigitado', () => {
  it('texto igual a uma existente (sem acento, caixa nem espaços sobrando) escolhe a existente, com a grafia dela', () => {
    expect(categoriaDoDigitado('injetaveis', CATS)).toEqual({ existente: CATS[0] });
    expect(categoriaDoDigitado('  MEDICAMENTOS ', CATS)).toEqual({ existente: CATS[1] });
    expect(categoriaDoDigitado('Orais  de   teste', CATS)).toEqual({ existente: CATS[2] });
  });

  it('pedaço do nome não é a existente: oferece criar com o texto limpo', () => {
    expect(categoriaDoDigitado('Inje', CATS)).toEqual({ nova: 'Inje' });
    expect(categoriaDoDigitado('  Orais  novos ', CATS)).toEqual({ nova: 'Orais novos' });
    expect(categoriaDoDigitado('Nova', [])).toEqual({ nova: 'Nova' });
  });

  it('vazio ou só espaços não oferece nada', () => {
    expect(categoriaDoDigitado('', CATS)).toBeNull();
    expect(categoriaDoDigitado('   ', CATS)).toBeNull();
  });
});

describe('limparNomeDaCategoria', () => {
  it('tira os espaços das pontas e junta os do meio', () => {
    expect(limparNomeDaCategoria('  Roupas   infantis ')).toBe('Roupas infantis');
  });
});
