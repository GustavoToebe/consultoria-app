import { PALETAS as CORES_DA_MARCA } from '../dominio/paletas';
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
  luminancia,
  marcaAoPassar,
  marcaParaPeca,
  marcaParaTexto,
  textoSobre,
  tingido,
  type Cores,
} from './tokens';
import { variaveisDoTema } from './variaveis';

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
  // A borda aparece também direto na página. Era 1,8 quando o fundo claro era quase branco e só ela marcava o bloco; desde
  // 12/11 quem separa o cartão da página nas claras é o tom (trava abaixo), e o fundo tingido levou o piso a 1,7.
  expect(contraste(cores.borda, cores.fundo)).toBeGreaterThanOrEqual(1.7);
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

// ---- Visual de 11/11 (guia em PDF, págs. 4, 5, 6, 12 e 13) ----

describe('pares medidos do guia na paleta de partida (Escuro)', () => {
  it('texto, texto secundário e borda de campo dão o que o guia mediu', () => {
    expect(contraste(ESCURO.texto, ESCURO.superficie)).toBeCloseTo(16.12, 1);
    expect(contraste(ESCURO.textoSuave, ESCURO.superficie2)).toBeCloseTo(7.79, 1);
    expect(contraste(ESCURO.bordaCampo, ESCURO.superficie)).toBeCloseTo(4.66, 1);
    expect(contraste(ESCURO.sucesso, ESCURO.sucessoSuave)).toBeCloseTo(7.99, 1);
    expect(contraste(ESCURO.atencao, ESCURO.atencaoSuave)).toBeCloseTo(8.5, 1);
    expect(contraste('#FFFFFF', '#C62828')).toBeCloseTo(5.62, 1);
  });
  it('o painel do conteúdo é o #101013 do guia', () => {
    expect(ESCURO.painel).toBe('#101013');
  });
});

it.each(TODAS)('%s: o painel do conteúdo fica entre o fundo (menu) e o cartão', (_codigo, cores, escuro) => {
  if (!escuro) {
    // Nas claras o conteúdo fica no próprio fundo tingido (12/11): é dele que o cartão branco se destaca.
    expect(cores.painel).toBe(cores.fundo);
    return;
  }
  const [l, f, s] = [luminancia(cores.painel), luminancia(cores.fundo), luminancia(cores.superficie)];
  expect(l).toBeGreaterThan(Math.min(f, s));
  expect(l).toBeLessThan(Math.max(f, s));
});

/**
 * Separação das superfícies nas paletas claras (12/11, `docs/planos/superficies-das-paletas-claras.md`): o cartão e o
 * campo brancos se destacam da página pelo tom (sem sombra), e o contorno do campo é bem mais forte que o do cartão.
 * Pisos, não valores exatos: qualquer ajuste de tom que mantenha a separação passa.
 */
it.each(TODAS.filter(([, , escuro]) => !escuro))('%s: cartão e campo se destacam da página; o campo tem contorno mais forte que o cartão', (_codigo, cores) => {
  for (const pagina of [cores.fundo, cores.painel]) {
    expect(contraste(cores.superficie, pagina)).toBeGreaterThanOrEqual(1.1);
    expect(contraste(cores.campo, pagina)).toBeGreaterThanOrEqual(1.1);
  }
  expect(contraste(cores.bordaCampo, cores.superficie)).toBeGreaterThanOrEqual(2 * contraste(cores.divisor, cores.superficie));
  // A faixa do título e as linhas (`superficie2`) ficam entre a página e o cartão, sem se confundir com nenhum dos dois.
  expect(luminancia(cores.superficie2)).toBeGreaterThan(luminancia(cores.painel));
  expect(luminancia(cores.superficie2)).toBeLessThan(luminancia(cores.superficie));
  expect(contraste(cores.superficie2, cores.painel)).toBeGreaterThanOrEqual(1.04);
  expect(contraste(cores.superficie2, cores.superficie)).toBeGreaterThanOrEqual(1.04);
});

