import type { CorDaAgenda } from '../api/agendaTipos';
import type { Tema } from '../api/tipos';
import type { FuncaoDeDestaque } from '../dominio/destaque';

/**
 * Visual de 11/11 (prévia `docs/prototipos/visual-vendavel/` + guia em PDF; resumo em
 * `docs/planos/visual-vendavel/guia-premium-no-app.md`): flat, sem sombra nem gradiente, contorno de 1 px (2 px com
 * "bordas reforçadas"), raio 8 nos controles (`RAIO_CONTROLE`) e 12 nos cartões (`RAIO`), grade de 8 px, fonte Geist.
 *
 * Três famílias de cor que não se misturam: **marca** (logo, pequeno indicador do item ativo, ação principal; papéis
 * calculados no `TemaProvider`), **situação** (`sucesso`, `atencao`, `perigo`, `neutro`, com o fundo `*Suave` do selo;
 * fixas no tema, nunca derivadas da marca, sempre com texto) e **categoria** (`PALETA_DE_IDENTIFICACAO`: tipo de série,
 * divisão, refeição). Seleção é neutra (`ui/selecao.ts`). Tabela situação → cor: `docs/design-e-front.md`, seção 4.5.
 *
 * Superfícies: `fundo` (menu e página) → `painel` (área do conteúdo no PC) → `superficie` (cartão, contorno `divisor`,
 * discreto) → `superficie2` (elevada: menus, apoio, hover) → `superficie3` (seleção neutra: fundo do item escolhido).
 * Campo de digitar = `campo` + `bordaCampo` (≥ 3:1): campo, foco e seleção têm contorno forte; contêiner, discreto.
 */
export interface Cores {
  fundo: string;
  superficie: string;
  superficie2: string;
  superficie3: string;
  divisor: string;
  borda: string;
  /**
   * Faixa de título do bloco principal de uma tela densa (o exercício no editor de treino): um tom mais forte que
   * `superficie3`, para o exercício se destacar das faixas de dentro dele (protótipo de 30/10).
   */
  faixaForte: string;
  /** Fundo de campo de digitar. */
  campo: string;
  /** Borda de campo de digitar (≥ 3:1 sobre `campo`, WCAG 1.4.11). */
  bordaCampo: string;
  /**
   * Área do conteúdo ao lado do menu no PC (o menu fica no `fundo`): no escuro, 45% do caminho do fundo ao cartão; nas
   * claras, o próprio `fundo` tingido, para o cartão e o campo brancos se destacarem dele (12/11).
   */
  painel: string;
  texto: string;
  textoSuave: string;
  /** Status como texto e borda (≥ 4,5:1 sobre `superficie`, `superficie2` e `superficie3`). */
  sucesso: string;
  atencao: string;
  perigo: string;
  neutro: string;
  /** Fundo do selo de cada situação: o texto do selo é a própria cor da situação (≥ 4,5:1 sobre ele). */
  sucessoSuave: string;
  atencaoSuave: string;
  perigoSuave: string;
  /** Fundo do botão destrutivo preenchido (texto branco ≥ 4,5:1); o `perigo` claro do tema escuro não serve de fundo. */
  perigoFundo: string;
  /** Anel de foco do teclado: a cor do texto (≥ 4,5:1 em qualquer superfície), nunca a da marca. */
  anelFoco: string;
  /** Fases do ciclo (faixa e calendário). Não são a cor da marca nem o vermelho de erro. */
  fase1: string;
  fase2: string;
  fase3: string;
  fase4: string;
}

export const ESCURO: Cores = {
  fundo: '#09090B',
  superficie: '#141416',
  superficie2: '#0B0B0D',
  superficie3: '#202024',
  faixaForte: '#28282E',
  divisor: '#232326',
  borda: '#4A4A52',
  campo: '#0B0B0D',
  bordaCampo: '#82828C',
  painel: '#0E0E10',
  texto: '#FCFCFC',
  textoSuave: '#9A9AA1',
  sucesso: '#4ADE80',
  atencao: '#FBBF24',
  // O guia propõe #FB7185; fica um passo mais vermelho para não se confundir com o magenta da categoria (ΔE ≥ 40 em `tokens.test.ts`).
  perigo: '#FA717B',
  neutro: '#9A9AA3',
  sucessoSuave: '#143222',
  atencaoSuave: '#352915',
  perigoSuave: '#3B1C26',
  perigoFundo: '#C62828',
  anelFoco: '#FCFCFC',
  // Rosa e lavanda um pouco mais claros que antes: o `perigo` novo é mais claro e a fase não pode parecer erro.
  fase1: '#E7AEC1',
  fase2: '#7DCFC6',
  fase3: '#E2C56A',
  fase4: '#ADBAEB',
};

