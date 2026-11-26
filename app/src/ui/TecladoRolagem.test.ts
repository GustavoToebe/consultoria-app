import { deslocamentoParaMostrar } from './RolagemComTopo';

jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: {} }) }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

describe('deslocamentoParaMostrar (campo focado com o teclado aberto)', () => {
  it('campo já visível não rola', () => {
    expect(deslocamentoParaMostrar({ topo: 100, altura: 44 }, 0, 400, 16)).toBeNull();
  });

  it('campo coberto pelo teclado rola até caber embaixo, com folga', () => {
    expect(deslocamentoParaMostrar({ topo: 500, altura: 44 }, 0, 400, 16)).toBe(160);
  });

  it('campo acima da janela volta para o topo com folga', () => {
    expect(deslocamentoParaMostrar({ topo: 300, altura: 44 }, 600, 400, 16)).toBe(284);
  });

  it('campo mais alto que a janela mostra o topo, não o fim', () => {
    expect(deslocamentoParaMostrar({ topo: 200, altura: 600 }, 0, 400, 16)).toBe(184);
  });

  it('janela sem medida não rola', () => {
    expect(deslocamentoParaMostrar({ topo: 500, altura: 44 }, 0, 0, 16)).toBeNull();
  });
});
