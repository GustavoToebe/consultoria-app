import { codigoDoFragmento } from './linkDeConvite';

describe('código do convite no fragmento do link', () => {
  it('lê o código do #codigo=', () => {
    expect(codigoDoFragmento('#codigo=ABCD234567')).toBe('ABCD234567');
    expect(codigoDoFragmento('codigo=ABCD234567&x=1')).toBe('ABCD234567');
  });

  it('sem código, vazio (a pessoa digita)', () => {
    expect(codigoDoFragmento('')).toBe('');
    expect(codigoDoFragmento('#outra=1')).toBe('');
  });
});