export const CLARO: Cores = {
  // STNDRD White Minimalist + Neon: cartão sempre #FFFFFF puro, poço rebaixado (#EAECEF) e pílula (#F4F4F6).
  fundo: '#F3F4F6',
  superficie: '#FFFFFF',
  superficie2: '#EAECEF',
  superficie3: '#FFFFFF',
  faixaForte: '#DCDCE0',
  divisor: '#E4E4E7',
  borda: '#B4B4BC',
  campo: '#EAECEF',
  bordaCampo: '#71717A',
  painel: '#F3F4F6',
  texto: '#09090B',
  textoSuave: '#52525B',
  sucesso: '#125C32',
  atencao: '#875710',
  perigo: '#B71C1C',
  neutro: '#616169',
  sucessoSuave: tingido('#125C32', '#FFFFFF'),
  atencaoSuave: tingido('#875710', '#FFFFFF'),
  perigoSuave: tingido('#B71C1C', '#FFFFFF'),
  perigoFundo: '#B71C1C',
  anelFoco: '#09090B',
  fase1: '#C46B86',
  fase2: '#5E8F8A',
  fase3: '#A67C2E',
  fase4: '#7A86C4',
};

/**
 * Claro Areia (STNDRD White Minimalist): cartão Nível 1 sempre #FFFFFF puro, fundo #F4F1EA e poço #ECE7DD.
 */
export const AREIA: Cores = {
  ...CLARO,
  fundo: '#F4F1EA',
  painel: '#F4F1EA',
  superficie: '#FFFFFF',
  superficie2: '#ECE7DD',
  superficie3: '#FFFFFF',
  faixaForte: '#DDD6C7',
  divisor: '#E5DFD3',
  borda: '#B0A899',
  campo: '#ECE7DD',
  bordaCampo: '#6E6659',
};

/** Modo de uma paleta: decide a barra de status e o esquema do Uniwind. */
export type ModoDoTema = 'ESCURO' | 'CLARO';

/**
 * Variante das cores fixas (agenda, perfil, identificação, destaque), que ficam fora de `Cores`: `claro` e `escuro` seguem o
 * modo; `areia` é a do "Claro areia", cujas superfícies mais escuras pedem as mesmas cores um passo mais escuras. Vem da
 * paleta em uso (`PALETAS[...].variante`, `useTema().variante`): nenhuma tela decide a cor por conta própria.
 */
export type VarianteDoTema = 'claro' | 'areia' | 'escuro';

/**
 * Paleta escura a partir do "chão" dela: texto e situação do Escuro (fixos, nunca da marca), `painel` a 45% do fundo ao
 * cartão (a mesma regra que dá o #101013 do Escuro) e fundos dos selos tingidos sobre o cartão dela (os do Escuro são os
 * pares do guia).
 */
function paletaEscura(chao: Pick<Cores, 'fundo' | 'superficie' | 'superficie2' | 'superficie3' | 'faixaForte' | 'divisor' | 'borda' | 'campo' | 'bordaCampo'>): Cores {
  return {
    ...ESCURO,
    ...chao,
    painel: misturar(chao.fundo, chao.superficie, 0.45),
    sucessoSuave: tingido(ESCURO.sucesso, chao.superficie),
    atencaoSuave: tingido(ESCURO.atencao, chao.superficie),
    perigoSuave: tingido(ESCURO.perigo, chao.superficie),
  };
}

/**
 * Paletas da marca (`docs/planos/paletas-da-marca.md`, decisão 1 de 03/11): a consultoria escolhe uma da lista em Marca.
 * A paleta muda só o "chão" (fundo, cartão, faixas, divisor, bordas e campo); texto, status, fases e foco são os do Escuro
 * ou do Claro. Valores literais, calculados uma vez pela prévia `docs/prototipos/paletas-da-marca.html` (item = 40% do caminho do cartão ao fundo, mais escuro que o cartão: o trilho das barras de progresso aparece dentro dele, e um item mais claro faria a série feita (verde translúcido) cair abaixo de 4,5:1 no Oceano;
 * faixa no tom mais claro em que texto e status passam 4,5:1; `faixaForte` = faixa + 0,03 de mistura com branco, escolha
 * deste passo porque a prévia não calcula esse tom). Nas claras o cartão é branco e o segundo tom da paleta é a faixa.
 */
