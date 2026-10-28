import { LADO_MAXIMO_DA_LOGO, reducaoDaLogo } from './logoDoPdf';

/** Medidas da logo depois da redução pedida (o lado que não vem na ação acompanha a proporção). */
function depois(largura: number, altura: number) {
  const acao = reducaoDaLogo(largura, altura);
  if (!acao) return { largura, altura };
  if ('width' in acao) return { largura: acao.width, altura: (altura * acao.width) / largura };
  return { largura: (largura * acao.height) / altura, altura: acao.height };
}

describe('redução da logo para o PDF', () => {
  it('o maior lado é 800 px', () => {
    expect(LADO_MAXIMO_DA_LOGO).toBe(800);
  });

  it('reduz a logo larga pelo comprimento e a alta pela altura', () => {
    expect(reducaoDaLogo(2048, 1024)).toEqual({ width: 800 });
    expect(reducaoDaLogo(1024, 2048)).toEqual({ height: 800 });
    expect(reducaoDaLogo(2048, 2048)).toEqual({ width: 800 });
  });

  it('nunca amplia: o que já cabe fica como está', () => {
    expect(reducaoDaLogo(800, 400)).toBeNull();
    expect(reducaoDaLogo(300, 120)).toBeNull();
    expect(reducaoDaLogo(1, 1)).toBeNull();
  });

  it('mantém a proporção e deixa o maior lado em no máximo 800', () => {
    for (const [l, a] of [[2048, 1024], [2048, 700], [801, 10], [1000, 999], [500, 2048], [2048, 2048]]) {
      const r = depois(l, a);
      expect(Math.max(r.largura, r.altura)).toBeLessThanOrEqual(LADO_MAXIMO_DA_LOGO);
      expect(r.largura / r.altura).toBeCloseTo(l / a, 6);
    }
  });

  it('tamanho desconhecido ou inválido não vira redução', () => {
    expect(reducaoDaLogo(0, 0)).toBeNull();
    expect(reducaoDaLogo(NaN, 100)).toBeNull();
    expect(reducaoDaLogo(-5, 3000)).toBeNull();
  });
});
