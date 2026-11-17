import type { CorDaAgenda } from '../api/agendaTipos';
import type { Tema } from '../api/tipos';
import type { FuncaoDeDestaque } from '../dominio/destaque';

/**
 * Visual de 11/11 (prévia `docs/prototipos/visual-vendavel/` + guia em PDF; resumo em
 * `docs/planos/visual-vendavel/guia-premium-no-app.md`): flat, sem sombra nem gradiente, contorno de 1 px (2 px com
 * "bordas reforçadas"), raio 8 nos controles (`RAIO_CONTROLE`) e 12 nos cartões (`RAIO`), grade de 8 px, fonte Geist.
 *
 * Três famílias de cor que não se misturam: **marca** (logo, pequeno indicador do item ativo, título e cartão "Hoje" do
 * aluno; papéis calculados no `TemaProvider`; o `Botao primario` é neutro desde 17/11), **situação** (`sucesso`,
 * `atencao`, `perigo`, `informacao`, `conquista` e `neutro`, com o fundo `*Suave` da pílula, tingido a 12%; fixas no
 * tema, nunca derivadas da marca, sempre com texto; o número principal fica em `texto`) e **categoria**
 * (`PALETA_DE_IDENTIFICACAO`: tipo de série, divisão, refeição). Seleção é neutra (`ui/selecao.ts`). Tabela situação →
 * cor: `docs/design-e-front.md`, seção 4.5.
 *
 * Escada de superfícies (17/11, `docs/planos/hierarquia-visual-tres-temas.md`, travada em `tokens.test.ts`): `fundo`
 * (menu e página) → `painel` (área do conteúdo no PC) → `superficie` (cartão e painel flutuante, contorno `divisor` ≥
 * 1,4:1) → `superficie3` (faixa do título) e `superficie2` (poço: item, apoio). Hover, apertado e seleção neutra = `sobre`
 * (na faixa e no `IconeBotao`, `sobreNaFaixa`), calculados da escada (`comRealce`). Cartão × página ≥ 1,35 nas claras, 1,6
 * na Areia e 1,15 nas escuras. Campo de digitar = `campo` + `bordaCampo` (≥ 3:1).
 */
export interface Cores {
  fundo: string;
  superficie: string;
  superficie2: string;
  superficie3: string;
  /**
   * Hover, apertado e seleção neutra de linha, item, chip e opção de menu (A6, 17/11): a faixa (`superficie3`) andando na
   * direção do `texto` o mínimo para ficar ≥ 1,10:1 do cartão e do poço. Nas escuras dá a própria faixa. Aguenta texto,
   * situação e identificação a 4,5:1 (`tokens.test.ts`).
   */
  sobre: string;
  /**
   * Hover em cima da faixa do título e do `IconeBotao` (em qualquer superfície): o mesmo passo, ≥ 1,10:1 também da faixa.
   * Nas escuras fica mais claro que `sobre` e só aguenta `texto`/`textoSuave` (4,5:1) e ícone (3:1).
   */
  sobreNaFaixa: string;
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
  /** Situação como texto, ícone e borda (≥ 4,5:1 sobre `superficie`, `superficie2` e `superficie3`). */
  sucesso: string;
  atencao: string;
  perigo: string;
  /** Informação (medida, ao vivo, sem juízo) e conquista (recorde, nível): ≥ 4,5:1 sobre o cartão e a própria pílula. */
  informacao: string;
  conquista: string;
  neutro: string;
  /** Fundo da pílula de cada situação: a cor a 12% sobre o cartão (`tingidoDaPilula`); o texto é a própria cor (≥ 4,5:1). */
  sucessoSuave: string;
  atencaoSuave: string;
  perigoSuave: string;
  informacaoSuave: string;
  conquistaSuave: string;
  /**
   * Vermelho que aguenta texto branco por cima (≥ 4,5:1): só a variável `--color-destructive` do RNR. O `Botao perigo`
   * é de contorno desde 17/11 (D7) e não o usa.
   */
  perigoFundo: string;
  /** Anel de foco do teclado: a cor do texto (≥ 4,5:1 em qualquer superfície), nunca a da marca. */
  anelFoco: string;
  /** Fases do ciclo (faixa e calendário). Não são a cor da marca nem o vermelho de erro. */
  fase1: string;
  fase2: string;
  fase3: string;
  fase4: string;
}

/** Situação do Escuro (D9, 17/11); as escuras da marca usam as mesmas. */
const SITUACAO_ESCURA = { sucesso: '#00E699', atencao: '#FFB020', perigo: '#FF4D6A', informacao: '#4D9BFF', conquista: '#B57BFF' } as const;