export const MEIA_NOITE: Cores = paletaEscura({
  fundo: '#080C14',
  superficie: '#111722',
  superficie2: '#060910',
  superficie3: '#1A2333',
  faixaForte: '#232E42',
  divisor: '#1E293B',
  borda: '#49566B',
  campo: '#060910',
  bordaCampo: '#7B879B',
});

export const AMEIXA: Cores = paletaEscura({
  fundo: '#0D0914',
  superficie: '#161122',
  superficie2: '#08050D',
  superficie3: '#221A33',
  faixaForte: '#2B2240',
  divisor: '#281E3C',
  borda: '#514766',
  campo: '#08050D',
  bordaCampo: '#817796',
});

export const OCEANO: Cores = paletaEscura({
  fundo: '#071014',
  superficie: '#0F1B22',
  superficie2: '#050B0E',
  superficie3: '#172832',
  faixaForte: '#1F3440',
  divisor: '#1B303C',
  borda: '#475C68',
  campo: '#050B0E',
  bordaCampo: '#778A95',
});

/** Mantido apenas como alias retrocompatível; não é mais exibido na seleção de Marca/Ajustes. */
export const CAFE: Cores = ESCURO;

export const LAVANDA: Cores = {
  ...CLARO,
  fundo: '#F3F0FA',
  painel: '#F3F0FA',
  superficie: '#FFFFFF',
  superficie2: '#EAE5F5',
  superficie3: '#FFFFFF',
  faixaForte: '#D6CEE8',
  divisor: '#E2DCF0',
  borda: '#B0A8C4',
  campo: '#EAE5F5',
  bordaCampo: '#706884',
};
export const CEU: Cores = {
  ...CLARO,
  fundo: '#EEF4FA',
  painel: '#EEF4FA',
  superficie: '#FFFFFF',
  superficie2: '#E4EDF7',
  superficie3: '#FFFFFF',
  faixaForte: '#CEDCEB',
  divisor: '#DAE4F0',
  borda: '#A6B5C7',
  campo: '#E4EDF7',
  bordaCampo: '#67778A',
};
export const ROSA: Cores = {
  ...CLARO,
  fundo: '#FAF0F4',
  painel: '#FAF0F4',
  superficie: '#FFFFFF',
  superficie2: '#F5E5EC',
  superficie3: '#FFFFFF',
  faixaForte: '#E6CFD9',
  divisor: '#F0DCE5',
  borda: '#C2A5B3',
  campo: '#F5E5EC',
  bordaCampo: '#806472',
};

/** Código da paleta (= `Tema` da API, o `temaPadrao` da consultoria) → nome na tela, cores e modo. Fonte única do modo. */
export const PALETAS: Record<Tema, { nome: string; cores: Cores; modo: ModoDoTema; variante: VarianteDoTema }> = {
  ESCURO: { nome: 'Escuro', cores: ESCURO, modo: 'ESCURO', variante: 'escuro' },
  MEIA_NOITE: { nome: 'Meia-noite', cores: MEIA_NOITE, modo: 'ESCURO', variante: 'escuro' },
  OCEANO: { nome: 'Oceano', cores: OCEANO, modo: 'ESCURO', variante: 'escuro' },
  AMEIXA: { nome: 'Ameixa', cores: AMEIXA, modo: 'ESCURO', variante: 'escuro' },
  CAFE: { nome: 'Escuro', cores: ESCURO, modo: 'ESCURO', variante: 'escuro' },
  CLARO: { nome: 'Claro', cores: CLARO, modo: 'CLARO', variante: 'claro' },
  AREIA: { nome: 'Areia', cores: AREIA, modo: 'CLARO', variante: 'claro' },
  CEU: { nome: 'Céu', cores: CEU, modo: 'CLARO', variante: 'claro' },
  LAVANDA: { nome: 'Lavanda', cores: LAVANDA, modo: 'CLARO', variante: 'claro' },
  ROSA: { nome: 'Rosa', cores: ROSA, modo: 'CLARO', variante: 'claro' },
};

/** Paletas exibidas nos seletores de Marca e Ajustes (sem `CAFE`, que resolve para `ESCURO`). */
export const CODIGOS_PALETAS_VISIVEIS: readonly Exclude<Tema, 'CAFE'>[] = [
  'ESCURO', 'MEIA_NOITE', 'OCEANO', 'AMEIXA',
  'CLARO', 'AREIA', 'CEU', 'LAVANDA', 'ROSA',
];

