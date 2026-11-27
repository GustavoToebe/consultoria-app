import { arranjoDaMarca, FORMULARIO_E_PREVIA, PREVIA_DUPLA_MINIMA } from './arranjoDaMarca';

describe('arranjoDaMarca', () => {
  it('sem medida não decide (nenhuma prévia pisca)', () => {
    expect(arranjoDaMarca(null)).toBeNull();
    expect(arranjoDaMarca(undefined)).toBeNull();
    expect(arranjoDaMarca(0)).toBeNull();
    expect(arranjoDaMarca(Number.NaN)).toBeNull();
  });

  it('celular, 1280 dentro de Configurações e telas médias: um celular só, embaixo do formulário', () => {
    expect(arranjoDaMarca(358)).toBe('empilhado');
    expect(arranjoDaMarca(708)).toBe('empilhado');
    expect(arranjoDaMarca(FORMULARIO_E_PREVIA - 1)).toBe('empilhado');
  });

  it('a partir de 1280 (720 + 24 + dois celulares de 240, o vão e o recuo): formulário e a prévia dupla ao lado', () => {
    expect(PREVIA_DUPLA_MINIMA).toBe(536);
    expect(FORMULARIO_E_PREVIA).toBe(1280);
    // 1920 de janela dentro de Configurações: 1920 - 240 (menu) - 300 (coluna) - 32 (recuo da Tela).
    expect(arranjoDaMarca(1348)).toBe('larga');
    expect(arranjoDaMarca(2836)).toBe('larga');
  });
});
