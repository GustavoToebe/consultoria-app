import { acaoDoAtalho, ehMac, focoEmCampo, rotuloDoAtalho } from './atalhosDoMenu';

describe('acaoDoAtalho', () => {
  it('Ctrl+B alterna a barra e Ctrl+K busca, com a tecla em qualquer caixa', () => {
    expect(acaoDoAtalho({ key: 'b', ctrl: true })).toBe('alternar-barra');
    expect(acaoDoAtalho({ key: 'K', ctrl: true })).toBe('buscar');
  });

  it('sem Ctrl/Cmd, com Shift ou Alt, ou outra tecla: não é atalho', () => {
    expect(acaoDoAtalho({ key: 'b', ctrl: false })).toBeNull();
    expect(acaoDoAtalho({ key: 'b', ctrl: true, shift: true })).toBeNull();
    expect(acaoDoAtalho({ key: 'k', ctrl: true, alt: true })).toBeNull();
    expect(acaoDoAtalho({ key: 'j', ctrl: true })).toBeNull();
  });

  it('com o foco num campo de texto o atalho fica com o campo', () => {
    expect(acaoDoAtalho({ key: 'b', ctrl: true, alvo: { tagName: 'INPUT', type: 'text' } })).toBeNull();
    expect(acaoDoAtalho({ key: 'k', ctrl: true, alvo: { tagName: 'textarea' } })).toBeNull();
    expect(acaoDoAtalho({ key: 'b', ctrl: true, alvo: { tagName: 'DIV', isContentEditable: true } })).toBeNull();
    // Num botão ou numa caixa de marcar ele vale.
    expect(acaoDoAtalho({ key: 'b', ctrl: true, alvo: { tagName: 'BUTTON' } })).toBe('alternar-barra');
    expect(acaoDoAtalho({ key: 'k', ctrl: true, alvo: { tagName: 'INPUT', type: 'checkbox' } })).toBe('buscar');
  });
});

describe('focoEmCampo', () => {
  it.each([
    [{ tagName: 'INPUT' }, true],
    [{ tagName: 'INPUT', type: 'search' }, true],
    [{ tagName: 'INPUT', type: 'email' }, true],
    [{ tagName: 'SELECT' }, true],
    [{ tagName: 'INPUT', type: 'radio' }, false],
    [{ tagName: 'A' }, false],
    [null, false],
  ])('%o → %s', (alvo, esperado) => expect(focoEmCampo(alvo)).toBe(esperado));
});

describe('rótulo do atalho por plataforma', () => {
  it('Ctrl+ fora do Mac e ⌘ no Mac', () => {
    expect(rotuloDoAtalho('k', false)).toBe('Ctrl+K');
    expect(rotuloDoAtalho('b', true)).toBe('⌘B');
  });

  it('detecta a Apple pela plataforma; vazio não é Mac', () => {
    expect(ehMac('MacIntel')).toBe(true);
    expect(ehMac('iPad')).toBe(true);
    expect(ehMac('Win32')).toBe(false);
    expect(ehMac(undefined)).toBe(false);
  });
});
