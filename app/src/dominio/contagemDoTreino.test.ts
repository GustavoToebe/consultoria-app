import type { ExercicioPlano, Serie, Sessao } from '../api/tipos';
import { contarPlano, contarSessao, textoDosTotaisDaSessao, textoDosTotaisDoPlano } from './contagemDoTreino';

const serie = (uid: string) => ({ uid }) as Serie;
const exercicio = (n: number) => ({ series: Array.from({ length: n }, (_, i) => serie(`s${i}`)) }) as unknown as ExercicioPlano;
const sessao = (...series: number[]) => ({ exercicios: series.map(exercicio) }) as unknown as Sessao;

describe('contagem do treino', () => {
  it('soma sessões, exercícios e séries cadastradas do plano inteiro', () => {
    expect(contarPlano({ sessoes: [sessao(3, 4), sessao(), sessao(1)] })).toEqual({ sessoes: 3, exercicios: 3, series: 8 });
  });

  it('conta só a sessão aberta, separada do plano', () => {
    expect(contarSessao(sessao(3, 4))).toEqual({ exercicios: 2, series: 7 });
    expect(contarSessao(sessao())).toEqual({ exercicios: 0, series: 0 });
  });
});

describe('totais do título das Sessões e do cabeçalho da sessão', () => {
  it('plano: plural e singular', () => {
    expect(textoDosTotaisDoPlano({ sessoes: 7, exercicios: 27, series: 81 })).toBe('7 sessões · 27 exercícios · 81 séries');
    expect(textoDosTotaisDoPlano({ sessoes: 1, exercicios: 1, series: 1 })).toBe('1 sessão · 1 exercício · 1 série');
    expect(textoDosTotaisDoPlano(contarPlano({ sessoes: [] }))).toBe('0 sessões · 0 exercícios · 0 séries');
  });

  it('sessão: "de trabalho" não flexiona', () => {
    expect(textoDosTotaisDaSessao({ exercicios: 7, series: 23, seriesDeTrabalho: 16 })).toBe('7 exercícios · 23 séries · 16 de trabalho');
    expect(textoDosTotaisDaSessao({ exercicios: 1, series: 1, seriesDeTrabalho: 1 })).toBe('1 exercício · 1 série · 1 de trabalho');
    expect(textoDosTotaisDaSessao({ exercicios: 0, series: 0, seriesDeTrabalho: 0 })).toBe('0 exercícios · 0 séries · 0 de trabalho');
  });
});