/** Pág. 12: os pares reais de cada paleta, com contraste alto e com bordas reforçadas. */
const VARIANTES: [string, Cores, boolean][] = TODAS.flatMap(([nome, base, escuro]) => [
  [nome, base, escuro],
  [`${nome} com contraste alto`, coresComContraste(base, 'ALTO', escuro), escuro],
  [`${nome} com bordas reforçadas`, coresComBordasReforcadas(base, true), escuro],
]) as [string, Cores, boolean][];

describe.each(VARIANTES)('medidas do guia (%s)', (_nome, cores) => {
  const superficies = [cores.fundo, cores.painel, cores.superficie, cores.superficie2, cores.superficie3];

  it('texto e texto secundário ≥ 4,5:1 em toda superfície (inclusive hover e seleção)', () => {
    for (const fundo of superficies) {
      expect(contraste(cores.texto, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.textoSuave, fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('borda de campo ≥ 3:1 contra o campo e o cartão vizinhos', () => {
    for (const fundo of [cores.campo, cores.superficie, cores.painel]) expect(contraste(cores.bordaCampo, fundo)).toBeGreaterThanOrEqual(3);
  });

  it('seleção neutra: o contorno do escolhido (bordaCampo) ≥ 3:1 contra a seleção e a trilha em volta', () => {
    for (const fundo of [cores.superficie3, cores.superficie2, cores.superficie]) expect(contraste(cores.bordaCampo, fundo)).toBeGreaterThanOrEqual(3);
  });

  it('anel de foco ≥ 3:1 sobre toda superfície e sobre o campo', () => {
    for (const fundo of [...superficies, cores.campo]) expect(contraste(cores.anelFoco, fundo)).toBeGreaterThanOrEqual(3);
  });

  it('texto do selo (a própria cor) ≥ 4,5:1 sobre o fundo suave da situação', () => {
    expect(contraste(cores.sucesso, cores.sucessoSuave)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.atencao, cores.atencaoSuave)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.perigo, cores.perigoSuave)).toBeGreaterThanOrEqual(4.5);
  });

  it('ponto do selo e ícone de situação ≥ 3:1 sobre o cartão e o fundo suave', () => {
    for (const [cor, suave] of [[cores.sucesso, cores.sucessoSuave], [cores.atencao, cores.atencaoSuave], [cores.perigo, cores.perigoSuave]]) {
      for (const fundo of [cores.superficie, cores.superficie2, suave]) expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe.each(TODAS)('as 12 cores da marca na paleta %s (pág. 6)', (_codigo, cores) => {
  it.each(CORES_DA_MARCA.map((p) => [p.nome, p.cor]))('%s: texto do botão, hover, peça e texto da marca', (_nome, marca) => {
    const sobre = textoSobre(marca);
    expect(contraste(sobre, marca)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(sobre, marcaAoPassar(marca))).toBeGreaterThanOrEqual(4.5);
    const peca = marcaParaPeca(marca, [cores.superficie3, cores.fundo, cores.painel, cores.superficie]);
    for (const fundo of [cores.superficie3, cores.fundo, cores.painel, cores.superficie]) expect(contraste(peca, fundo)).toBeGreaterThanOrEqual(3);
    expect(contraste(marcaParaTexto(marca, cores.superficie3), cores.superficie3)).toBeGreaterThanOrEqual(4.5);
  });
});

it('trocar a marca não muda nenhuma cor de situação nem de categoria (pág. 4)', () => {
  // A categoria (`coresDeIdentificacao`) nem recebe a marca: só a paleta e o modo.
  for (const { cores } of Object.values(PALETAS)) {
    const comNeutra = variaveisDoTema(cores, '#52525B');
    for (const { cor } of CORES_DA_MARCA) {
      const comMarca = variaveisDoTema(cores, cor);
      for (const chave of ['--color-sucesso', '--color-atencao', '--color-perigo', '--color-neutro', '--color-destructive'] as const) {
        expect(comMarca[chave]).toBe(comNeutra[chave]);
      }
    }
  }
});
