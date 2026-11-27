import { barrasDaAgua, litrosDaBarra } from './graficoDaAgua';

const dias = [
  { data: '2026-11-21', aguaMl: null },
  { data: '2026-11-22', aguaMl: 0 },
  { data: '2026-11-23', aguaMl: 250 },
  { data: '2026-11-24', aguaMl: 5000 },
  { data: '2026-11-25', aguaMl: 750 },
  { data: '2026-11-26', aguaMl: 6000 },
  { data: '2026-11-27', aguaMl: null },
];

describe('gráfico da água', () => {
  it('litros com uma casa, vírgula e "L"', () => {
    expect(litrosDaBarra(750)).toBe('0,8 L');
    expect(litrosDaBarra(5000)).toBe('5,0 L');
    expect(litrosDaBarra(1750)).toBe('1,8 L');
    expect(litrosDaBarra(0)).toBe('0,0 L');
  });

  it('com meta: escala no maior entre a meta e o maior registro, linha e rótulo da meta', () => {
    const g = barrasDaAgua(dias, '2026-11-27', 5);
    expect(g.rotuloDaMeta).toBe('Meta 5,0 L');
    expect(g.metaFracao).toBeCloseTo(5000 / 6000);
    expect(g.barras.map((b) => b.fracao)).toEqual([null, 0, 250 / 6000, 5000 / 6000, 750 / 6000, 1, null]);
  });

  it('valor só com registro; o ✓ só quando chegou à meta', () => {
    const g = barrasDaAgua(dias, '2026-11-27', 5);
    expect(g.barras.map((b) => b.valor)).toEqual([null, '0,0 L', '0,3 L', '5,0 L', '0,8 L', '6,0 L', null]);
    expect(g.barras.map((b) => b.bateuMeta)).toEqual([false, false, false, true, false, true, false]);
  });

  it('texto da dica e do leitor de tela, com os copos', () => {
    const g = barrasDaAgua(dias, '2026-11-27', 5);
    expect(g.barras.map((b) => b.texto)).toEqual([
      '21/11 · sem registro',
      '22/11 · 0,0 L de 5,0 L (nenhum copo)',
      '23/11 · 0,3 L de 5,0 L (1 copo)',
      '24/11 · 5,0 L de 5,0 L (20 copos)',
      '25/11 · 0,8 L de 5,0 L (3 copos)',
      '26/11 · 6,0 L de 5,0 L (24 copos)',
      '27/11 · sem registro',
    ]);
  });

  it('"Hoje" só no último dia', () => {
    const g = barrasDaAgua(dias, '2026-11-27', 5);
    expect(g.barras.map((b) => b.rotulo)).toEqual(['21/11', '22/11', '23/11', '24/11', '25/11', '26/11', 'Hoje']);
    expect(g.barras.filter((b) => b.hoje).map((b) => b.data)).toEqual(['2026-11-27']);
  });

  it('sem meta: sem linha, sem ✓, a escala é o maior registro e o texto não fala de meta', () => {
    const g = barrasDaAgua(dias, '2026-11-27', null);
    expect(g.metaFracao).toBeNull();
    expect(g.rotuloDaMeta).toBeNull();
    expect(g.barras.some((b) => b.bateuMeta)).toBe(false);
    expect(g.barras[5].fracao).toBe(1);
    expect(g.barras[4].texto).toBe('25/11 · 0,8 L (3 copos)');
  });

  it('meta com duas casas aparece inteira; tudo zero não divide por zero', () => {
    expect(barrasDaAgua(dias, '2026-11-27', 2.25).rotuloDaMeta).toBe('Meta 2,25 L');
    const zeros = barrasDaAgua([{ data: '2026-11-27', aguaMl: 0 }], '2026-11-27', null);
    expect(zeros.barras[0].fracao).toBe(0);
    expect(zeros.barras[0].bateuMeta).toBe(false);
  });
});
