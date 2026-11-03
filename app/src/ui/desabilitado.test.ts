import { visualDoInativo } from './desabilitado';

describe('visualDoInativo (D3: só o desabilitado vira cinza)', () => {
  it('desabilitado é cinza e sem opacidade', () => {
    expect(visualDoInativo(true, false)).toEqual({ cinza: true, apagado: false });
  });

  it('carregando mantém o visual de antes: cor cheia a 50%, não cinza', () => {
    expect(visualDoInativo(false, true)).toEqual({ cinza: false, apagado: true });
    expect(visualDoInativo(undefined, true)).toEqual({ cinza: false, apagado: true });
  });

  it('desabilitado e carregando juntos: cinza vence', () => {
    expect(visualDoInativo(true, true)).toEqual({ cinza: true, apagado: false });
  });

  it('livre: nem cinza nem apagado', () => {
    expect(visualDoInativo()).toEqual({ cinza: false, apagado: false });
  });
});
