import { exercicio, grupo, serie, sessao } from '../dominio/exemplosDeTreino.apoioTeste';
import { descansoAoMarcar } from './descansoDoGrupo';

/** Superset A + B (A com 2 séries, B com 2) e um exercício solto C, com descanso do grupo de 90 s e por série de 60 s. */
const comSuperset = () =>
  sessao(
    's',
    [
      exercicio('A', { grupoUid: 'g', series: [serie('A1', { descansoSegundos: 60 }), serie('A2', { descansoSegundos: 60 })] }),
      exercicio('B', { grupoUid: 'g', series: [serie('B1', { descansoSegundos: 60 }), serie('B2', { descansoSegundos: 60 })] }),
      exercicio('C', { series: [serie('C1', { descansoSegundos: 45 }), serie('C2')] }),
    ],
    [grupo('g', 'SUPERSET', { descansoAposSegundos: 90 })],
  );

const feitas = (...uids: string[]) => (uid: string) => uids.includes(uid);

describe('descanso ao marcar uma série', () => {
  it('exercício solto usa o descanso da própria série; sem descanso, nenhum', () => {
    const s = comSuperset();
    expect(descansoAoMarcar({ sessao: s, exercicioUid: 'C', serieUid: 'C1', concluida: feitas() })).toBe(45);
    expect(descansoAoMarcar({ sessao: s, exercicioUid: 'C', serieUid: 'C2', concluida: feitas() })).toBeNull();
  });

  it('superset: a primeira série do par não inicia descanso (falta o outro exercício)', () => {
    expect(descansoAoMarcar({ sessao: comSuperset(), exercicioUid: 'A', serieUid: 'A1', concluida: feitas() })).toBeNull();
  });

  it('superset: fechar a volta inicia o descanso do grupo e não o da série', () => {
    expect(descansoAoMarcar({ sessao: comSuperset(), exercicioUid: 'B', serieUid: 'B1', concluida: feitas('A1') })).toBe(90);
  });

  it('superset: fechar a volta vale em qualquer ordem de marcação', () => {
    expect(descansoAoMarcar({ sessao: comSuperset(), exercicioUid: 'A', serieUid: 'A1', concluida: feitas('B1') })).toBe(90);
  });

  it('superset: a segunda volta é independente da primeira', () => {
    const s = comSuperset();
    expect(descansoAoMarcar({ sessao: s, exercicioUid: 'A', serieUid: 'A2', concluida: feitas('A1', 'B1') })).toBeNull();
    expect(descansoAoMarcar({ sessao: s, exercicioUid: 'B', serieUid: 'B2', concluida: feitas('A1', 'B1', 'A2') })).toBe(90);
  });

  it('marcar de novo uma série que já estava feita não reinicia o descanso', () => {
    expect(descansoAoMarcar({ sessao: comSuperset(), exercicioUid: 'B', serieUid: 'B1', concluida: feitas('A1', 'B1') })).toBeNull();
  });

  it('membro com menos séries: a volta que ele não tem fecha só com os que a têm', () => {
    const s = sessao(
      's',
      [
        exercicio('A', { grupoUid: 'g', series: [serie('A1'), serie('A2'), serie('A3')] }),
        exercicio('B', { grupoUid: 'g', series: [serie('B1')] }),
      ],
      [grupo('g', 'SUPERSET', { descansoAposSegundos: 75 })],
    );
    expect(descansoAoMarcar({ sessao: s, exercicioUid: 'A', serieUid: 'A3', concluida: feitas('A1', 'A2', 'B1') })).toBe(75);
    expect(descansoAoMarcar({ sessao: s, exercicioUid: 'A', serieUid: 'A2', concluida: feitas('A1', 'B1') })).toBe(75);
  });

  it('descanso do grupo zerado ou ausente: nenhum descanso automático', () => {
    const base = (apos: number | null) =>
      sessao(
        's',
        [exercicio('A', { grupoUid: 'g', series: [serie('A1', { descansoSegundos: 60 })] }), exercicio('B', { grupoUid: 'g', series: [serie('B1', { descansoSegundos: 60 })] })],
        [grupo('g', 'SUPERSET', { descansoAposSegundos: apos })],
      );
    expect(descansoAoMarcar({ sessao: base(0), exercicioUid: 'B', serieUid: 'B1', concluida: feitas('A1') })).toBeNull();
    expect(descansoAoMarcar({ sessao: base(null), exercicioUid: 'B', serieUid: 'B1', concluida: feitas('A1') })).toBeNull();
  });

  it('pré-exaustão: cada série mantém o descanso da própria série, sem esperar o par', () => {
    const s = sessao(
      's',
      [exercicio('A', { grupoUid: 'g', series: [serie('A1', { descansoSegundos: 30 })] }), exercicio('B', { grupoUid: 'g', series: [serie('B1', { descansoSegundos: 120 })] })],
      [grupo('g', 'PRE_EXAUSTAO', { descansoAposSegundos: 90 })],
    );
    expect(descansoAoMarcar({ sessao: s, exercicioUid: 'A', serieUid: 'A1', concluida: feitas() })).toBe(30);
    expect(descansoAoMarcar({ sessao: s, exercicioUid: 'B', serieUid: 'B1', concluida: feitas('A1') })).toBe(120);
  });

  it('exercício ou série que não existe: nenhum descanso', () => {
    expect(descansoAoMarcar({ sessao: comSuperset(), exercicioUid: 'X', serieUid: 'A1', concluida: feitas() })).toBeNull();
    expect(descansoAoMarcar({ sessao: comSuperset(), exercicioUid: 'A', serieUid: 'X', concluida: feitas() })).toBeNull();
  });
});
