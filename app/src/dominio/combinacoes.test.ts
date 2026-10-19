import type { ExercicioPlano } from '../api/tipos';
import { gruposDaSessao, MAXIMO_POR_GRUPO, nomeDoGrupo, podeJuntar, posicaoNoGrupo, textoDaFaixa } from './combinacoes';

function ex(nome: string, extra: Partial<ExercicioPlano> = {}): ExercicioPlano {
  return {
    uid: nome,
    exercicioId: null,
    nome,
    modalidade: null,
    videoUrl: null,
    observacao: null,
    progressao: true,
    unidade: 'kg',
    series: [],
    ...extra,
  };
}
const junto = (nome: string, extra: Partial<ExercicioPlano> = {}) => ex(nome, { juntoComAnterior: true, ...extra });

describe('agrupamento de exercícios', () => {
  it('nome pelo tamanho; supersérie só no grupo de 2', () => {
    expect(nomeDoGrupo(1, null)).toBeNull();
    expect(nomeDoGrupo(2, null)).toBe('Bi-set');
    expect(nomeDoGrupo(2, 'SUPERSERIE')).toBe('Supersérie');
    expect(nomeDoGrupo(3, 'SUPERSERIE')).toBe('Tri-set');
    expect(nomeDoGrupo(4, null)).toBe('Circuito');
    expect(nomeDoGrupo(6, null)).toBe('Circuito');
  });

  it('exercícios ligados formam grupos; soltos ficam sozinhos', () => {
    const lista = [ex('Supino'), junto('Remada'), ex('Agachamento'), ex('Rosca'), junto('Tríceps'), junto('Elevação')];
    const grupos = gruposDaSessao(lista);
    expect(grupos.map((g) => [g.inicio, g.exercicios.map((e) => e.nome), g.nome])).toEqual([
      [0, ['Supino', 'Remada'], 'Bi-set'],
      [2, ['Agachamento'], null],
      [3, ['Rosca', 'Tríceps', 'Elevação'], 'Tri-set'],
    ]);
  });

  it('a supersérie vem do primeiro do grupo; marca no segundo não vale', () => {
    expect(gruposDaSessao([ex('A', { combinacao: 'SUPERSERIE' }), junto('B')])[0].nome).toBe('Supersérie');
    expect(gruposDaSessao([ex('A'), junto('B', { combinacao: 'SUPERSERIE' })])[0].nome).toBe('Bi-set');
  });

  it('marca no primeiro da sessão é ignorada', () => {
    expect(gruposDaSessao([junto('A'), ex('B')]).map((g) => g.exercicios.length)).toEqual([1, 1]);
  });

  it('posição e faixa do aluno', () => {
    const lista = [ex('Supino'), junto('Remada'), junto('Desenvolvimento'), ex('Rosca')];
    const primeiro = posicaoNoGrupo(lista, 0)!;
    expect(textoDaFaixa(primeiro, true)).toBe('Tri-set 1 de 3 · em seguida: Remada');
    const ultimo = posicaoNoGrupo(lista, 2)!;
    expect(textoDaFaixa(ultimo, true)).toBe('Tri-set 3 de 3 · volte para Supino e repita');
    expect(textoDaFaixa(ultimo, false)).toBe('Tri-set 3 de 3');
    expect(posicaoNoGrupo(lista, 3)).toBeNull();
  });

  it(`ligar ao anterior só até ${MAXIMO_POR_GRUPO} exercícios e nunca no primeiro`, () => {
    const seis = [ex('1'), junto('2'), junto('3'), junto('4'), junto('5'), junto('6'), ex('7')];
    expect(podeJuntar(seis, 0)).toBe(false);
    expect(podeJuntar(seis, 5)).toBe(true);
    expect(podeJuntar(seis, 6)).toBe(false);
    expect(podeJuntar([ex('1'), ex('2')], 1)).toBe(true);
  });
});
