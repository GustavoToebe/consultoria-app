import { base64DeTexto } from './base64';

describe('base64DeTexto', () => {
  it.each([
    ['vazio', ''],
    ['sem sinal de igual (3 bytes)', 'abc'],
    ['um sinal de igual (2 bytes)', 'ab'],
    ['dois sinais de igual (1 byte)', 'a'],
    ['acentos', 'Evolução: Braço direito · avaliação'],
    ['menos U+2212 e ponto médio', '−4,5 cm · +1,2 cm'],
    ['emoji (4 bytes)', 'x😀y'],
    ['marcação do SVG', '<svg xmlns="http://www.w3.org/2000/svg"><text>&lt;b&gt; &#39;</text></svg>'],
  ])('igual ao Buffer: %s', (_nome, texto) => {
    expect(base64DeTexto(texto)).toBe(Buffer.from(texto, 'utf8').toString('base64'));
  });

  it('comprimentos de 0 a 12 bytes batem com o Buffer, e o preenchimento é o esperado', () => {
    for (let n = 0; n <= 12; n++) {
      const texto = 'Zé'.repeat(n).slice(0, n);
      expect(base64DeTexto(texto)).toBe(Buffer.from(texto, 'utf8').toString('base64'));
    }
    expect(base64DeTexto('abc')).not.toContain('=');
    expect(base64DeTexto('ab').endsWith('=')).toBe(true);
    expect(base64DeTexto('a').endsWith('==')).toBe(true);
  });

  it('par substituto solto vira U+FFFD, sem lançar', () => {
    expect(base64DeTexto('a\ud800b')).toBe(Buffer.from('a�b', 'utf8').toString('base64'));
  });

  it('só devolve o alfabeto base64', () => {
    expect(base64DeTexto('ção ~~~ ??? −·')).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });
});