/** Os cinco fundos de pílula de uma situação sobre o cartão do tema. */
function pilulasDaSituacao(s: Pick<Cores, 'sucesso' | 'atencao' | 'perigo' | 'informacao' | 'conquista'>, cartao: string) {
  return {
    sucessoSuave: tingidoDaPilula(s.sucesso, cartao),
    atencaoSuave: tingidoDaPilula(s.atencao, cartao),
    perigoSuave: tingidoDaPilula(s.perigo, cartao),
    informacaoSuave: tingidoDaPilula(s.informacao, cartao),
    conquistaSuave: tingidoDaPilula(s.conquista, cartao),
  };
}

/** Quanto o realce (hover, seleção) se afasta do repouso: 1,10:1 (o poço e a faixa da escada de 17/11 ficaram a 1,03). */
const PASSO_DO_REALCE = 1.1;

/** A escada sem os realces, que saem dela (`comRealce`). */
type Escada = Omit<Cores, 'sobre' | 'sobreNaFaixa'>;

/** `sobre` e `sobreNaFaixa` da escada: a faixa misturada ao texto em passos de 1% até ficar a `PASSO_DO_REALCE` dos fundos. */
function comRealce(c: Escada): Cores {
  const passo = (fundos: string[]) => {
    for (let i = 0; i <= 100; i++) {
      const cor = misturar(c.superficie3, c.texto, i / 100);
      if (fundos.every((f) => contraste(cor, f) >= PASSO_DO_REALCE)) return cor;
    }
    return c.texto;
  };
  return { ...c, sobre: passo([c.superficie, c.superficie2, c.campo]), sobreNaFaixa: passo([c.superficie, c.superficie2, c.superficie3, c.campo]) };
}

export const ESCURO: Cores = comRealce({
  // D5 (17/11): página, cartão, faixa e poço (mais escuro que o cartão). Contorno #34343A subiu a #36363C (1,37 → 1,42:1,
  // piso 1,4), o painel do PC desceu a 10% do caminho até o cartão para o cartão manter 1,15:1 sobre ele, e `bordaCampo`
  // e `textoSuave` clarearam 1% e 2% para os pares do guia (4,5:1 sobre o cartão e 7:1 sobre o poço) com o cartão novo.
  fundo: '#09090B',
  superficie: '#1C1C20',
  superficie2: '#0F0F11',
  superficie3: '#26262B',
  faixaForte: '#28282E',
  divisor: '#36363C',
  borda: '#4A4A52',
  campo: '#0F0F11',
  bordaCampo: '#83838D',
  painel: '#0B0B0D',
  texto: '#FCFCFC',
  textoSuave: '#9C9CA3',
  ...SITUACAO_ESCURA,
  neutro: '#9A9AA3',
  ...pilulasDaSituacao(SITUACAO_ESCURA, '#1C1C20'),
  perigoFundo: '#C62828',
  anelFoco: '#FCFCFC',
  // Rosa e lavanda um pouco mais claros que antes: o `perigo` novo é mais claro e a fase não pode parecer erro.
  fase1: '#E7AEC1',
  fase2: '#7DCFC6',
  fase3: '#E2C56A',
  fase4: '#ADBAEB',
});

/**
 * Situação do Claro (D9: `#0E7A43 #8A5300 #C01834 #1D5FD1 #7A2FD0`). Verde, âmbar e vermelho escurecidos o mínimo para o
 * texto da caixa `Alerta` passar 4,5:1 também direto na página nova (#D9DCE1) e o verde, sobre a série feita; informação e
 * conquista ficam como decididas (só aparecem no cartão e na pílula).
 */
const SITUACAO_CLARA = { sucesso: '#0C6638', atencao: '#804D00', perigo: '#AB152E', informacao: '#1D5FD1', conquista: '#7A2FD0' } as const;

export const CLARO: Cores = comRealce({
  // D3 (17/11): página, cartão branco, faixa e poço. Contorno #E4E4E7 → #D9D9DB e borda #B4B4BC → #A7A7AF, o mínimo para
  // os pisos de 1,4 (contorno × cartão) e 1,7 (borda × página).
  fundo: '#D9DCE1',
  superficie: '#FFFFFF',
  superficie2: '#EEF0F2',
  superficie3: '#F2F3F5',
  faixaForte: '#DCDCE0',
  divisor: '#D9D9DB',
  borda: '#A7A7AF',
  campo: '#FFFFFF',
  bordaCampo: '#71717A',
  painel: '#D9DCE1',
  texto: '#09090B',
  textoSuave: '#52525B',
  ...SITUACAO_CLARA,
  neutro: '#616169',
  ...pilulasDaSituacao(SITUACAO_CLARA, '#FFFFFF'),
  perigoFundo: '#B71C1C',
  anelFoco: '#09090B',
  fase1: '#C46B86',
  fase2: '#5E8F8A',
  fase3: '#A67C2E',
  fase4: '#7A86C4',
});

