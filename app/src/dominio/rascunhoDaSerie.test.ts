import { aplicarRascunho, chaveDoRascunhoDaSerie, podarRascunhos, rascunhoDaSerie, type ReferenciaDaSerie } from './rascunhoDaSerie';

const ref: ReferenciaDaSerie = { planoVersaoId: 'v1', exercicioUid: 'e1', exercicioId: 'x1', serieUid: 's1', data: '2026-11-25' };
const chave = chaveDoRascunhoDaSerie(ref);

describe('chave do rascunho', () => {
  it('muda com data, versão, exercício do dia e série', () => {
    const outras = [{ data: '2026-11-24' }, { planoVersaoId: 'v2' }, { exercicioUid: 'e2' }, { exercicioId: 'x2' }, { exercicioId: null }, { serieUid: 's2' }];
    for (const o of outras) expect(chaveDoRascunhoDaSerie({ ...ref, ...o })).not.toBe(chave);
  });
});

describe('aplicarRascunho', () => {
  it('guarda o que foi digitado e junta com o que já havia', () => {
    const a = aplicarRascunho({}, chave, { carga: 90 }, '2026-11-25');
    expect(a[chave]).toEqual({ carga: 90, repeticoes: null, dia: '2026-11-25' });
    const b = aplicarRascunho(a, chave, { repeticoes: 7 }, '2026-11-25');
    expect(b[chave]).toEqual({ carga: 90, repeticoes: 7, dia: '2026-11-25' });
    expect(a[chave]!.repeticoes).toBeNull();
  });
  it('apaga quando os dois campos ficam vazios ou quando a mudança é nula', () => {
    const a = aplicarRascunho({}, chave, { carga: 90, repeticoes: 7 }, '2026-11-25');
    expect(aplicarRascunho(a, chave, { carga: null, repeticoes: null }, '2026-11-25')).toEqual({});
    expect(aplicarRascunho(aplicarRascunho(a, chave, { carga: null }, '2026-11-25'), chave, { repeticoes: null }, '2026-11-25')).toEqual({});
    expect(aplicarRascunho(a, chave, null, '2026-11-25')).toEqual({});
  });
  it('não mexe nas outras séries', () => {
    const outra = chaveDoRascunhoDaSerie({ ...ref, serieUid: 's2' });
    const a = aplicarRascunho(aplicarRascunho({}, outra, { carga: 50 }, '2026-11-25'), chave, { carga: 90 }, '2026-11-25');
    expect(Object.keys(a).sort()).toEqual([chave, outra].sort());
    expect(Object.keys(aplicarRascunho(a, chave, null, '2026-11-25'))).toEqual([outra]);
  });
  it('atualiza o dia da digitação', () => {
    const a = aplicarRascunho({ [chave]: { carga: 90, repeticoes: null, dia: '2026-11-24' } }, chave, { repeticoes: 7 }, '2026-11-25');
    expect(a[chave]!.dia).toBe('2026-11-25');
  });
});

describe('podarRascunhos', () => {
  it('tira o digitado em dia anterior e fica com o de hoje, mesmo de treino em data passada', () => {
    const antigo = chaveDoRascunhoDaSerie({ ...ref, serieUid: 's2' });
    const deOntemDigitadoHoje = chaveDoRascunhoDaSerie({ ...ref, data: '2026-11-24', serieUid: 's3' });
    const mapa = {
      [chave]: { carga: 90, repeticoes: 7, dia: '2026-11-25' },
      [antigo]: { carga: 50, repeticoes: 8, dia: '2026-11-24' },
      [deOntemDigitadoHoje]: { carga: 60, repeticoes: null, dia: '2026-11-25' },
    };
    expect(Object.keys(podarRascunhos(mapa, '2026-11-25')).sort()).toEqual([chave, deOntemDigitadoHoje].sort());
  });
  it('descarta entrada ilegível ou vazia sem quebrar', () => {
    expect(podarRascunhos(null, '2026-11-25')).toEqual({});
    expect(podarRascunhos('x', '2026-11-25')).toEqual({});
    const mapa = { a: null, b: { carga: 'x', repeticoes: 1, dia: '2026-11-25' }, c: { carga: null, repeticoes: null, dia: '2026-11-25' }, d: { carga: -1, repeticoes: 1, dia: '2026-11-25' }, e: { carga: 10, repeticoes: 2 } };
    expect(podarRascunhos(mapa, '2026-11-25')).toEqual({});
  });
});

describe('rascunhoDaSerie', () => {
  it('devolve só carga e repetições, ou nulo sem nada digitado', () => {
    const mapa = aplicarRascunho({}, chave, { carga: 90, repeticoes: 7 }, '2026-11-25');
    expect(rascunhoDaSerie(mapa, ref)).toEqual({ carga: 90, repeticoes: 7 });
    expect(rascunhoDaSerie(mapa, { ...ref, serieUid: 's9' })).toBeNull();
  });
});
