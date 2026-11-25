import { ajusteDoRodape } from './ancoraDoRodape';

describe('ajusteDoRodape', () => {
  it('só o status cresceu: a folha sobe metade, o pé fica no lugar', () => {
    expect(ajusteDoRodape({ ajuste: 0, deltaRodape: 48, deltaPainel: 48, folga: 400 })).toBe(-24);
  });

  it('o status some: volta ao centro', () => {
    expect(ajusteDoRodape({ ajuste: -24, deltaRodape: -48, deltaPainel: -48, folga: 448 })).toBe(0);
  });

  it('no teto de 90% a folha não cresce: nada a compensar', () => {
    expect(ajusteDoRodape({ ajuste: 0, deltaRodape: 48, deltaPainel: 0, folga: 0 })).toBe(0);
  });

  it('corpo e rodapé mudaram juntos: só a parte do rodapé é compensada', () => {
    expect(ajusteDoRodape({ ajuste: 0, deltaRodape: 20, deltaPainel: 300, folga: 400 })).toBe(-10);
  });

  it('sinais opostos não mexem', () => {
    expect(ajusteDoRodape({ ajuste: -10, deltaRodape: 20, deltaPainel: -100, folga: 400 })).toBe(-10);
  });

  it('sem mudança, só confere o limite: a folha não sai da área', () => {
    expect(ajusteDoRodape({ ajuste: -30, deltaRodape: 0, deltaPainel: 0, folga: 40 })).toBe(-20);
    expect(ajusteDoRodape({ ajuste: -30, deltaRodape: 0, deltaPainel: 0, folga: -10 })).toBe(0);
  });
});
