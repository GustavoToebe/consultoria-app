import { centavosDaTela, centavosParaCampo, centavosParaTela, mascaraDeNumero, moedaParaTela } from './formatos';

describe('moeda em reais', () => {
  it('usa vírgula, ponto de milhar e duas casas', () => {
    expect(moedaParaTela(150)).toBe('R$ 150,00');
    expect(moedaParaTela(1234.5)).toBe('R$ 1.234,50');
    expect(moedaParaTela(1234567.891)).toBe('R$ 1.234.567,89');
    expect(moedaParaTela(0)).toBe('R$ 0,00');
  });
  it('ausência é "—", não zero', () => {
    expect(moedaParaTela(null)).toBe('—');
    expect(moedaParaTela(undefined)).toBe('—');
  });
});

describe('centavos para a tela', () => {
  it('mostra reais e centavos sem ponto flutuante', () => {
    expect(centavosParaTela(12345)).toBe('R$ 123,45');
    expect(centavosParaTela(5)).toBe('R$ 0,05');
    expect(centavosParaTela(100)).toBe('R$ 1,00');
    expect(centavosParaTela(123456789)).toBe('R$ 1.234.567,89');
    expect(centavosParaTela(0)).toBe('R$ 0,00');
    expect(centavosParaTela(-1050)).toBe('-R$ 10,50');
  });
  it('nulo é "—" (sem dado nunca vira R$ 0,00)', () => {
    expect(centavosParaTela(null)).toBe('—');
    expect(centavosParaTela(undefined)).toBe('—');
    expect(centavosParaTela(Number.NaN)).toBe('—');
  });
  it('o campo de edição mostra só reais e vírgula', () => {
    expect(centavosParaCampo(12345)).toBe('123,45');
    expect(centavosParaCampo(9000)).toBe('90,00');
    expect(centavosParaCampo(null)).toBe('');
  });
});

describe('centavos da tela', () => {
  it('lê reais com vírgula, milhar e prefixo', () => {
    expect(centavosDaTela('150')).toBe(15000);
    expect(centavosDaTela('150,5')).toBe(15050);
    expect(centavosDaTela('1.234,50')).toBe(123450);
    expect(centavosDaTela('R$ 99,90')).toBe(9990);
    expect(centavosDaTela('0,01')).toBe(1);
    expect(centavosDaTela(' 12.500 ')).toBe(1250000);
  });
  it('aceita ponto como decimal só com uma ou duas casas', () => {
    expect(centavosDaTela('12.50')).toBe(1250);
    expect(centavosDaTela('1.5')).toBe(150);
  });
  it('não erra em valores que o ponto flutuante arredondaria mal', () => {
    expect(centavosDaTela('0,29')).toBe(29);
    expect(centavosDaTela('1.234.567,89')).toBe(123456789);
    expect(centavosDaTela('19,99')).toBe(1999);
  });
  it('vazio, zero, negativo, mais de duas casas e lixo são inválidos', () => {
    for (const t of ['', '  ', '0', '0,00', '-5', '10,555', '12,', ',50', 'abc', '1,2,3', '1..000', '99999999999']) {
      expect(centavosDaTela(t)).toBeNull();
    }
  });
  it('ida e volta com o campo de edição', () => {
    for (const c of [1, 99, 100, 15050, 123456789]) {
      expect(centavosDaTela(centavosParaCampo(c))).toBe(c);
    }
  });
});

describe('máscara de número enquanto digita', () => {
  it('altura em metros: os algarismos viram "1,75"', () => {
    const m = { emMetros: true };
    expect(mascaraDeNumero('1', 2, m)).toBe('1');
    expect(mascaraDeNumero('17', 2, m)).toBe('1,7');
    expect(mascaraDeNumero('175', 2, m)).toBe('1,75');
    expect(mascaraDeNumero('1759', 2, m)).toBe('1,75');
    expect(mascaraDeNumero('1,75', 2, m)).toBe('1,75');
    expect(mascaraDeNumero('1.75', 2, m)).toBe('1,75');
    expect(mascaraDeNumero('abc', 2, m)).toBe('');
  });
  it('sinal de menos só com `negativo` e só no começo', () => {
    expect(mascaraDeNumero('-2', 0)).toBe('2');
    expect(mascaraDeNumero('-2', 0, { negativo: true })).toBe('-2');
    expect(mascaraDeNumero('-', 1, { negativo: true })).toBe('-');
    expect(mascaraDeNumero('-2.55', 1, { negativo: true })).toBe('-2,5');
    expect(mascaraDeNumero('2-3', 0, { negativo: true })).toBe('23');
    expect(mascaraDeNumero('-175', 2, { negativo: true, emMetros: true })).toBe('-1,75');
  });
  it('decimal comum: vírgula única e no máximo as casas pedidas', () => {
    expect(mascaraDeNumero('72.55', 1)).toBe('72,5');
    expect(mascaraDeNumero('8,', 2)).toBe('8,');
    expect(mascaraDeNumero('1,2,3', 2)).toBe('1,23');
    expect(mascaraDeNumero('7a2', 2)).toBe('72');
  });
  it('sem casas: só a parte inteira, nunca juntando os dígitos depois da vírgula', () => {
    expect(mascaraDeNumero('12,5', 0)).toBe('12');
    expect(mascaraDeNumero('2.5', 0)).toBe('2');
    expect(mascaraDeNumero('x', 0)).toBe('');
  });
});
