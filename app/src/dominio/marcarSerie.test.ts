import { ajustarCargaVezes, ATRASO_DO_REPEAT_MS, checkHabilitado, INTERVALO_DO_REPEAT_MS, marcarSerie, repeticoesAoSegurar, valoresDaSerie, type EntradaDaMarcacao } from './marcarSerie';

const base: EntradaDaMarcacao = { feita: false, carga: null, repeticoes: null, sugestaoKg: null, sugestaoReps: null, semCampoDePeso: false };
const com = (extra: Partial<EntradaDaMarcacao>): EntradaDaMarcacao => ({ ...base, ...extra });

describe('✓ da série', () => {
  it('sem digitar usa a sugestão de carga e de repetições da progressão', () => {
    const e = com({ sugestaoKg: 90, sugestaoReps: 7 });
    expect(valoresDaSerie(e)).toEqual({ carga: 90, repeticoes: 7, cargaEhSugestao: true, repeticoesEhSugestao: true });
    expect(checkHabilitado(e)).toBe(true);
    expect(marcarSerie(e)).toEqual({ carga: 90, repeticoes: 7, concluida: true });
  });
  it('o digitado vale mais que a sugestão, campo a campo', () => {
    expect(marcarSerie(com({ sugestaoKg: 90, sugestaoReps: 7, carga: 92.5, repeticoes: 6 }))).toEqual({ carga: 92.5, repeticoes: 6, concluida: true });
    expect(marcarSerie(com({ sugestaoKg: 90, repeticoes: 6 }))).toEqual({ carga: 90, repeticoes: 6, concluida: true });
    expect(valoresDaSerie(com({ sugestaoKg: 90, carga: 80 })).cargaEhSugestao).toBe(false);
  });
  it('só habilita com kg e repetições; repetição nunca vem da meta, só do digitado ou da progressão', () => {
    expect(checkHabilitado(com({}))).toBe(false);
    expect(checkHabilitado(com({ sugestaoKg: 90 }))).toBe(false);
    expect(checkHabilitado(com({ repeticoes: 7 }))).toBe(false);
    expect(checkHabilitado(com({ carga: 80, repeticoes: 7 }))).toBe(true);
    expect(marcarSerie(com({ sugestaoKg: 90 }))).toBeNull();
  });
  it('carga digitada zero conta como carga', () => {
    expect(marcarSerie(com({ carga: 0, repeticoes: 10 }))).toEqual({ carga: 0, repeticoes: 10, concluida: true });
  });
  it('sem campo de peso só precisa das repetições e nunca grava carga', () => {
    expect(checkHabilitado(com({ semCampoDePeso: true }))).toBe(false);
    expect(marcarSerie(com({ semCampoDePeso: true, repeticoes: 12, sugestaoKg: 50, carga: 30 }))).toEqual({ carga: null, repeticoes: 12, concluida: true });
    expect(valoresDaSerie(com({ semCampoDePeso: true, sugestaoKg: 50 })).cargaEhSugestao).toBe(false);
  });
  it('texto inválido trava o ✓', () => {
    expect(checkHabilitado(com({ carga: 80, repeticoes: 7, invalido: true }))).toBe(false);
    expect(marcarSerie(com({ carga: 80, repeticoes: 7, invalido: true }))).toBeNull();
  });
  it('desmarcar sempre vale e mantém o gravado', () => {
    expect(checkHabilitado(com({ feita: true, invalido: true }))).toBe(true);
    expect(marcarSerie(com({ feita: true, carga: 90, repeticoes: 7, sugestaoKg: 95 }))).toEqual({ carga: 90, repeticoes: 7, concluida: false });
    expect(marcarSerie(com({ feita: true, carga: 90, repeticoes: 7, semCampoDePeso: true }))).toEqual({ carga: null, repeticoes: 7, concluida: false });
  });
});

describe('segurar − ou +', () => {
  it('não repete antes do atraso e depois dá um passo por intervalo', () => {
    expect(repeticoesAoSegurar(0)).toBe(0);
    expect(repeticoesAoSegurar(ATRASO_DO_REPEAT_MS - 1)).toBe(0);
    expect(repeticoesAoSegurar(ATRASO_DO_REPEAT_MS)).toBe(1);
    expect(repeticoesAoSegurar(ATRASO_DO_REPEAT_MS + INTERVALO_DO_REPEAT_MS * 3)).toBe(4);
  });
  it('anda de 0,5 kg em 0,5 kg a partir do vazio (sugestão ou zero) e nunca fica abaixo de zero', () => {
    expect(ajustarCargaVezes(null, 90, 0.5, 1, 1)).toBe(90.5);
    expect(ajustarCargaVezes(null, null, 0.5, 1, 3)).toBe(1.5);
    expect(ajustarCargaVezes(90, null, 0.5, -1, 4)).toBe(88);
    expect(ajustarCargaVezes(1, null, 0.5, -1, 10)).toBe(0);
  });
  it('em libra anda o passo da tela e devolve kg', () => {
    // 100 lb + 2 passos de 5 lb (o passo da tela de 2,5 kg) = 110 lb = 49,9 kg
    expect(ajustarCargaVezes(45.36, null, 2.5, 1, 2, 'lb')).toBeCloseTo(49.9, 1);
  });
});
