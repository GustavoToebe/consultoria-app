import { problemaDaNovaSenha, tokenDoFragmento } from './redefinirSenha';

describe('redefinição de senha', () => {
  it('lê o token do fragmento, com ou sem o #', () => {
    expect(tokenDoFragmento('#token=abc_DEF-123')).toBe('abc_DEF-123');
    expect(tokenDoFragmento('token=abc')).toBe('abc');
    expect(tokenDoFragmento('#outro=1&token=xyz')).toBe('xyz');
  });

  it('sem token no fragmento não há link', () => {
    expect(tokenDoFragmento('')).toBeNull();
    expect(tokenDoFragmento('#')).toBeNull();
    expect(tokenDoFragmento('#token=')).toBeNull();
    expect(tokenDoFragmento('#token=%20')).toBeNull();
    expect(tokenDoFragmento('#codigo=abc')).toBeNull();
    expect(tokenDoFragmento(null)).toBeNull();
    expect(tokenDoFragmento(undefined)).toBeNull();
  });

  it('confere tamanho, bytes e confirmação da senha nova', () => {
    expect(problemaDaNovaSenha('curta', 'curta')).toContain('8 caracteres');
    expect(problemaDaNovaSenha('é'.repeat(37), 'é'.repeat(37))).toContain('72 bytes');
    expect(problemaDaNovaSenha('uma-senha-boa', 'outra-senha-boa')).toContain('não conferem');
    expect(problemaDaNovaSenha('uma-senha-boa', 'uma-senha-boa')).toBeNull();
  });

  it('recusa senha igual ao e-mail quando o e-mail é conhecido', () => {
    expect(problemaDaNovaSenha('Ana@Exemplo.com', 'Ana@Exemplo.com', 'ana@exemplo.com')).toContain('igual ao e-mail');
  });
});
