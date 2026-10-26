import { CLARO, ESCURO, contraste, marcaParaTexto, textoSobre } from './tokens';

it.each([CLARO, ESCURO])('preserva contraste AA nos detalhes de todas as superfícies', (cores) => {
  for (const superficie of [cores.superficie, cores.superficie2, cores.superficie3]) {
    expect(contraste(cores.textoSuave, superficie)).toBeGreaterThanOrEqual(4.5);
  }
});

it.each([CLARO, ESCURO])('status e neutro servem de texto em todas as superfícies', (cores) => {
  for (const cor of [cores.sucesso, cores.atencao, cores.perigo, cores.neutro]) {
    for (const superficie of [cores.superficie, cores.superficie2, cores.superficie3]) {
      expect(contraste(cor, superficie)).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(contraste('#FFFFFF', cores.perigoFundo)).toBeGreaterThanOrEqual(4.5);
  expect(cores.anelFoco).toBe(cores.texto);
  for (const fase of [cores.fase1, cores.fase2, cores.fase3, cores.fase4]) {
    expect(contraste(fase, cores.superficie)).toBeGreaterThanOrEqual(3);
    expect(contraste(fase, cores.perigo)).toBeGreaterThan(1.4);
    expect(contraste('#FFFFFF', fase) >= 4.5 || contraste('#111114', fase) >= 4.5).toBe(true);
  }
});

describe('marcaParaTexto', () => {
  it('mantém a cor que já contrasta e clareia ou escurece a que não contrasta', () => {
    expect(marcaParaTexto('#FACC15', ESCURO.fundo)).toBe('#FACC15');
    expect(marcaParaTexto('#C62828', CLARO.superficie)).toBe('#C62828');
    for (const marca of ['#C62828', '#2563EB', '#52525B', '#7C3AED', '#E5484D']) {
      expect(contraste(marcaParaTexto(marca, ESCURO.superficie), ESCURO.superficie)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(marcaParaTexto(marca, CLARO.superficie), CLARO.superficie)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('devolve o texto como veio quando não é #RRGGBB', () => {
    expect(marcaParaTexto('vermelho', ESCURO.fundo)).toBe('vermelho');
  });
});

it.each([CLARO, ESCURO])('campo, borda e cartão se distinguem do fundo e entre si', (cores) => {
  expect(contraste(cores.bordaCampo, cores.campo)).toBeGreaterThanOrEqual(3);
  expect(contraste(cores.borda, cores.superficie)).toBeGreaterThanOrEqual(1.4);
  expect(contraste(cores.fundo, cores.superficie)).toBeGreaterThanOrEqual(1.1);
});

describe('contraste do texto sobre a cor da marca', () => {
  it('usa branco em cores escuras e preto em cores claras', () => {
    expect(textoSobre('#C62828')).toBe('#FFFFFF');
    expect(textoSobre('#2563EB')).toBe('#FFFFFF');
    expect(textoSobre('#FACC15')).toBe('#000000');
    expect(textoSobre('#FFFFFF')).toBe('#000000');
  });

  it('calcula o contraste WCAG', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contraste('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});
