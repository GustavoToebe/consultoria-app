import { AREIA, CHAVES_DA_AGENDA, CLARO, ESCURO, PALETA_DA_AGENDA, contraste, corDaAgenda, marcaParaTexto, textoSobre } from './tokens';

it.each([CLARO, ESCURO, AREIA])('preserva contraste AA nos detalhes de todas as superfícies', (cores) => {
  for (const superficie of [cores.superficie, cores.superficie2, cores.superficie3]) {
    expect(contraste(cores.textoSuave, superficie)).toBeGreaterThanOrEqual(4.5);
  }
});

it.each([CLARO, ESCURO, AREIA])('status e neutro servem de texto em todas as superfícies', (cores) => {
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

it.each([CLARO, ESCURO, AREIA])('campo, borda e cartão se distinguem do fundo e entre si', (cores) => {
  expect(contraste(cores.bordaCampo, cores.campo)).toBeGreaterThanOrEqual(3);
  // Reunião de 29/10: a borda do cartão tem de aparecer (1,9:1 ou mais), também sobre a faixa do cabeçalho.
  expect(contraste(cores.borda, cores.superficie)).toBeGreaterThanOrEqual(1.9);
  expect(contraste(cores.borda, cores.superficie3)).toBeGreaterThanOrEqual(1.25);
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

// ---- Paleta das agendas (D7) ----

/** CIELAB (D65) de uma cor #RRGGBB, só para medir "parecida com" nos testes. */
function lab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const distanciaDeCor = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

/** Distâncias mínimas (ΔE CIE76): da cor de status e entre duas cores da paleta. */
const DISTANCIA_DO_STATUS = 25;
const DISTANCIA_ENTRE_AGENDAS = 15;

describe.each([['claro', CLARO], ['escuro', ESCURO]] as const)('paleta das agendas (%s)', (tema, cores) => {
  const paleta = PALETA_DA_AGENDA[tema];

  it('tem as oito chaves da API, todas #RRGGBB', () => {
    expect(Object.keys(paleta).sort()).toEqual([...CHAVES_DA_AGENDA].sort());
    expect(CHAVES_DA_AGENDA).toHaveLength(8);
    for (const hex of Object.values(paleta)) expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('o marcador tem ao menos 3:1 sobre o fundo e as três superfícies', () => {
    for (const chave of CHAVES_DA_AGENDA) {
      for (const fundo of [cores.fundo, cores.superficie, cores.superficie2, cores.superficie3]) {
        expect(contraste(paleta[chave], fundo)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('nenhuma é parecida com sucesso, atenção ou perigo', () => {
    for (const chave of CHAVES_DA_AGENDA) {
      for (const status of [cores.sucesso, cores.atencao, cores.perigo]) {
        expect(distanciaDeCor(paleta[chave], status)).toBeGreaterThanOrEqual(DISTANCIA_DO_STATUS);
      }
    }
  });

  it('as oito se distinguem entre si (a cor identifica a agenda)', () => {
    for (let i = 0; i < CHAVES_DA_AGENDA.length; i++) {
      for (let j = i + 1; j < CHAVES_DA_AGENDA.length; j++) {
        expect(distanciaDeCor(paleta[CHAVES_DA_AGENDA[i]], paleta[CHAVES_DA_AGENDA[j]])).toBeGreaterThanOrEqual(DISTANCIA_ENTRE_AGENDAS);
      }
    }
  });
});

describe('corDaAgenda', () => {
  it('escolhe o par pelo tema; chave desconhecida ou nula cai em ARDOSIA', () => {
    expect(corDaAgenda('AZUL', false)).toBe(PALETA_DA_AGENDA.claro.AZUL);
    expect(corDaAgenda('AZUL', true)).toBe(PALETA_DA_AGENDA.escuro.AZUL);
    expect(corDaAgenda('ROSA', true)).toBe(PALETA_DA_AGENDA.escuro.ARDOSIA);
    expect(corDaAgenda(null, false)).toBe(PALETA_DA_AGENDA.claro.ARDOSIA);
  });
});

/** Mistura `cor` com alfa 0x18 sobre `fundo`, como o fundo da caixa `Alerta` (`${cor}18`). */
function fundoDoAlerta(cor: string, fundo: string): string {
  const a = 0x18 / 255;
  const canal = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(canal(cor, i) * a + canal(fundo, i) * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
}

test.each([['claro', CLARO], ['escuro', ESCURO], ['areia', AREIA]] as const)(
  'texto da caixa de aviso (perigo, atenção, sucesso) legível sobre o próprio fundo no tema %s',
  (_nome, cores) => {
    for (const tom of ['perigo', 'atencao', 'sucesso'] as const) {
      for (const base of [cores.superficie, cores.fundo]) {
        expect(contraste(cores[tom], fundoDoAlerta(cores[tom], base))).toBeGreaterThanOrEqual(4.5);
      }
    }
  },
);
