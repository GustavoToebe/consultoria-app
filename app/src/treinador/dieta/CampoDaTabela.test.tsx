/* eslint-disable @typescript-eslint/no-require-imports */
import { alturaDoCampo, alturaNoCelular } from './CampoDaTabela';

jest.mock('../../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../../tema/tokens').ESCURO, fatorTexto: 1 }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());

// O campo da web: linha de 20 px, recuo de 8 em cima e embaixo e borda de 1 px (`scrollHeight` = texto + recuos).
const medidas = (linhasDeTexto: number) => ({ conteudo: linhasDeTexto * 20 + 16, linha: 20, recuoDeCima: 8, recuoDeBaixo: 8, borda: 2 });

describe('alturaDoCampo', () => {
  it('uma linha de texto fica no alvo de toque (44), como o vizinho de uma linha', () => {
    expect(alturaDoCampo(medidas(1), 2)).toEqual({ altura: 44, rola: false });
  });

  it('cresce com o texto até o teto, sem rolar', () => {
    expect(alturaDoCampo(medidas(2), 2)).toEqual({ altura: 58, rola: false });
    expect(alturaDoCampo(medidas(5), 6)).toEqual({ altura: 118, rola: false });
  });

  it('acima do teto para em linhas inteiras, sem o recuo de baixo (nada da linha seguinte à vista), e rola', () => {
    const { altura, rola } = alturaDoCampo(medidas(3), 2);
    expect(rola).toBe(true);
    // Área visível do texto (sem bordas e sem o recuo de cima) = exatamente duas linhas.
    expect(altura - 2 - 8).toBe(2 * 20);
  });
});

describe('alturaNoCelular', () => {
  // contentSize do TextInput = só o texto, linhas de 20 px; recuos de 8 e bordas de 1 px somam 18.
  it('uma linha fica no alvo de toque; cresce com o texto até o teto', () => {
    expect(alturaNoCelular(20, 2)).toBe(44);
    expect(alturaNoCelular(40, 2)).toBe(58);
    expect(alturaNoCelular(100, 6)).toBe(118);
  });

  it('passou do teto: para em linhas inteiras (o resto rola dentro do campo)', () => {
    expect(alturaNoCelular(60, 2)).toBe(2 * 20 + 8 + 2);
    expect(alturaNoCelular(400, 6)).toBe(6 * 20 + 8 + 2);
  });
});
