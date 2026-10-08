import { caminhoSuave, marcasDoEixo } from './grafico';

describe('gráfico', () => {
  it('caminhoSuave liga todos os pontos com uma curva por trecho', () => {
    const d = caminhoSuave([{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 25 }, { x: 30, y: 25 }]);
    expect(d.startsWith('M0,0')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(3);
    expect(d.endsWith('30,25')).toBe(true);
  });

  it('caminhoSuave não ultrapassa os valores (sem excesso entre pontos)', () => {
    const d = caminhoSuave([{ x: 0, y: 10 }, { x: 10, y: 50 }, { x: 20, y: 52 }, { x: 30, y: 10 }]);
    const ys = [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[2]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(52.5);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(9.5);
  });

  it('casos pequenos', () => {
    expect(caminhoSuave([])).toBe('');
    expect(caminhoSuave([{ x: 1, y: 2 }])).toBe('M1,2');
    expect(caminhoSuave([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe('M1,2L3,4');
  });

  it('marcas do eixo ficam dentro da faixa', () => {
    const marcas = marcasDoEixo(81.2, 94.1);
    expect(marcas.every((v) => v >= 81.2 && v <= 94.1)).toBe(true);
  });
});
