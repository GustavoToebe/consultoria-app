import { coresComBordasReforcadas, coresComContraste } from '../dominio/preferencias';
import {
  CHAVES_DA_AGENDA,
  CHAVES_DE_IDENTIFICACAO,
  CLARO,
  ESCURO,
  PALETA_DA_AGENDA,
  PALETA_SO_DO_PERFIL,
  PALETAS,
  corDoTomDoPerfil,
  PALETA_DE_IDENTIFICACAO,
  contraste,
  corDaAgenda,
  coresDeIdentificacao,
  marcaParaTexto,
  textoSobre,
  tingido,
  type Cores,
} from './tokens';

/** Todas as paletas da marca (decisão 1 do plano `paletas-da-marca`): cada teste de contraste percorre a lista inteira. */
const TODAS: [string, Cores, boolean][] = Object.entries(PALETAS).map(([codigo, p]) => [codigo, p.cores, p.modo === 'ESCURO']);

it.each(TODAS)('%s: preserva contraste AA nos detalhes de todas as superfícies', (_codigo, cores) => {
  for (const superficie of [cores.superficie, cores.superficie2, cores.superficie3]) {
    expect(contraste(cores.textoSuave, superficie)).toBeGreaterThanOrEqual(4.5);
  }
});

it.each(TODAS)('%s: status e neutro servem de texto em todas as superfícies', (_codigo, cores) => {
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

it.each(TODAS.filter(([, , escuro]) => escuro))('%s: o item (superficie2) se distingue do cartão, para o trilho das barras de progresso aparecer dentro dele', (_codigo, cores) => {
  expect(cores.superficie2).not.toBe(cores.superficie);
  expect(contraste(cores.superficie2, cores.superficie)).toBeGreaterThanOrEqual(1.05);
});

it.each(TODAS)('%s: campo, borda e cartão se distinguem do fundo e entre si', (_codigo, cores) => {
  expect(contraste(cores.bordaCampo, cores.campo)).toBeGreaterThanOrEqual(3);
  // Reunião de 29/10: a borda do cartão tem de aparecer (1,9:1 ou mais), também sobre a faixa do cabeçalho.
  expect(contraste(cores.borda, cores.superficie)).toBeGreaterThanOrEqual(1.9);
  expect(contraste(cores.borda, cores.superficie3)).toBeGreaterThanOrEqual(1.25);
  // Fundo quase branco (30/10): o cartão branco quase some contra ele; quem marca o bloco é a borda e a faixa do título.
  expect(contraste(cores.borda, cores.fundo)).toBeGreaterThanOrEqual(1.8);
  expect(contraste(cores.superficie3, cores.fundo)).toBeGreaterThanOrEqual(1.1);
  expect(contraste(cores.faixaForte, cores.superficie)).toBeGreaterThan(contraste(cores.superficie3, cores.superficie));
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

describe.each(TODAS)('paleta das agendas (%s)', (_codigo, cores, escuro) => {
  const paleta = PALETA_DA_AGENDA[escuro ? 'escuro' : 'claro'];

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

// ---- Cores só do perfil da Comunidade (laranja, 10/11) ----

describe.each(TODAS)('cores só do perfil (%s)', (_codigo, base, escuro) => {
  const paleta = PALETA_SO_DO_PERFIL[escuro ? 'escuro' : 'claro'];
  const agendas = PALETA_DA_AGENDA[escuro ? 'escuro' : 'claro'];
  // O contraste alto mexe só em borda, divisor e texto suave: as superfícies são as mesmas, e o anel continua passando.
  const variantes = [base, coresComContraste(base, 'ALTO', escuro), coresComBordasReforcadas(coresComContraste(base, 'ALTO', escuro), true)];

  it('anel e amostra (marcador) ≥ 3:1 sobre o fundo e as três superfícies, também no contraste alto', () => {
    for (const cores of variantes) {
      for (const hex of Object.values(paleta)) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
        for (const fundo of [cores.fundo, cores.superficie, cores.superficie2, cores.superficie3]) expect(contraste(hex, fundo)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('no escuro também serve de texto e ícone (≥ 4,5:1); no claro fica só de marcador', () => {
    if (!escuro) return;
    for (const hex of Object.values(paleta)) {
      for (const fundo of [base.fundo, base.superficie, base.superficie2, base.superficie3]) expect(contraste(hex, fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('não parece status nem nenhuma das oito agendas', () => {
    for (const hex of Object.values(paleta)) {
      for (const status of [base.sucesso, base.atencao, base.perigo]) expect(distanciaDeCor(hex, status)).toBeGreaterThanOrEqual(DISTANCIA_DO_STATUS);
      for (const agenda of Object.values(agendas)) expect(distanciaDeCor(hex, agenda)).toBeGreaterThanOrEqual(DISTANCIA_ENTRE_AGENDAS);
    }
  });
});

describe('corDoTomDoPerfil', () => {
  it('o laranja sai da paleta só do perfil; o resto, da das agendas, sem mudar valor nenhum delas', () => {
    expect(corDoTomDoPerfil('LARANJA', false)).toBe(PALETA_SO_DO_PERFIL.claro.LARANJA);
    expect(corDoTomDoPerfil('LARANJA', true)).toBe(PALETA_SO_DO_PERFIL.escuro.LARANJA);
    expect(corDoTomDoPerfil('OLIVA', true)).toBe(PALETA_DA_AGENDA.escuro.OLIVA);
    expect(corDoTomDoPerfil('TERRA', false)).toBe('#A64F43');
    expect(CHAVES_DA_AGENDA).not.toContain('LARANJA');
  });
});

/** Mistura `cor` com alfa 0x18 sobre `fundo`, como o fundo da caixa `Alerta` (`${cor}18`). */
function fundoDoAlerta(cor: string, fundo: string): string {
  const a = 0x18 / 255;
  const canal = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(canal(cor, i) * a + canal(fundo, i) * (1 - a)).toString(16).padStart(2, '0')).join('')}`;
}

test.each(TODAS)(
  'texto da caixa de aviso (perigo, atenção, sucesso) legível sobre o próprio fundo no tema %s',
  (_nome, cores) => {
    for (const tom of ['perigo', 'atencao', 'sucesso'] as const) {
      for (const base of [cores.superficie, cores.fundo]) {
        expect(contraste(cores[tom], fundoDoAlerta(cores[tom], base))).toBeGreaterThanOrEqual(4.5);
      }
    }
  },
);

test.each(TODAS)(
  'selo com ícone (Pronta, Atenção, Corrigir): texto legível sobre o fundo opaco, em qualquer faixa, no tema %s',
  (_nome, cores) => {
    for (const tom of ['perigo', 'atencao', 'sucesso'] as const) {
      expect(contraste(cores[tom], tingido(cores[tom], cores.superficie))).toBeGreaterThanOrEqual(4.5);
    }
  },
);

// ---- Cores de identificação: tipo de série, divisão e refeição (Frente G, D6, D9 a D14) ----

/** Os três temas, cada um também com contraste alto e com bordas reforçadas (que não podem derrubar o contraste). */
const TEMAS_DA_IDENTIFICACAO: [string, Cores, boolean][] = TODAS.flatMap(([nome, base, escuro]) => [
  [nome as string, base as Cores, escuro as boolean],
  [`${nome} com contraste alto`, coresComContraste(base as Cores, 'ALTO', escuro as boolean), escuro as boolean],
  [`${nome} com bordas reforçadas`, coresComBordasReforcadas(base as Cores, true), escuro as boolean],
]) as [string, Cores, boolean][];

/** Mais longe do status que a paleta das agendas: o tipo de série aparece ao lado dos selos Pronta/Atenção/Corrigir. */
const DISTANCIA_DA_IDENTIFICACAO_AO_STATUS = 40;
/** Do cinza "encerrado" (neutro): ardósia ficou de fora da paleta por ficar perto dele. */
const DISTANCIA_DA_IDENTIFICACAO_AO_NEUTRO = 20;

describe.each(TEMAS_DA_IDENTIFICACAO)('cores de identificação (%s)', (_nome, cores, escuro) => {
  const identificacao = coresDeIdentificacao(cores, escuro);

  it('tem as cinco chaves, todas #RRGGBB, e o tom vem da paleta do modo', () => {
    expect(Object.keys(identificacao).sort()).toEqual([...CHAVES_DE_IDENTIFICACAO].sort());
    for (const chave of CHAVES_DE_IDENTIFICACAO) {
      expect(identificacao[chave].cor).toBe(PALETA_DE_IDENTIFICACAO[escuro ? 'escuro' : 'claro'][chave]);
      expect(identificacao[chave].cor).toMatch(/^#[0-9A-F]{6}$/);
      expect(identificacao[chave].fundo).toBe(tingido(identificacao[chave].cor, cores.superficie));
    }
  });

  it('serve de texto (4,5:1) sobre superficie, superficie2, superficie3 e o fundo do próprio selo', () => {
    for (const chave of CHAVES_DE_IDENTIFICACAO) {
      const { cor, fundo } = identificacao[chave];
      for (const base of [cores.superficie, cores.superficie2, cores.superficie3, fundo]) {
        expect(contraste(cor, base)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('a barra lateral aparece (3:1) também sobre a faixa forte do exercício', () => {
    for (const chave of CHAVES_DE_IDENTIFICACAO) {
      expect(contraste(identificacao[chave].cor, cores.faixaForte)).toBeGreaterThanOrEqual(3);
    }
  });

  it('nenhuma se parece com sucesso, atenção, perigo nem com o cinza neutro (cor não diz status)', () => {
    for (const chave of CHAVES_DE_IDENTIFICACAO) {
      const { cor } = identificacao[chave];
      for (const status of [cores.sucesso, cores.atencao, cores.perigo, cores.perigoFundo]) {
        expect(distanciaDeCor(cor, status)).toBeGreaterThanOrEqual(DISTANCIA_DA_IDENTIFICACAO_AO_STATUS);
      }
      expect(distanciaDeCor(cor, cores.neutro)).toBeGreaterThanOrEqual(DISTANCIA_DA_IDENTIFICACAO_AO_NEUTRO);
      expect(distanciaDeCor(cor, cores.textoSuave)).toBeGreaterThanOrEqual(DISTANCIA_DA_IDENTIFICACAO_AO_NEUTRO);
    }
  });

  it('as cinco se distinguem entre si', () => {
    for (let i = 0; i < CHAVES_DE_IDENTIFICACAO.length; i++) {
      for (let j = i + 1; j < CHAVES_DE_IDENTIFICACAO.length; j++) {
        const a = identificacao[CHAVES_DE_IDENTIFICACAO[i]].cor;
        const b = identificacao[CHAVES_DE_IDENTIFICACAO[j]].cor;
        expect(distanciaDeCor(a, b)).toBeGreaterThanOrEqual(DISTANCIA_ENTRE_AGENDAS);
      }
    }
  });
});