/**
 * Situação da Areia: verde, âmbar e vermelho do Claro (D9) escurecidos mais um passo, só o que a página #CDCAC3 pede para
 * o texto da caixa `Alerta` direto nela passar 4,5:1; informação e conquista ficam as decididas.
 */
const SITUACAO_AREIA = { sucesso: '#0A5931', atencao: '#704300', perigo: '#961329', informacao: '#1D5FD1', conquista: '#7A2FD0' } as const;

/**
 * Areia (D4, 17/11): página `#CDCAC3` (a do exemplo que o Saraiva aprovou em 14/11), cartão e campo brancos, faixa
 * `#EDEBE7`, poço `#F1EFEB` e `faixaForte` `#C3C0B8`. Contorno, borda e texto secundário escurecidos o mínimo para os
 * pisos (contorno × cartão 1,4, borda × página 1,7, texto secundário 4,5:1 sobre a `faixaForte`).
 */
export const AREIA: Cores = comRealce({
  ...CLARO,
  fundo: '#CDCAC3',
  painel: '#CDCAC3',
  superficie: '#FFFFFF',
  superficie2: '#F1EFEB',
  superficie3: '#EDEBE7',
  faixaForte: '#C3C0B8',
  divisor: '#DED8CD',
  borda: '#A0998B',
  campo: '#FFFFFF',
  bordaCampo: '#6E6659',
  textoSuave: '#4C4C54',
  ...SITUACAO_AREIA,
  ...pilulasDaSituacao(SITUACAO_AREIA, '#FFFFFF'),
});

/** Modo de uma paleta: decide a barra de status e o esquema do Uniwind. */
export type ModoDoTema = 'ESCURO' | 'CLARO';

/**
 * Variante das cores fixas (agenda, perfil, identificação, destaque), que ficam fora de `Cores`: `claro` e `escuro` seguem o
 * modo; `areia` é a do "Claro areia", cujas superfícies mais escuras pedem as mesmas cores um passo mais escuras. Vem da
 * paleta em uso (`PALETAS[...].variante`, `useTema().variante`): nenhuma tela decide a cor por conta própria.
 */
export type VarianteDoTema = 'claro' | 'areia' | 'escuro';

/**
 * Paleta escura a partir do "chão" dela: texto e situação do Escuro (fixos, nunca da marca), `painel` a 10% do fundo ao
 * cartão (a mesma regra que dá o #0B0B0D do Escuro: mais que isso derruba o cartão abaixo de 1,15:1 sobre o painel) e
 * pílulas tingidas sobre o cartão dela.
 */
function paletaEscura(chao: Pick<Cores, 'fundo' | 'superficie' | 'superficie2' | 'superficie3' | 'faixaForte' | 'divisor' | 'borda' | 'campo' | 'bordaCampo'>, perigo: string = ESCURO.perigo): Cores {
  return comRealce({
    ...ESCURO,
    ...chao,
    perigo,
    painel: misturar(chao.fundo, chao.superficie, 0.1),
    ...pilulasDaSituacao({ ...ESCURO, perigo }, chao.superficie),
  });
}

/**
 * Paletas da marca (`docs/planos/paletas-da-marca.md`, decisão 1 de 03/11): a consultoria escolhe uma da lista em Marca.
 * A paleta muda só o "chão" (fundo, cartão, faixas, divisor, bordas e campo); texto, situação, fases e foco são os do
 * Escuro ou do Claro. Escada de 17/11 (D6), uma regra só por modo:
 * - escuras: cartão e faixa clareiam juntos o mínimo para o cartão chegar a 1,15:1 sobre o painel (Meia-noite 3%,
 *   Ameixa 4%, Oceano 2,5% para o branco; clarear mais deixa mais cores prontas da marca abaixo de 3:1 no cartão), poço e
 *   campo ficam (já eram mais escuros que o cartão), contorno e `faixaForte` clareiam o mínimo para os pisos;
 * - claras: página desce o mesmo que a do Claro (−26/−24/−21) e volta o mínimo para os marcadores (agenda e laranja do
 *   perfil) manterem 3:1 sobre ela (Céu 2%, Lavanda 7%, Rosa 4% para o branco; o cartão fica a 1,37:1), faixa e poço a
 *   34% e 45% do branco à página, campo branco; contorno e borda escurecidos o mínimo para 1,4:1 sobre o cartão e 1,7:1
 *   sobre a página.
 * - o vermelho de perigo das escuras clareia o mínimo onde a faixa e a pílula dela pedem (Meia-noite 1%, Oceano 3%).
 */
