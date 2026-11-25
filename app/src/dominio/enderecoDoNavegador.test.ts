import { separarNumeroDaRua } from './enderecoDoNavegador';

const separa = (rua: string, numero = '') => separarNumeroDaRua(rua, numero);

describe('separarNumeroDaRua', () => {
  it.each([
    ['Rua Exemplo, 3420', 'Rua Exemplo', '3420'],
    ['Rua Exemplo,3420', 'Rua Exemplo', '3420'],
    ['  Rua Exemplo ,  3420  ', 'Rua Exemplo', '3420'],
    ['Rua Exemplo 3420', 'Rua Exemplo', '3420'],
    ['Avenida Dom Pedro Segundo 45', 'Avenida Dom Pedro Segundo', '45'],
    ['Rua Exemplo, nº 123', 'Rua Exemplo', '123'],
    ['Rua Exemplo, n° 123', 'Rua Exemplo', '123'],
    ['Rua Exemplo, n.º 123', 'Rua Exemplo', '123'],
    ['Rua Exemplo, no 123', 'Rua Exemplo', '123'],
    ['Rua Exemplo, numero 123', 'Rua Exemplo', '123'],
    ['Rua Exemplo, Número 123', 'Rua Exemplo', '123'],
    ['Rua Exemplo nº 123', 'Rua Exemplo', '123'],
    ['Rua Exemplo n°123', 'Rua Exemplo', '123'],
    ['Rua Exemplo No 123', 'Rua Exemplo', '123'],
    ['Rua Exemplo, s/n', 'Rua Exemplo', 's/n'],
    ['Rua Exemplo s/n', 'Rua Exemplo', 's/n'],
    ['Rua Exemplo, S/N', 'Rua Exemplo', 's/n'],
    ['Rua Exemplo, Bloco 2, 15', 'Rua Exemplo, Bloco 2', '15'],
    ['Rua 7 de Setembro, 100', 'Rua 7 de Setembro', '100'],
    ['Rua 7 de Setembro 100', 'Rua 7 de Setembro', '100'],
    ['Rua 7, 3', 'Rua 7', '3'],
  ])('"%s" vira rua "%s" e número "%s"', (entrada, rua, numero) => {
    expect(separa(entrada)).toEqual({ logradouro: rua, numero });
  });

  it.each([
    'Rua 7 de Setembro',
    'Avenida 9 de Julho',
    'Rua 15 de Novembro',
    'Rua Exemplo',
    'Rua 7',
    'Rua Exemplo 1234567',
    'Rodovia BR 277',
    'Rodovia PR 180',
    'Rodovia Exemplo km 12',
    'Rua Zeno',
    'Rua Exemplo, 123 - Sala 2',
    'Rua Exemplo, 123 casa',
    'Rua Exemplo, 1234567',
    '123',
    '',
    '   ',
  ])('"%s" fica como está', (entrada) => {
    expect(separa(entrada)).toEqual({ logradouro: entrada, numero: '' });
  });

  it('não troca o número que já foi digitado', () => {
    expect(separa('Rua Exemplo, 3420', '88')).toEqual({ logradouro: 'Rua Exemplo, 3420', numero: '88' });
    expect(separa('Rua Exemplo, 3420', ' 5 ')).toEqual({ logradouro: 'Rua Exemplo, 3420', numero: ' 5 ' });
  });
});