/**
 * A paleta de um código, com reserva no Escuro: um código que o app não conhece (app antigo com a API nova, ou o contrário)
 * nunca derruba a tela. Todo código vindo de fora (marca da sessão, prévia) passa por aqui, não por `PALETAS[codigo]`.
 * `'CAFE'` (legado) resolve automaticamente para `PALETAS.ESCURO`.
 */
export const paletaDe = (codigo: string | null | undefined): (typeof PALETAS)[Tema] =>
  codigo === 'CAFE'
    ? PALETAS.ESCURO
    : (codigo && Object.hasOwn(PALETAS, codigo) ? PALETAS[codigo as Tema] : undefined) ?? PALETAS.ESCURO;

export interface TokenNeon {
  accent: string;
  tintBg: string;
  tintBorder: string;
  textOnTint: string;
  capsuleBg?: string;
  capsuleText?: string;
  solidBg?: string;
}

export interface TokensStndrd {
  neon: {
    emerald: TokenNeon;
    acidLime: TokenNeon;
    electricBlue: TokenNeon;
    electricPurple: TokenNeon;
    crimson: TokenNeon;
  };
  cta: {
    bg: string;
    text: string;
  };
  glass: {
    bg: string;
    border: string;
    blur: number;
  };
}

export const TOKENS_STNDRD_ESCURO: TokensStndrd = {
  neon: {
    emerald: {
      accent: '#00E699',
      tintBg: 'rgba(0, 230, 153, 0.12)',
      tintBorder: 'rgba(0, 230, 153, 0.28)',
      textOnTint: '#00E699',
    },
    acidLime: {
      accent: '#CDFF00',
      tintBg: 'rgba(205, 255, 0, 0.12)',
      tintBorder: 'rgba(205, 255, 0, 0.28)',
      textOnTint: '#CDFF00',
    },
    electricBlue: {
      accent: '#3B82F6',
      solidBg: '#2563EB',
      tintBg: 'rgba(59, 130, 246, 0.14)',
      tintBorder: 'rgba(59, 130, 246, 0.28)',
      textOnTint: '#60A5FA',
    },
    electricPurple: {
      accent: '#A855F7',
      tintBg: 'rgba(168, 85, 247, 0.12)',
      tintBorder: 'rgba(168, 85, 247, 0.28)',
      textOnTint: '#C084FC',
    },
    crimson: {
      accent: '#FF3B5C',
      tintBg: 'rgba(255, 59, 92, 0.12)',
      tintBorder: 'rgba(255, 59, 92, 0.28)',
      textOnTint: '#FF4D6D',
    },
  },
  cta: {
    bg: '#FCFCFC',
    text: '#09090B',
  },
  glass: {
    bg: 'rgba(20, 20, 22, 0.78)',
    border: 'rgba(255, 255, 255, 0.08)',
    blur: 20,
  },
};

export const TOKENS_STNDRD_CLARO: TokensStndrd = {
  neon: {
    emerald: {
      accent: '#00D68F',
      tintBg: 'rgba(0, 214, 143, 0.12)',
      tintBorder: 'rgba(5, 150, 105, 0.28)',
      textOnTint: '#047857',
      capsuleBg: '#09090B',
      capsuleText: '#00E699',
    },
    acidLime: {
      accent: '#A3E635',
      tintBg: 'rgba(163, 230, 53, 0.16)',
      tintBorder: 'rgba(101, 163, 13, 0.28)',
      textOnTint: '#3F6212',
      capsuleBg: '#09090B',
      capsuleText: '#CDFF00',
    },
    electricBlue: {
      accent: '#2563EB',
      solidBg: '#2563EB',
      tintBg: 'rgba(37, 99, 235, 0.10)',
      tintBorder: 'rgba(37, 99, 235, 0.25)',
      textOnTint: '#1D4ED8',
      capsuleBg: '#2563EB',
      capsuleText: '#FFFFFF',
    },
    electricPurple: {
      accent: '#9333EA',
      tintBg: 'rgba(147, 51, 234, 0.10)',
      tintBorder: 'rgba(147, 51, 234, 0.25)',
      textOnTint: '#7E22CE',
      capsuleBg: '#09090B',
      capsuleText: '#C084FC',
    },
    crimson: {
      accent: '#F43F5E',
      tintBg: 'rgba(244, 63, 94, 0.10)',
      tintBorder: 'rgba(225, 29, 72, 0.25)',
      textOnTint: '#BE123C',
      capsuleBg: '#09090B',
      capsuleText: '#FF4D6D',
    },
  },
  cta: {
    bg: '#09090B',
    text: '#FFFFFF',
  },
  glass: {
    bg: 'rgba(255, 255, 255, 0.82)',
    border: 'rgba(9, 9, 11, 0.08)',
    blur: 20,
  },
};

