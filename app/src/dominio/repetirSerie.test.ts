import { tecnicaVazia } from './editorTreino';
import type { Serie } from '../api/tipos';
import { mesmaPrescricao, repeticaoDaAnterior } from './repetirSerie';

const ws: Serie = { uid: 'a', tipo: 'WS', repsMin: 6, repsMax: 8, intensidade: { modo: 'CARGA_TRABALHO' } as Serie['intensidade'], descansoSegundos: 90 };
const fs = (percentualMin: number): Serie => ({ ...ws, uid: `f${percentualMin}`, tipo: 'FS', repsMin: 3, repsMax: 3, intensidade: { modo: 'PERCENTUAL_WS', percentualMin } as Serie['intensidade'] });

describe('repetir a série anterior', () => {
  it('só entre séries com a mesma prescrição', () => {
    expect(mesmaPrescricao(ws, { ...ws, uid: 'b' })).toBe(true);
    expect(mesmaPrescricao(fs(50), fs(70))).toBe(false);
    expect(mesmaPrescricao(fs(85), ws)).toBe(false);
    expect(mesmaPrescricao(ws, { ...ws, tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [4,4,4], pausaSegundos: 20 } })).toBe(false);
  });

  it('mostra os valores no rótulo e some sem nada registrado', () => {
    expect(repeticaoDaAnterior(ws, { ...ws, uid: 'b' }, { carga: 40, repeticoes: 6 }, false)).toEqual({ carga: 40, repeticoes: 6, rotulo: 'Repetir 40 kg × 6' });
    expect(repeticaoDaAnterior(ws, { ...ws, uid: 'b' }, { carga: 42.5, repeticoes: null }, false)?.rotulo).toBe('Repetir 42,5 kg');
    expect(repeticaoDaAnterior(ws, { ...ws, uid: 'b' }, { carga: 40, repeticoes: 12 }, true)).toEqual({ carga: null, repeticoes: 12, rotulo: 'Repetir 12 reps' });
    expect(repeticaoDaAnterior(ws, { ...ws, uid: 'b' }, { carga: null, repeticoes: null }, false)).toBeNull();
    expect(repeticaoDaAnterior(fs(85), ws, { carga: 40, repeticoes: 3 }, false)).toBeNull();
    expect(repeticaoDaAnterior(undefined, ws, { carga: 40, repeticoes: 3 }, false)).toBeNull();
  });
});
