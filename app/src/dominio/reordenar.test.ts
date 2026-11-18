import type { ExercicioPlano } from '../api/tipos';
import { moverExercicio, type ExerciciosEGrupos } from './combinacoes';
import { mover } from './editorTreino';
import { exercicio, grupo } from './exemplosDeTreino.apoioTeste';
import { destinoDoArraste, moverPara, reordenarPorPassos } from './reordenar';

const lista = ['A', 'B', 'C', 'D'];
// Quatro itens de 40 px de altura, um embaixo do outro, com 8 px entre eles (meios em 20, 68, 116, 164).
const coluna = lista.map((_, i) => ({ x: 0, y: i * 48, w: 300, h: 40 }));

describe('destinoDoArraste', () => {
  it('conta os outros itens com o meio acima do ponto', () => {
    expect(destinoDoArraste(coluna, 0, { x: 10, y: 100 })).toBe(1);
    expect(destinoDoArraste(coluna, 0, { x: 10, y: 500 })).toBe(3);
    expect(destinoDoArraste(coluna, 3, { x: 10, y: -50 })).toBe(0);
    expect(destinoDoArraste(coluna, 2, { x: 10, y: 50 })).toBe(1);
  });

  it('solto no próprio lugar fica onde está', () => {
    expect(destinoDoArraste(coluna, 1, { x: 10, y: 68 })).toBe(1);
  });

  it('índice inválido ou sem medida devolve a origem; caixa não medida não conta', () => {
    expect(destinoDoArraste(coluna, -1, { x: 0, y: 0 })).toBe(-1);
    expect(destinoDoArraste(coluna, 9, { x: 0, y: 0 })).toBe(9);
    expect(destinoDoArraste([undefined, coluna[1]], 0, { x: 0, y: 999 })).toBe(0);
    expect(destinoDoArraste([coluna[0], undefined, coluna[2]], 0, { x: 0, y: 999 })).toBe(1);
  });

  it('chips em linhas: a linha de cima inteira e, na mesma linha, os da esquerda', () => {
    // Duas linhas de três chips de 100 × 40 (linha 1 em y 0, linha 2 em y 50).
    const chips = [0, 1, 2, 3, 4, 5].map((i) => ({ x: (i % 3) * 110, y: Math.floor(i / 3) * 50, w: 100, h: 40 }));
    expect(destinoDoArraste(chips, 0, { x: 120, y: 70 }, 'linhas')).toBe(3);
    expect(destinoDoArraste(chips, 5, { x: 5, y: 20 }, 'linhas')).toBe(0);
    expect(destinoDoArraste(chips, 0, { x: 280, y: 20 }, 'linhas')).toBe(2);
  });
});

describe('moverPara', () => {
  it('leva o item e os outros andam uma casa, nas duas direções e até as pontas', () => {
    expect(moverPara(lista, 0, 2)).toEqual(['B', 'C', 'A', 'D']);
    expect(moverPara(lista, 3, 0)).toEqual(['D', 'A', 'B', 'C']);
    expect(moverPara(lista, 0, 3)).toEqual(['B', 'C', 'D', 'A']);
  });

  it('mesmo lugar ou índice inválido devolve a mesma lista', () => {
    expect(moverPara(lista, 1, 1)).toBe(lista);
    expect(moverPara(lista, -1, 2)).toBe(lista);
    expect(moverPara(lista, 1, 4)).toBe(lista);
    expect(moverPara([], 0, 0)).toEqual([]);
  });

  it('dá o mesmo que apertar a seta várias vezes', () => {
    const porSetas = mover(mover(mover(lista, 3, -1), 2, -1), 1, -1);
    expect(moverPara(lista, 3, 0)).toEqual(porSetas);
  });
});

describe('reordenarPorPassos', () => {
  const pelaSeta = (de: number, para: number) =>
    reordenarPorPassos(lista, para, (l) => l.indexOf(lista[de]), mover);

  it('com as setas de uma lista simples dá o mesmo que moverPara', () => {
    expect(pelaSeta(0, 2)).toEqual(moverPara(lista, 0, 2));
    expect(pelaSeta(3, 0)).toEqual(moverPara(lista, 3, 0));
  });

  it('mesmo lugar, destino fora ou item que sumiu não mudam nada', () => {
    expect(pelaSeta(1, 1)).toBe(lista);
    expect(reordenarPorPassos(lista, -1, () => 0, mover)).toBe(lista);
    expect(reordenarPorPassos(lista, 2, () => -1, mover)).toBe(lista);
  });

  it('para quando a seta não muda nada (ponta) e respeita o limite de passos', () => {
    expect(reordenarPorPassos(lista, 9, (l) => l.indexOf('A'), mover)).toEqual(['B', 'C', 'D', 'A']);
    const passo = jest.fn((l: string[], i: number, d: -1 | 1) => mover(l, i, d));
    reordenarPorPassos(lista, 3, (l) => l.indexOf('A'), passo, 2);
    expect(passo).toHaveBeenCalledTimes(2);
  });

  it('exercício solto passa por cima do grupo inteiro, como a seta', () => {
    const ex = (nome: string, g: string | null = null): ExercicioPlano => exercicio(nome, { nome, grupoUid: g });
    const s: ExerciciosEGrupos = { exercicios: [ex('Supino', 'g1'), ex('Remada', 'g1'), ex('Agachamento')], grupos: [grupo('g1', 'SUPERSET')] };
    const onde = (e: ExerciciosEGrupos) => e.exercicios.findIndex((x) => x.nome === 'Agachamento');
    // Solto no meio do grupo: o passo da seta pula o grupo e o arraste para ali (cruzou o destino).
    const r = reordenarPorPassos(s, 1, onde, moverExercicio);
    expect(r.exercicios.map((e) => e.nome)).toEqual(['Agachamento', 'Supino', 'Remada']);
    expect(r).toEqual(moverExercicio(s, 2, -1));
  });
});