export const MEIA_NOITE: Cores = paletaEscura({
  fundo: '#080C14',
  superficie: '#181E29',
  superficie2: '#060910',
  superficie3: '#212A39',
  faixaForte: '#232E42',
  divisor: '#2E3849',
  borda: '#49566B',
  campo: '#060910',
  bordaCampo: '#7B879B',
}, '#FF4F6B');

export const AMEIXA: Cores = paletaEscura({
  fundo: '#0D0914',
  superficie: '#1F1B2B',
  superficie2: '#08050D',
  superficie3: '#2B233B',
  faixaForte: '#2C2341',
  divisor: '#3B324E',
  borda: '#514766',
  campo: '#08050D',
  bordaCampo: '#817796',
});

export const OCEANO: Cores = paletaEscura({
  fundo: '#071014',
  superficie: '#152128',
  superficie2: '#050B0E',
  superficie3: '#1D2D37',
  faixaForte: '#1F3440',
  divisor: '#283B47',
  borda: '#475C68',
  campo: '#050B0E',
  bordaCampo: '#778A95',
}, '#FF526E');

export const LAVANDA: Cores = comRealce({
  ...CLARO,
  fundo: '#DCDBE7',
  painel: '#DCDBE7',
  superficie: '#FFFFFF',
  superficie2: '#EFEFF4',
  superficie3: '#F3F3F7',
  faixaForte: '#D6CEE8',
  divisor: '#DBD5E9',
  borda: '#ACA5C0',
  campo: '#FFFFFF',
  bordaCampo: '#706884',
});
export const CEU: Cores = comRealce({
  ...CLARO,
  fundo: '#D5DDE6',
  painel: '#D5DDE6',
  superficie: '#FFFFFF',
  superficie2: '#ECF0F4',
  superficie3: '#F1F3F7',
  faixaForte: '#CEDCEB',
  divisor: '#D1DBE6',
  borda: '#9CAABB',
  campo: '#FFFFFF',
  bordaCampo: '#67778A',
});
export const ROSA: Cores = comRealce({
  ...CLARO,
  fundo: '#E1DAE0',
  painel: '#E1DAE0',
  superficie: '#FFFFFF',
  superficie2: '#F2EEF1',
  superficie3: '#F5F2F4',
  faixaForte: '#E6CFD9',
  divisor: '#E6D3DC',
  borda: '#BEA2AF',
  campo: '#FFFFFF',
  bordaCampo: '#806472',
});

/** Código da paleta (= `Tema` da API, o `temaPadrao` da consultoria) → nome na tela, cores e modo. Fonte única do modo. */
export const PALETAS: Record<Tema, { nome: string; cores: Cores; modo: ModoDoTema; variante: VarianteDoTema }> = {
  ESCURO: { nome: 'Escuro', cores: ESCURO, modo: 'ESCURO', variante: 'escuro' },
  MEIA_NOITE: { nome: 'Meia-noite', cores: MEIA_NOITE, modo: 'ESCURO', variante: 'escuro' },
  OCEANO: { nome: 'Oceano', cores: OCEANO, modo: 'ESCURO', variante: 'escuro' },
  AMEIXA: { nome: 'Ameixa', cores: AMEIXA, modo: 'ESCURO', variante: 'escuro' },
  CLARO: { nome: 'Claro', cores: CLARO, modo: 'CLARO', variante: 'claro' },
  AREIA: { nome: 'Areia', cores: AREIA, modo: 'CLARO', variante: 'areia' },
  CEU: { nome: 'Céu', cores: CEU, modo: 'CLARO', variante: 'claro' },
  LAVANDA: { nome: 'Lavanda', cores: LAVANDA, modo: 'CLARO', variante: 'claro' },
  ROSA: { nome: 'Rosa', cores: ROSA, modo: 'CLARO', variante: 'claro' },
};

