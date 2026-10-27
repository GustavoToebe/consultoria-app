import type { EtapaRegistrada, SerieFeita } from '../api/tipos';
import { textoDoVolume, textoSerie, volumeDoExercicio } from './relatorio';

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

const feitaEm = (posicao: number, repeticoes: number | null, carga: number | null): EtapaRegistrada => ({ posicao, repeticoes, carga, situacao: 'FEITA' });
const naoFeita = (posicao: number): EtapaRegistrada => ({ posicao, repeticoes: null, carga: null, situacao: 'NAO_REALIZADA' });

describe('série registrada por etapa no histórico', () => {
  it('carga comum: as repetições de cada bloco e o total do servidor', () => {
    const etapas = [feitaEm(1, 4, 40), feitaEm(2, 4, 40), feitaEm(3, 4, 40), feitaEm(4, 2, 40)];
    expect(textoSerie(feita({ etapas, carga: 40, repeticoes: 14 }))).toBe('WS 40 kg × 4+4+4+2 = 14');
  });

  it('carga variável: carga e repetições de cada etapa, sem inventar uma carga única', () => {
    const etapas = [feitaEm(1, 4, 40), feitaEm(2, 4, 42.5)];
    expect(textoSerie(feita({ etapas, carga: null, repeticoes: 8 }))).toBe('WS 40 kg × 4 + 42,5 kg × 4 = 8');
  });

  it('parcial (sem total do servidor) e etapa não feita ficam escritos, nunca somados como total', () => {
    expect(textoSerie(feita({ etapas: [feitaEm(1, 4, 40), feitaEm(2, 4, 40)], carga: 40, repeticoes: null }))).toBe('WS 40 kg × 4+4 (parcial)');
    expect(textoSerie(feita({ etapas: [feitaEm(1, 6, 40), naoFeita(2)], carga: 40, repeticoes: 6 }))).toBe('WS 40 kg × 6 (1 etapa não feita)');
    expect(textoSerie(feita({ etapas: [naoFeita(1), naoFeita(2)], carga: null, repeticoes: null }))).toBe('WS não feita (parcial, 2 etapas não feitas)');
    expect(textoSerie(feita({ etapas: [], carga: null, repeticoes: null, concluida: false }))).toBe('WS — (parcial)');
  });

  it('repetição que faltou numa etapa feita aparece como "—"; exercício sem carga mostra só as repetições', () => {
    expect(textoSerie(feita({ etapas: [feitaEm(1, 4, 40), feitaEm(2, null, 40)], carga: 40, repeticoes: null }))).toBe('WS 40 kg × 4+— (parcial)');
    expect(textoSerie(feita({ unidade: 'nenhuma', etapas: [feitaEm(1, 5, null), feitaEm(2, 3, null)], carga: null, repeticoes: 8 }))).toBe('WS 5+3 = 8');
  });
});

describe('volume de carga do exercício', () => {
  it('soma carga × repetições etapa por etapa e das séries inteiras concluídas', () => {
    const series = [
      feita({ carga: 50, repeticoes: 6 }),
      feita({ etapas: [feitaEm(1, 4, 40), feitaEm(2, 4, 42.5), naoFeita(3)], carga: null, repeticoes: 8 }),
    ];
    expect(volumeDoExercicio(series)).toEqual({ valor: 300 + 160 + 170, completo: true });
    expect(textoDoVolume(volumeDoExercicio(series))).toBe('Volume de carga: 630 kg');
  });

  it('série não concluída não entra; faltou carga numa parte feita = subtotal rotulado', () => {
    const series = [feita({ carga: 50, repeticoes: 6 }), feita({ carga: null, repeticoes: 6 }), feita({ concluida: false, carga: 80, repeticoes: 1 })];
    expect(volumeDoExercicio(series)).toEqual({ valor: 300, completo: false });
    expect(textoDoVolume(volumeDoExercicio(series))).toBe('Volume de carga: subtotal de 300 kg (faltou carga ou repetição)');
  });

  it('exercício sem carga ou sem nada feito não tem volume (nunca zero)', () => {
    expect(volumeDoExercicio([feita({ unidade: 'nenhuma', carga: null, repeticoes: 12 })])).toBeNull();
    expect(volumeDoExercicio([feita({ concluida: false })])).toBeNull();
    expect(textoDoVolume(null)).toBeNull();
  });
});