export const tokensStndrdDe = (modo: ModoDoTema): TokensStndrd =>
  modo === 'CLARO' ? TOKENS_STNDRD_CLARO : TOKENS_STNDRD_ESCURO;

export const modoDaPaleta = (codigo: string | null | undefined): ModoDoTema => paletaDe(codigo).modo;

/**
 * Paleta fixa das agendas pessoais (D7): a cor IDENTIFICA a agenda (ponto ou barra lateral), nunca diz status. Cada chave
 * tem o par claro e escuro, longe dos tons de `sucesso`/`atencao`/`perigo`. Fica fora de `Cores` de propósito: não é token
 * de superfície e não muda no contraste alto (o texto do evento usa `texto`). Cada cor chega a 3:1 sobre o fundo e as
 * superfícies do tema (marcador, WCAG 1.4.11); `tokens.test.ts` confere isso e a distância das cores de status.
 */
export const CHAVES_DA_AGENDA: readonly CorDaAgenda[] = ['AZUL', 'INDIGO', 'VIOLETA', 'MAGENTA', 'TURQUESA', 'ARDOSIA', 'TERRA', 'OLIVA'];

export const PALETA_DA_AGENDA: Record<VarianteDoTema, Record<CorDaAgenda, string>> = {
  claro: {
    AZUL: '#1B6FD6', INDIGO: '#4B3FBF', VIOLETA: '#9333B8', MAGENTA: '#C0306F',
    TURQUESA: '#0B7F8A', ARDOSIA: '#51677E', TERRA: '#A64F43', OLIVA: '#758418',
  },
  // Areia (14/11): AZUL, TURQUESA e OLIVA, um passo mais escuras (3:1 sobre a página mais escura); TERRA, um pouco mais clara,
  // porque o vermelho de perigo escurecido da Areia a deixava a 22,6 de distância dele (piso 25).
  areia: {
    AZUL: '#1B6ED4', INDIGO: '#4B3FBF', VIOLETA: '#9333B8', MAGENTA: '#C0306F',
    TURQUESA: '#0B7C87', ARDOSIA: '#51677E', TERRA: '#A25346', OLIVA: '#697716',
  },
  escuro: {
    AZUL: '#4A90F7', INDIGO: '#8B7CF0', VIOLETA: '#C07DE8', MAGENTA: '#E8579F',
    TURQUESA: '#2BBFC9', ARDOSIA: '#8FA3B8', TERRA: '#BE8068', OLIVA: '#A8B53F',
  },
};

/** Cor do marcador de uma agenda pela chave e pela variante do tema em uso; chave desconhecida cai em ARDOSIA, a mais neutra. */
export function corDaAgenda(chave: string | null | undefined, variante: VarianteDoTema): string {
  const paleta = PALETA_DA_AGENDA[variante];
  return (CHAVES_DA_AGENDA as readonly string[]).includes(chave ?? '') ? paleta[chave as CorDaAgenda] : paleta.ARDOSIA;
}

/**
 * Cores de identificação que só o perfil da Comunidade usa (decisão do Gustavo de 10/11: laranja de verdade, não o TERRA).
 * Ficam fora de `PALETA_DA_AGENDA` porque a API das agendas não aceita estas chaves e o seletor de agenda percorre
 * `CHAVES_DA_AGENDA`. Mesma regra das agendas: par claro/escuro, não muda no contraste alto, marcador ≥ 3:1 sobre o fundo e
 * as superfícies de todas as paletas e longe das cores de status e das oito das agendas (`tokens.test.ts`). O laranja do
 * claro passa só como marcador (anel, amostra, quadradinho): nunca vira texto; o do escuro também passa 4,5:1.
 */
export type CorSoDoPerfil = 'LARANJA';

export const PALETA_SO_DO_PERFIL: Record<VarianteDoTema, Record<CorSoDoPerfil, string>> = {
  claro: { LARANJA: '#D15700' },
  areia: { LARANJA: '#BC4E00' },
  escuro: { LARANJA: '#FF7A1A' },
};

/** Tom de uma cor do perfil: uma das agendas ou uma só do perfil. */
export type TomDoPerfil = CorDaAgenda | CorSoDoPerfil;

