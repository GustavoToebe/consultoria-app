import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { exercicio, serie, sessao } from './exemplosDeTreino.apoioTeste';
import { contagemDeSeries } from './conclusaoDoTreino';
import { serieContaNaContagem, seriesDaContagem, totalDeSeries, totalDoExercicio } from './semana';

// 2 aquecimentos + 1 preparação + 4 de trabalho (2 WORKING, 1 TOP_SET, 1 BACK_OFF) em dois exercícios.
const a = exercicio('a', {
  series: [serie('a1', { tipo: 'WARM_UP' }), serie('a2', { tipo: 'WARM_UP' }), serie('a3', { tipo: 'FEEDER' }), serie('a4', { tipo: 'WORKING' }), serie('a5', { tipo: 'WORKING' })],
});
const b = exercicio('b', { series: [serie('b1', { tipo: 'TOP_SET' }), serie('b2', { tipo: 'BACK_OFF' })] });
const treino = sessao('s', [a, b]);

describe('contagem "x de y séries" só com trabalho e pós-trabalho (D6)', () => {
  it('aquecimentos e preparação ficam fora: conta "x de 4"', () => {
    expect(totalDeSeries(treino, CONFIGURACAO_PADRAO)).toBe(4);
    expect(totalDoExercicio(a, CONFIGURACAO_PADRAO)).toBe(2);
    expect(seriesDaContagem(a, CONFIGURACAO_PADRAO).map((s) => s.uid)).toEqual(['a4', 'a5']);
  });

  it('sem metodologia, tipo desconhecido ou sem tipo (cardio) a série conta: nada é escondido por palpite', () => {
    expect(totalDeSeries(treino)).toBe(7);
    expect(serieContaNaContagem(serie('x', { tipo: 'INVENTADO' }), CONFIGURACAO_PADRAO)).toBe(true);
    expect(serieContaNaContagem(serie('x', { tipo: null }), CONFIGURACAO_PADRAO)).toBe(true);
  });

  it('as séries feitas também só contam as de trabalho', () => {
    const feitas = new Set(['a1', 'a2', 'a4', 'b2']);
    expect(contagemDeSeries(treino, (uid) => feitas.has(uid), CONFIGURACAO_PADRAO)).toEqual({ total: 4, feitas: 2 });
    // Sem a metodologia, como antes.
    expect(contagemDeSeries(treino, (uid) => feitas.has(uid))).toEqual({ total: 7, feitas: 4 });
  });

  it('todas as de trabalho feitas completam, mesmo sem aquecimento marcado', () => {
    const feitas = new Set(['a4', 'a5', 'b1', 'b2']);
    expect(contagemDeSeries(treino, (uid) => feitas.has(uid), CONFIGURACAO_PADRAO)).toEqual({ total: 4, feitas: 4 });
  });
});
