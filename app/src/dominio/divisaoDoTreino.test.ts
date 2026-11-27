import type { Sessao } from '../api/tipos';
import { colunasDoTreino, divisaoEscolhida, ondeFicaAMobilidade } from './divisaoDoTreino';

const sessao = (uid: string, diaSemana: number | null, exercicios = 3): Sessao => ({
  uid, nome: uid, diaSemana, tipo: 'TREINO', frequenciaSemanal: null, observacao: null, cardio: null, grupos: [],
  exercicios: Array.from({ length: exercicios }, (_, i) => ({ uid: `${uid}${i}` })) as Sessao['exercicios'],
});

const A = sessao('a', 1);
const B = sessao('b', 3);
const DESCANSO = sessao('d', 4, 0);
const C = sessao('c', 5);
const SEMANA = [A, B, DESCANSO, C];

describe('colunasDoTreino', () => {
  it('celular e compacta empilham; normal e larga têm duas colunas; ultralarga, três', () => {
    expect(colunasDoTreino('compacta')).toBe('pilha');
    expect(colunasDoTreino('normal')).toBe('duas');
    expect(colunasDoTreino('larga')).toBe('duas');
    expect(colunasDoTreino('ultralarga')).toBe('tres');
  });
});

describe('ondeFicaAMobilidade', () => {
  it('celular na pilha; normal depois das duas colunas; larga e ultralarga embaixo do treino', () => {
    expect(ondeFicaAMobilidade('compacta')).toBe('pilha');
    expect(ondeFicaAMobilidade('normal')).toBe('abaixo');
    expect(ondeFicaAMobilidade('larga')).toBe('treino');
    expect(ondeFicaAMobilidade('ultralarga')).toBe('treino');
  });
});

describe('divisaoEscolhida', () => {
  it('vale a do endereço quando existe e tem exercício', () => {
    expect(divisaoEscolhida(SEMANA, 'b', 1)).toBe(B);
  });
  it('endereço desconhecido ou de descanso cai na regra do dia', () => {
    expect(divisaoEscolhida(SEMANA, 'zz', 1)).toBe(A);
    expect(divisaoEscolhida(SEMANA, 'd', 1)).toBe(A);
  });
  it('sem endereço, a de hoje', () => {
    expect(divisaoEscolhida(SEMANA, null, 3)).toBe(B);
  });
  it('hoje é descanso ou sem divisão: o próximo dia de treino, dando a volta na semana', () => {
    expect(divisaoEscolhida(SEMANA, null, 4)).toBe(C);
    expect(divisaoEscolhida(SEMANA, null, 6)).toBe(A);
  });
  it('sem dia fixo em nenhuma, a primeira com exercício; sem exercício nenhum, nada', () => {
    expect(divisaoEscolhida([sessao('x', null, 0), sessao('y', null)], null, 2)?.uid).toBe('y');
    expect(divisaoEscolhida([DESCANSO], null, 2)).toBeNull();
    expect(divisaoEscolhida([], 'a', 2)).toBeNull();
  });
});