/** Cor do anel e da amostra do perfil no tema em uso; o que não é só do perfil sai da paleta das agendas. */
export function corDoTomDoPerfil(tom: TomDoPerfil, variante: VarianteDoTema): string {
  const so = PALETA_SO_DO_PERFIL[variante];
  return Object.hasOwn(so, tom) ? so[tom as CorSoDoPerfil] : corDaAgenda(tom, variante);
}

/**
 * Paleta de IDENTIFICAÇÃO (Frente G, D9 a D14, prévia `docs/prototipos/cores-por-tipo-de-serie.html` aprovada em 03/11):
 * a cor diz QUAL tipo de série, divisão ou refeição é, nunca status (D6); o selo de texto continua (D7). Só ciano, azul,
 * índigo, violeta e magenta: sem verde, âmbar, vermelho nem cinza (D11). Claro e areia usam a mesma cor; o escuro, a
 * variante clara. Cada cor passa 4,5:1 como texto sobre `superficie`, `superficie2`, `superficie3` e o próprio fundo
 * tingido do selo nos três temas (`tokens.test.ts`). Fica fora de `Cores`, como a paleta das agendas: não muda com o
 * contraste alto nem com as bordas reforçadas, que não mexem nas superfícies.
 */
export type ChaveDeIdentificacao = 'CIANO' | 'AZUL' | 'INDIGO' | 'VIOLETA' | 'MAGENTA';

export const CHAVES_DE_IDENTIFICACAO: readonly ChaveDeIdentificacao[] = ['CIANO', 'AZUL', 'INDIGO', 'VIOLETA', 'MAGENTA'];

export const PALETA_DE_IDENTIFICACAO: Record<VarianteDoTema, Record<ChaveDeIdentificacao, string>> = {
  claro: { CIANO: '#00698A', AZUL: '#1A5CBA', INDIGO: '#4B3FBF', VIOLETA: '#8A2DB0', MAGENTA: '#A3237F' },
  // Areia (14/11): ciano e azul, um passo mais escuros para fechar 4,5:1 sobre o cartão, a faixa e o selo novos.
  areia: { CIANO: '#006483', AZUL: '#1959B4', INDIGO: '#4B3FBF', VIOLETA: '#8A2DB0', MAGENTA: '#A3237F' },
  escuro: { CIANO: '#3CC3D6', AZUL: '#62A0F8', INDIGO: '#A196F5', VIOLETA: '#CF8DEE', MAGENTA: '#F07AC8' },
};

/** Uma cor de identificação já resolvida para o tema: `cor` (texto, ícone, barra lateral) e `fundo` (selo, opaco). */
export interface CorDeIdentificacao {
  cor: string;
  fundo: string;
}

/**
 * As cinco cores de identificação para as cores do tema em uso: `cor` da paleta do modo e `fundo` = `tingido` da cor sobre
 * a `superficie` (o mesmo fundo do selo com ícone). `useTema().identificacao` entrega o resultado.
 */
export function coresDeIdentificacao(cores: Cores, variante: VarianteDoTema): Record<ChaveDeIdentificacao, CorDeIdentificacao> {
  const paleta = PALETA_DE_IDENTIFICACAO[variante];
  const resultado = {} as Record<ChaveDeIdentificacao, CorDeIdentificacao>;
  for (const chave of CHAVES_DE_IDENTIFICACAO) {
    resultado[chave] = { cor: paleta[chave], fundo: tingido(paleta[chave], cores.superficie) };
  }
  return resultado;
}

/**
 * Cores de DESTAQUE do número de indicador (`docs/planos/cores-de-destaque.md`, D3 e D4): azul, ciano e violeta são de
 * indicador (medida, sem juízo; valores do PDF de 13/11) e ficam fora de `Cores`, como a identificação: o contraste alto e
 * as bordas reforçadas não mexem nas superfícies. Verde, âmbar e vermelho são os da situação (`sucesso`, `atencao`,
 * `perigo`), os mesmos do `Selo` (D13: a mesma informação com a mesma cor). Não substituem as cores de categoria.
 */
export const PALETA_DE_DESTAQUE: Record<VarianteDoTema, Record<'azul' | 'ciano' | 'violeta', string>> = {
  claro: { azul: '#153A9E', ciano: '#0A576D', violeta: '#5B21B6' },
  // Areia (14/11): 4,5:1 sobre a página, o cartão e o fundo tonalizado novos; o azul fica mais escuro que o ciano e o violeta
  // (que já estão no limite de 4,5:1) para o par de barras azul × ciano manter 1,2:1.
  areia: { azul: '#173EAB', ciano: '#0B5D73', violeta: '#6A27D2' },
  escuro: { azul: '#60A5FA', ciano: '#67E8F9', violeta: '#C4B5FD' },
};

