import { escLinhas } from './html';
import { htmlFormatadoNoPdf } from './textoFormatadoNoPdf';

describe('htmlFormatadoNoPdf', () => {
  it('negrito e sublinhado viram <strong> e <u>, também juntos', () => {
    expect(htmlFormatadoNoPdf('Beba **água**')).toBe('Beba <strong>água</strong>');
    expect(htmlFormatadoNoPdf('Sem __açúcar__')).toBe('Sem <u>açúcar</u>');
    expect(htmlFormatadoNoPdf('**__os dois__** e **só negrito**')).toBe('<strong><u>os dois</u></strong> e <strong>só negrito</strong>');
  });

  it('marcador sem fechamento, sem texto dentro ou atravessando a linha fica como texto', () => {
    expect(htmlFormatadoNoPdf('**começo sem fim')).toBe('**começo sem fim');
    expect(htmlFormatadoNoPdf('preencha ______')).toBe('preencha ______');
    expect(htmlFormatadoNoPdf('**começo\nfim**')).toBe('**começo<br>fim**');
  });

  it('escapa o HTML antes de formatar, dentro e fora das marcas', () => {
    expect(htmlFormatadoNoPdf('<script>alert(1)</script> & "a"')).toBe('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;a&quot;');
    expect(htmlFormatadoNoPdf('**<img src=x onerror=alert(1)>**')).toBe('<strong>&lt;img src=x onerror=alert(1)&gt;</strong>');
  });

  it('cada quebra de linha vira <br>, linha em branco inclusive', () => {
    expect(htmlFormatadoNoPdf('A\r\nB\n\nC')).toBe('A<br>B<br><br>C');
  });

  it('vazio ou nulo dá vazio', () => {
    expect(htmlFormatadoNoPdf('')).toBe('');
    expect(htmlFormatadoNoPdf(null)).toBe('');
    expect(htmlFormatadoNoPdf(undefined)).toBe('');
  });

  it('texto sem marcas sai igual ao escLinhas de antes', () => {
    for (const t of ['Beba água.', 'a\n\nb\r\nc', '  espaço  \n \n', "2 ** 3 e x__y & <i>'", '\n', 'só\r']) {
      expect(htmlFormatadoNoPdf(t)).toBe(escLinhas(t));
    }
  });
});
