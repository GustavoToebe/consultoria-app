import type { SerieFeita } from '../api/tipos';
import { textoSerie } from './relatorio';

const feita = (extra: Partial<SerieFeita>): SerieFeita => ({
  id: 'r', serieUid: 's', tipo: 'WS', trabalho: true, carga: 32, unidade: 'kg', repeticoes: 5, concluida: true, observacao: null, ...extra,
});

describe('texto da série no histórico', () => {
  it('carga e repetições; o que falta é "—"', () => {
    expect(textoSerie(feita({}))).toBe('WS 32 kg × 5');
    expect(textoSerie(feita({ carga: null, repeticoes: null }))).toBe('WS — kg × —');
    expect(textoSerie(feita({ unidade: 'nenhuma', repeticoes: 12, carga: null }))).toBe('WS 12');
  });

  it('cardio (sem carga nem repetições) sai "feito" ou "—", nunca "null"', () => {
    expect(textoSerie(feita({ tipo: 'Cardio', unidade: 'nenhuma', carga: null, repeticoes: null, trabalho: false }))).toBe('Cardio feito');
    expect(textoSerie(feita({ tipo: 'Cardio', unidade: 'nenhuma', carga: null, repeticoes: null, concluida: false }))).toBe('Cardio —');
    expect(textoSerie(feita({ tipo: null as unknown as string, unidade: 'nenhuma', carga: null, repeticoes: null }))).toBe('Série feito');
  });
});