/** Quanto do destaque entra no fundo tonalizado (D4): mistura composta sobre a superfície, nunca opacidade na peça. */
export const TINTA_DO_DESTAQUE = { claro: 0.06, areia: 0.06, escuro: 0.08 } as const;

/** Um destaque resolvido para o tema: `cor` (número e faixa), `fundo` (sobre a `superficie`) e `fundoSobre` (hover, sobre a `superficie2`). */
export interface CorDeDestaque {
  cor: string;
  fundo: string;
  fundoSobre: string;
}

/** Os seis destaques para as cores do tema em uso; o contraste do número sobre cada fundo é medido em `tokens.test.ts`. */
export function coresDeDestaque(cores: Cores, variante: VarianteDoTema): Record<FuncaoDeDestaque, CorDeDestaque> {
  const p = PALETA_DE_DESTAQUE[variante];
  const t = TINTA_DO_DESTAQUE[variante];
  const de = (cor: string): CorDeDestaque => ({ cor, fundo: misturar(cores.superficie, cor, t), fundoSobre: misturar(cores.superficie2, cor, t) });
  return { azul: de(p.azul), ciano: de(p.ciano), violeta: de(p.violeta), verde: de(cores.sucesso), ambar: de(cores.atencao), vermelho: de(cores.perigo) };
}

/** Cor neutra para telas sem marca (entrar, cadastro). */
export const MARCA_NEUTRA = '#52525B';
/**
 * Véu atrás das folhas: o mesmo preto translúcido nos três temas (escurece o que está por trás, no escuro também).
 * É decorativo: quem separa o painel do fundo é a borda do bloco, não o véu.
 */
export const VEU = 'rgba(0,0,0,0.55)';
/**
 * Camada sobre a foto de perfil no topo da ficha (troca e remoção no próprio círculo): a foto pode ter qualquer cor,
 * então a camada é a mesma nos três temas, como o véu. Ícone e anel de foco brancos passam 4,5:1 no pior caso (foto
 * branca coberta pela camada) e o hover do botão não cai de 3:1 (`ui/contrasteDasPecas.test.ts`).
 */
export const CAMADA_DA_FOTO = {
  fundo: 'rgba(0,0,0,0.62)',
  /** Fundo do botão em hover ou pressionado, por cima da camada. */
  sobre: 'rgba(255,255,255,0.18)',
  icone: '#FFFFFF',
} as const;

export const espaco = (n: number) => n * 8;
/** Cantos de 12 px nos cartões, folhas e painéis. */
export const RAIO = 12;
/** Cantos de 8 px nos controles: botão, campo, chip, aba, item do menu, item selecionável. */
export const RAIO_CONTROLE = 8;
/**
 * Contorno de 1 px (11/11); "bordas reforçadas" sobe para 2 px pelo `useTema().bordas` (`espessurasDasBordas`). Estas
 * constantes são a espessura padrão para quem não lê o tema.
 */
export const BORDA_BLOCO = 1;
export const LINHA_DA_FAIXA = 1;
export const BORDA_ITEM = 1;
export const ALVO_TOQUE = 44;
export const LARGURA_MAXIMA = 1800;
/** Telas declaradas até esta largura são formulários curtos e não esticam. */
export const LARGURA_FORMULARIO = 640;
/** A partir daqui o treinador tem menu lateral (com a busca e a conta, na web); abaixo, barra inferior do celular. */
export const LARGURA_MENU_LATERAL = 768;
/** Abaixo disto o menu lateral fica só com ícones (trilho) para sobrar espaço ao conteúdo. */
export const LARGURA_MENU_EXPANDIDO = 1024;
/** Editores e formulários longos (treino, dieta, modelo, marca, perfil). */
export const LARGURA_EDITOR = 1040;
/** Largura de conteúdo medida a partir da qual o editor de treino usa duas colunas (lista e inspetor). */
export const LARGURA_DUAS_COLUNAS = 960;
/**
 * Largura dos editores com lista + inspetor (treino, dieta, mobilidade) em duas colunas: todo o espaço útil, como as
 * listas. Era 1440 e, em 1920 px, sobravam duas faixas vazias dos lados (Gustavo, 04/11). Os campos de texto não esticam
 * junto (a "Configuração do plano" preenche a largura do cartão).
 */
export const LARGURA_EDITOR_DUAS_COLUNAS = LARGURA_MAXIMA;
/** Listas e painéis (ficha do aluno, início, alunos, biblioteca, planejamento): todo o espaço útil (= `LARGURA_MAXIMA`). */
export const LARGURA_LISTA = 1800;

