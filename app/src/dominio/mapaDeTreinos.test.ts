import { juntarConclusoes, montarMapa, periodoDoMapa, semanasParaCelular, textoDaCelula } from './mapaDeTreinos';
import type { ConclusaoDoTreino, ConclusaoLocal } from './sessoesConcluidas';

// 11/11/2026 é quarta-feira.
const HOJE = '2026-11-11';

const conclusao = (data: string, resultado: 'COMPLETA' | 'PARCIAL' | null, extra: Partial<ConclusaoDoTreino> = {}): ConclusaoDoTreino => ({
  planoVersaoId: 'v1', sessaoUid: 's1', sessaoNome: 'Treino A', data, concluida: resultado !== null, resultado,
  duracaoSegundos: null, comentario: null, ...extra,
});
const celula = (data: string, conclusoes: ConclusaoDoTreino[]) =>
  montarMapa(conclusoes, HOJE).semanas.flatMap((s) => s.dias).find((d) => d.data === data)!;

describe('periodoDoMapa', () => {
  it('vai do início da semana (segunda) de hoje − 364 até hoje, e pede à API só o que ela aceita', () => {
    expect(periodoDoMapa(HOJE)).toEqual({ inicio: '2025-11-10', fim: HOJE, de: '2025-11-10' });
    // Domingo: hoje − 364 cai num domingo, a semana recua 6 dias (370 dias), mas a API só aceita 366.
    expect(periodoDoMapa('2026-11-15')).toEqual({ inicio: '2025-11-10', fim: '2026-11-15', de: '2025-11-14' });
  });
});

describe('montarMapa', () => {
  it('monta 53 semanas de 7 dias, segunda a domingo, com os dias depois de hoje marcados como futuro', () => {
    const { semanas } = montarMapa([], HOJE);
    expect(semanas).toHaveLength(53);
    expect(semanas.every((s) => s.dias.length === 7)).toBe(true);
    expect(semanas[0].dias[0].data).toBe('2025-11-10');
    const ultima = semanas[52].dias;
    expect(ultima[0].data).toBe('2026-11-09');
    expect(ultima.map((d) => d.futuro)).toEqual([false, false, false, true, true, true, true]);
  });

  it('nível: 0 sem treino, 1 só parcial, 2 com ao menos um completo; reaberta não conta', () => {
    const conclusoes = [
      conclusao('2026-11-02', 'COMPLETA'),
      conclusao('2026-11-03', 'PARCIAL'),
      conclusao('2026-11-04', 'PARCIAL', { sessaoUid: 's1' }),
      conclusao('2026-11-04', 'COMPLETA', { sessaoUid: 's2', sessaoNome: 'Treino B' }),
      conclusao('2026-11-05', null),
    ];
    expect(celula('2026-11-02', conclusoes).nivel).toBe(2);
    expect(celula('2026-11-03', conclusoes).nivel).toBe(1);
    expect(celula('2026-11-04', conclusoes).nivel).toBe(2);
    expect(celula('2026-11-05', conclusoes)).toMatchObject({ nivel: 0, treinos: [] });
    expect(celula('2026-11-06', conclusoes).nivel).toBe(0);
  });

  it('mais de um treino no dia aparece na lista do dia e o dia conta uma vez', () => {
    const conclusoes = [
      conclusao('2026-11-04', 'PARCIAL'),
      conclusao('2026-11-04', 'COMPLETA', { sessaoUid: 's2', sessaoNome: 'Treino B' }),
      conclusao('2026-11-05', 'COMPLETA', { sessaoNome: null }),
    ];
    const mapa = montarMapa(conclusoes, HOJE);
    expect(celula('2026-11-04', conclusoes).treinos).toEqual([
      { nome: 'Treino A', resultado: 'PARCIAL' }, { nome: 'Treino B', resultado: 'COMPLETA' },
    ]);
    expect(celula('2026-11-05', conclusoes).treinos).toEqual([{ nome: 'Treino', resultado: 'COMPLETA' }]);
    expect(mapa.diasTreinados).toBe(2);
  });

  it('ignora conclusão fora do período ou depois de hoje', () => {
    const mapa = montarMapa([conclusao('2025-11-09', 'COMPLETA'), conclusao('2026-11-12', 'COMPLETA')], HOJE);
    expect(mapa.diasTreinados).toBe(0);
  });

  it('rótulo de mês só na semana que traz o dia 1', () => {
    const { semanas } = montarMapa([], HOJE);
    expect(semanas[0].mes).toBeNull();
    const rotulos = semanas.filter((s) => s.mes).map((s) => s.mes);
    expect(rotulos).toHaveLength(12);
    expect(rotulos[0]).toBe('dez');
    expect(rotulos[rotulos.length - 1]).toBe('nov');
    // 01/03/2026 é domingo: o dia 1 fecha a semana de 23/02.
    expect(semanas.find((s) => s.dias.some((d) => d.data === '2026-03-01'))!.mes).toBe('mar');
  });
});

