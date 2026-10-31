import type { ExercicioPlano, Serie, Sessao } from '../api/tipos';
import { contarPlano, contarSessao, textoDaSessaoAberta, textoDoPlanoInteiro } from './contagemDoTreino';

const serie = (uid: string) => ({ uid }) as Serie;
const exercicio = (n: number) => ({ series: Array.from({ length: n }, (_, i) => serie(`s${i}`)) }) as unknown as ExercicioPlano;
const sessao = (...series: number[]) => ({ exercicios: series.map(exercicio) }) as unknown as Sessao;

describe('contagem do treino', () => {
  it('soma sessões, exercícios e séries cadastradas do plano inteiro', () => {
    const c = contarPlano({ sessoes: [sessao(3, 4), sessao(), sessao(1)] });
    expect(c).toEqual({ sessoes: 3, exercicios: 3, series: 8 });
    expect(textoDoPlanoInteiro(c)).toBe('Plano inteiro: 3 sessões · 3 exercícios · 8 séries cadastradas');
  });

  it('conta só a sessão aberta, separada do plano', () => {
    const c = contarSessao(sessao(3, 4));
    expect(c).toEqual({ exercicios: 2, series: 7 });
    expect(textoDaSessaoAberta(c)).toBe('Sessão aberta: 2 exercícios · 7 séries');
  });

  it('singular e plano vazio', () => {
    expect(textoDoPlanoInteiro(contarPlano({ sessoes: [sessao(1)] }))).toBe('Plano inteiro: 1 sessão · 1 exercício · 1 série cadastrada');
    expect(textoDoPlanoInteiro(contarPlano({ sessoes: [] }))).toBe('Plano inteiro: 0 sessões · 0 exercícios · 0 séries cadastradas');
    expect(textoDaSessaoAberta(contarSessao(sessao()))).toBe('Sessão aberta: 0 exercícios · 0 séries');
  });
});
