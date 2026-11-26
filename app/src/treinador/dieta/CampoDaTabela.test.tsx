/* eslint-disable @typescript-eslint/no-require-imports */
import { alturaDoCampo } from './CampoDaTabela';

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
