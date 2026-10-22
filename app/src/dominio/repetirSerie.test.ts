import { carga, serie as serieDeTeste } from './exemplosDeTreino.apoioTeste';
import { tecnicaVazia } from './editorTreino';
import type { Serie } from '../api/tipos';
import { mesmaPrescricao, repeticaoDaAnterior } from './repetirSerie';

const ws: Serie = serieDeTeste('a', { tipo: 'WORKING', repsMin: 6, repsMax: 8, carga: carga('CARGA_TRABALHO'), descansoSegundos: 90 });
const fs = (percentualMin: number): Serie => ({ ...ws, uid: `f${percentualMin}`, tipo: 'FEEDER', repsMin: 3, repsMax: 3, carga: carga('PERCENTUAL_WS', percentualMin) });

describe('repetir a série anterior', () => {
  it('só entre séries com a mesma prescrição', () => {
    expect(mesmaPrescricao(ws, { ...ws, uid: 'b' })).toBe(true);
    expect(mesmaPrescricao(fs(50), fs(70))).toBe(false);
    expect(mesmaPrescricao(fs(85), ws)).toBe(false);
    expect(mesmaPrescricao(ws, { ...ws, tecnica: { ...tecnicaVazia('CLUSTER'), blocos: [4, 4, 4], pausaSegundos: 20 } })).toBe(false);
  });

  it('carga, esforço, AMRAP, cardio e alvo extra também contam', () => {
    expect(mesmaPrescricao(ws, { ...ws, uid: 'b', esforco: { rir: 1, rpe: null } })).toBe(false);
    expect(mesmaPrescricao(ws, { ...ws, uid: 'b', amrap: true })).toBe(false);
    expect(mesmaPrescricao(ws, { ...ws, uid: 'b', alvoExtra: 'Sem pausa' })).toBe(false);
    expect(mesmaPrescricao(ws, { ...ws, uid: 'b', cardio: { duracaoMin: 10 } })).toBe(false);
  });

  it('carga nula, ausente e NENHUMA vazia são a mesma coisa; campo nulo é igual a ausente', () => {
    const semCarga = { ...ws, carga: null };
    expect(mesmaPrescricao(semCarga, { ...ws, carga: carga('NENHUMA') })).toBe(true);
    expect(mesmaPrescricao(semCarga, { ...semCarga, uid: 'z', esforco: null, tecnica: null })).toBe(true);
  });

  it('back off apontando para a mesma referência é a mesma prescrição; para outra, não', () => {
    const b = (uid: string, ref: string): Serie => ({ ...ws, uid, tipo: 'BACK_OFF', carga: carga('ABAIXO_DA_REFERENCIA', 15, null, ref) });
    expect(mesmaPrescricao(b('x', 't'), b('y', 't'))).toBe(true);
    expect(mesmaPrescricao(b('x', 't'), b('y', 'u'))).toBe(false);
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