describe('semanasParaCelular', () => {
  it('devolve as últimas n semanas, a mais recente por último', () => {
    const mapa = montarMapa([], HOJE);
    const ultimas = semanasParaCelular(mapa, 4);
    expect(ultimas).toHaveLength(4);
    expect(ultimas[3]).toBe(mapa.semanas[52]);
    expect(semanasParaCelular(mapa, 0)).toEqual([]);
    expect(semanasParaCelular(mapa, 999)).toHaveLength(53);
  });
});

describe('textoDaCelula', () => {
  it('diz o dia, o treino e o resultado', () => {
    const conclusoes = [
      conclusao('2026-03-12', 'COMPLETA'),
      conclusao('2026-03-13', 'PARCIAL'),
      conclusao('2026-03-13', 'COMPLETA', { sessaoUid: 's2', sessaoNome: 'Treino B' }),
    ];
    expect(textoDaCelula(celula('2026-03-12', conclusoes))).toBe('12 de março: Treino A, fiz tudo');
    expect(textoDaCelula(celula('2026-03-13', conclusoes))).toBe('13 de março: Treino A, fiz em parte; Treino B, fiz tudo');
    expect(textoDaCelula(celula('2026-03-14', conclusoes))).toBe('14 de março: sem treino');
    expect(textoDaCelula(celula('2026-11-13', conclusoes))).toBe('13 de novembro: ainda não chegou');
  });
});

describe('juntarConclusoes', () => {
  const local = (data: string, extra: Partial<ConclusaoLocal> = {}): ConclusaoLocal => ({
    ...conclusao(data, 'COMPLETA', { sessaoNome: undefined }), situacao: 'LOCAL', ...extra,
  });

  it('a do aparelho ganha da API, mantém o nome da API e soma o que ainda não foi enviado', () => {
    const api = [conclusao('2026-11-02', 'PARCIAL'), conclusao('2026-11-03', 'COMPLETA')];
    const locais = [local('2026-11-02'), local('2026-11-04', { sessaoUid: 's9' }), local('2026-11-05', { situacao: 'FALHOU' })];
    const mapa = montarMapa(juntarConclusoes(api, locais), HOJE);
    const dia = (d: string) => mapa.semanas.flatMap((s) => s.dias).find((x) => x.data === d)!;
    expect(dia('2026-11-02').treinos).toEqual([{ nome: 'Treino A', resultado: 'COMPLETA' }]);
    expect(dia('2026-11-03').nivel).toBe(2);
    expect(dia('2026-11-04').treinos).toEqual([{ nome: 'Treino', resultado: 'COMPLETA' }]);
    expect(dia('2026-11-05').nivel).toBe(0);
  });

  it('reaberta no aparelho tira o dia mesmo que a API ainda o tenha', () => {
    const mapa = montarMapa(juntarConclusoes([conclusao('2026-11-02', 'COMPLETA')], [local('2026-11-02', { concluida: false, resultado: null })]), HOJE);
    expect(mapa.diasTreinados).toBe(0);
  });
});
