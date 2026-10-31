import { textoDaFaixa, textoDosPercentuais } from './percentuais';

describe('textoDaFaixa', () => {
  it('põe o % em cada ponta da faixa', () => {
    expect(textoDaFaixa(85, 90)).toBe('85% a 90%');
  });

  it('escreve um valor só quando não há máximo ou ele é igual ao mínimo', () => {
    expect(textoDaFaixa(70, null)).toBe('70%');
    expect(textoDaFaixa(70, undefined)).toBe('70%');
    expect(textoDaFaixa(70, 70)).toBe('70%');
  });

  it('mantém a vírgula brasileira nos decimais', () => {
    expect(textoDaFaixa(2.5, 5)).toBe('2,5% a 5%');
  });

  it('usa "—" sem mínimo', () => {
    expect(textoDaFaixa(null, 90)).toBe('—');
    expect(textoDaFaixa(undefined, undefined)).toBe('—');
  });
});

describe('textoDosPercentuais', () => {
  it('separa as séries por " · " na ordem', () => {
    expect(textoDosPercentuais([{ min: 50 }, { min: 70 }, { min: 85, max: 90 }])).toBe('50% · 70% · 85% a 90%');
  });

  it('escreve uma vez só quando todas as séries têm a mesma faixa', () => {
    expect(textoDosPercentuais([{ min: 85, max: 90 }, { min: 85, max: 90 }, { min: 85, max: 90 }])).toBe('85% a 90%');
  });

  it('não junta faixas diferentes só porque o mínimo é igual', () => {
    expect(textoDosPercentuais([{ min: 85 }, { min: 85, max: 90 }])).toBe('85% · 85% a 90%');
  });

  it('devolve "—" sem séries', () => {
    expect(textoDosPercentuais([])).toBe('—');
  });
});
