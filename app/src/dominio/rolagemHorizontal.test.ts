import { deslocamentoParaVer } from './rolagemHorizontal';

const VISTA = { x: 0, largura: 360 };

describe('deslocamentoParaVer', () => {
  it('aba já inteira à vista (fora do esmaecido) não rola', () => {
    expect(deslocamentoParaVer({ x: 100, largura: 80 }, VISTA, 28, 900)).toBeNull();
  });

  it('aba cortada à direita rola até ela aparecer inteira, com a folga do esmaecido', () => {
    expect(deslocamentoParaVer({ x: 400, largura: 120 }, VISTA, 28, 900)).toBe(400 + 120 + 28 - 360);
  });

  it('aba escondida à esquerda volta até o começo dela, menos a folga, sem passar de 0', () => {
    expect(deslocamentoParaVer({ x: 200, largura: 80 }, { x: 300, largura: 360 }, 28, 900)).toBe(172);
    expect(deslocamentoParaVer({ x: 10, largura: 80 }, { x: 300, largura: 360 }, 28, 900)).toBe(0);
  });

  it('não passa do fim do conteúdo e alinha pelo começo a aba mais larga que a vista', () => {
    expect(deslocamentoParaVer({ x: 800, largura: 100 }, VISTA, 28, 900)).toBe(540);
    expect(deslocamentoParaVer({ x: 400, largura: 500 }, VISTA, 28, 2000)).toBe(372);
  });
});
