import { erroDoLink, linkExternoSeguro, linkParaAbrir, TAMANHO_MAXIMO_LINK } from './links';

describe('link externo', () => {
  it('aceita https de qualquer host', () => {
    expect(linkExternoSeguro('https://heavysuppz.com/produtos/creatina/')).toBe(true);
    expect(linkExternoSeguro('  https://loja.exemplo.com.br:443/p?id=1#topo ')).toBe(true);
    expect(linkParaAbrir('  https://exemplo.com/x  ')).toBe('https://exemplo.com/x');
  });

  it('recusa o que não for https sem credenciais', () => {
    for (const ruim of [
      'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,oi', 'http://exemplo.com/x', 'ftp://exemplo.com/x',
      '//exemplo.com/x', 'exemplo.com/x', 'https://usuario@exemplo.com/x', 'https://usuario:senha@exemplo.com/x',
      'https:///sem-host', 'https://exemplo.com:8443/x', 'https://exemplo.com\\@evil.com', 'https://', 'https:exemplo.com',
      '', '   ',
    ]) {
      expect(linkExternoSeguro(ruim)).toBe(false);
      expect(linkParaAbrir(ruim)).toBeNull();
    }
    expect(linkExternoSeguro(null)).toBe(false);
    expect(linkExternoSeguro(undefined)).toBe(false);
  });

  it('recusa link acima do limite da API', () => {
    expect(linkExternoSeguro('https://exemplo.com/' + 'a'.repeat(TAMANHO_MAXIMO_LINK))).toBe(false);
    expect(linkExternoSeguro('https://exemplo.com/' + 'a'.repeat(TAMANHO_MAXIMO_LINK - 20))).toBe(true);
  });

  it('mensagem do campo: vazio vale, ruim reclama', () => {
    expect(erroDoLink('')).toBeNull();
    expect(erroDoLink(null)).toBeNull();
    expect(erroDoLink('https://exemplo.com/x')).toBeNull();
    expect(erroDoLink('http://exemplo.com/x')).toBe('Use um link https completo.');
  });
});