/** Geist (11/11) no texto; Metal Mania só no nome da marca. Peso médio dá a hierarquia; negrito em nome, número central e ação. */
export const fontes = {
  normal: 'Geist_400Regular',
  medio: 'Geist_500Medium',
  semi: 'Geist_600SemiBold',
  negrito: 'Geist_700Bold',
  metal: 'MetalMania_400Regular',
  esportiva: 'BebasNeue_400Regular',
  condensada: 'Oswald_700Bold',
};

/** Luminância relativa (WCAG 2.x) de uma cor #RRGGBB. */
export function luminancia(hex: string): number {
  const valor = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!valor) {
    return 0;
  }
  const n = parseInt(valor[1], 16);
  const canais = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

export function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** Texto sobre a cor da marca: branco ou preto, o que der maior contraste. */
export function textoSobre(fundo: string): string {
  return contraste(fundo, '#FFFFFF') >= contraste(fundo, '#000000') ? '#FFFFFF' : '#000000';
}

/** Mistura `cor` com `alvo` na proporção `t` (0 = cor, 1 = alvo). */
export function misturar(cor: string, alvo: string, t: number): string {
  const a = parseInt(cor.slice(1), 16);
  const b = parseInt(alvo.slice(1), 16);
  const canal = (desl: number) => Math.round(((a >> desl) & 255) * (1 - t) + ((b >> desl) & 255) * t);
  return `#${[16, 8, 0].map((d) => canal(d).toString(16).padStart(2, '0').toUpperCase()).join('')}`;
}

/**
 * Fundo opaco de selo com ícone: `cor` com alfa 0x18 sobre `base` (a `superficie`). Opaco para o contraste não depender
 * da faixa onde o selo está (sobre `faixaForte` um fundo translúcido ficava abaixo de 4,5:1).
 */
export function tingido(cor: string, base: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(cor) || !/^#[0-9a-f]{6}$/i.test(base)) return base;
  return misturar(base, cor, 0x18 / 255);
}

/**
 * A cor da marca como texto sobre um fundo: a própria cor quando já dá 4,5:1; senão a variante mais clara (tema
 * escuro) ou mais escura (tema claro) mais próxima que chega lá. Preserva o tom; só muda o quanto precisa.
 */
export function marcaParaTexto(marca: string, fundo: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(marca.trim())) return marca;
  const alvo = luminancia(fundo) < 0.18 ? '#FFFFFF' : '#000000';
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const cor = misturar(marca.trim(), alvo, Math.min(t, 1));
    if (contraste(cor, fundo) >= 4.5) return cor;
  }
  return alvo;
}

/**
 * A cor do nome da marca no título (`ui/MarcaTitulo`): a de sempre (medida contra a `superficie3`) quando ela já dá 4,5:1
 * no fundo onde o nome fica; só onde não dá (Areia: 4,19:1) é medida contra esse fundo. Sempre ≥ 4,5:1 no `fundo`.
 */
export function marcaParaTitulo(marca: string, fundo: string, superficie3: string): string {
  const deSempre = marcaParaTexto(marca, superficie3);
  return contraste(deSempre, fundo) >= 4.5 ? deSempre : marcaParaTexto(marca, fundo);
}

/**
 * Botão principal com o mouse em cima ou apertado: a marca 14% mais escura quando o texto sobre ela é branco, 14% mais
 * clara quando é preto (o texto ganha contraste nos dois casos).
 */
export function marcaAoPassar(marca: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(marca.trim())) return marca;
  return misturar(marca.trim(), textoSobre(marca) === '#FFFFFF' ? '#000000' : '#FFFFFF', 0.14);
}

/**
 * A marca como peça (indicador do item ativo, progresso): a própria cor quando já dá 3:1 (WCAG 1.4.11) sobre todos os
 * fundos, senão a variante mais clara (escuro) ou mais escura (claro) mais próxima que chega lá.
 */
export function marcaParaPeca(marca: string, fundos: readonly string[]): string {
  if (!/^#[0-9a-f]{6}$/i.test(marca.trim()) || fundos.length === 0) return marca;
  const alvo = luminancia(fundos[0]) < 0.18 ? '#FFFFFF' : '#000000';
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const cor = misturar(marca.trim(), alvo, Math.min(t, 1));
    if (fundos.every((fundo) => contraste(cor, fundo) >= 3)) return cor;
  }
  return alvo;
}