/** Paletas exibidas nos seletores de Marca e Ajustes, na ordem da tela. */
export const CODIGOS_PALETAS_VISIVEIS: readonly Tema[] = [
  'ESCURO', 'MEIA_NOITE', 'OCEANO', 'AMEIXA',
  'CLARO', 'AREIA', 'CEU', 'LAVANDA', 'ROSA',
];

/**
 * A paleta de um código, com reserva no Escuro: um código que o app não conhece (app antigo com a API nova, ou o contrário)
 * nunca derruba a tela. Todo código vindo de fora (marca da sessão, prévia) passa por aqui, não por `PALETAS[codigo]`.
 */
export const paletaDe = (codigo: string | null | undefined): (typeof PALETAS)[Tema] =>
  (codigo && Object.hasOwn(PALETAS, codigo) ? PALETAS[codigo as Tema] : undefined) ?? PALETAS.ESCURO;

// shortcut: legado do Financeiro (outra sessão), trocar pelos papéis de situação quando ela liberar
// (`treinador/financeiro/VisaoGeral.tsx` e `ResultadoDoMes.tsx` leem `TokenNeon`, `TokensStndrd` e as cinco chaves de
// `neon`; fora do Financeiro ninguém mais usa: as telas usam `sucesso`, `atencao`, `perigo`, `informacao` e `conquista`).
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
  /** Legado do Financeiro (ver o `shortcut:` acima). */
  neon: {
    emerald: TokenNeon;
    acidLime: TokenNeon;
    electricBlue: TokenNeon;
    electricPurple: TokenNeon;
    crimson: TokenNeon;
  };
  /**
   * Vidro da barra inferior, da barra de descanso, do aviso de recorde e da barra grudada do editor (D11; só pela peça
   * `ui/Vidro`). `cor` com `opacidade` por cima do blur; sem blur (Android sem alvo ou < 12, "reduzir transparência",
   * contraste alto) a `cor` vira fundo sólido. A opacidade é a mínima que deixa texto e `textoSuave` a 4,5:1 e borda e
   * ícone a 3:1 mesmo sem blur, sobre branco ou preto puros atrás, em todas as paletas (`ui/contrasteDoVidro.test.ts`).
   */
  glass: {
    cor: string;
    opacidade: number;
    border: string;
    blur: number;
  };
}

/** Fundo translúcido do vidro (`cor` a `opacidade`), em `rgba`. */
export function fundoDoVidro(glass: TokensStndrd['glass']): string {
  const n = parseInt(glass.cor.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${glass.opacidade})`;
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
  // 0,91: o `perigo` da barra do editor (`#FF4D6A`) sobre o vidro com branco puro atrás pede isso; `textoSuave`, 0,87.
  glass: {
    cor: '#141416',
    opacidade: 0.91,
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
  // 0,82: a `bordaCampo` do Céu sobre o vidro com preto puro atrás pede isso.
  glass: {
    cor: '#FFFFFF',
    opacidade: 0.82,
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
    TURQUESA: '#0B7F8A', ARDOSIA: '#51677E', TERRA: '#A85347', OLIVA: '#758418',
  },
  // Areia (14/11): AZUL, TURQUESA e OLIVA, um passo mais escuras (3:1 sobre a página mais escura); TERRA, um pouco mais clara,
  // porque o vermelho de perigo escurecido da Areia a deixava a menos de 25 de distância dele (o piso). 17/11: TERRA mais 2%
  // para o branco, no claro e na areia, pelo mesmo motivo com o perigo novo.
  areia: {
    AZUL: '#1B6ED4', INDIGO: '#4B3FBF', VIOLETA: '#9333B8', MAGENTA: '#C0306F',
    TURQUESA: '#0B7C87', ARDOSIA: '#51677E', TERRA: '#A4564A', OLIVA: '#697716',
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
 * Botão principal neutro (D7, 17/11): fundo na cor do texto (preto nas claras, branco nas escuras) e rótulo na cor da
 * página; com o mouse em cima ou apertado, o fundo anda 15% na direção da página (o rótulo segue ≥ 4,5:1 sobre ele).
 */
export function coresDoBotaoPrincipal(cores: Pick<Cores, 'texto' | 'fundo'>): { fundo: string; texto: string; fundoAoPassar: string } {
  return { fundo: cores.texto, texto: cores.fundo, fundoAoPassar: misturar(cores.texto, cores.fundo, 0.15) };
}

/** Fundo opaco da pílula de situação (D9, 17/11): `cor` a 12% sobre `base` (o cartão). */
export function tingidoDaPilula(cor: string, base: string): string {
  return misturar(base, cor, 0.12);
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
