import {
  cadenciaValida,
  erroDaCadencia,
  erroDaIsometria,
  normalizarCadencia,
  textoCadenciaPorExtenso,
  textoExecucao,
  textosDeExecucao,
} from './execucaoDoExercicio';

describe('cadência e isometria', () => {
  it('aceita 4 partes de 0 a 9 ou X, como o servidor', () => {
    for (const boa of ['3-1-1-0', '2-0-X-1', 'X-X-X-X', null, '']) expect(cadenciaValida(boa)).toBe(true);
    for (const ruim of ['3-1-1', '3-1-1-0-0', '31-1-0', '3-1-x-0', '10-1-1-0', '3 1 1 0']) expect(cadenciaValida(ruim)).toBe(false);
    expect(erroDaCadencia('3-1')).toBeDefined();
  });

  it('normaliza o que o treinador digita', () => {
    expect(normalizarCadencia(' 2-0-x-1 ')).toBe('2-0-X-1');
    expect(normalizarCadencia('  ')).toBeNull();
  });

  it('por extenso para o aluno', () => {
    expect(textoCadenciaPorExtenso('3-1-1-0')).toBe('Cadência 3-1-1-0: 3 s descendo, 1 s parado embaixo, 1 s subindo, 0 s em cima.');
    expect(textoCadenciaPorExtenso('2-0-X-1')).toBe('Cadência 2-0-X-1: 2 s descendo, 0 s parado embaixo, subindo o mais rápido que puder, 1 s em cima.');
    expect(textoCadenciaPorExtenso('inválida')).toBe('');
    expect(textosDeExecucao({ cadencia: null, isometriaSegundos: 10 })).toEqual(['Isometria: segure 10 s.']);
    expect(textosDeExecucao({ cadencia: null, isometriaSegundos: null })).toEqual([]);
  });

  it('texto curto do PDF e do editor', () => {
    expect(textoExecucao({ cadencia: '3-1-1-0', isometriaSegundos: 10 })).toBe('Cadência 3-1-1-0 · Isometria 10 s');
    expect(textoExecucao({})).toBe('');
  });

  it('isometria de 1 a 120 s', () => {
    expect(erroDaIsometria(null)).toBeUndefined();
    expect(erroDaIsometria(1)).toBeUndefined();
    expect(erroDaIsometria(120)).toBeUndefined();
    expect(erroDaIsometria(0)).toBeDefined();
    expect(erroDaIsometria(121)).toBeDefined();
  });
});
