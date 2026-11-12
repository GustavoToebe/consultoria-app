import type { CorDaAgenda } from '../api/agendaTipos';
import type { Tema } from '../api/tipos';

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
   * Área do conteúdo ao lado do menu no PC (o menu fica no `fundo`): no escuro, 45% do caminho do fundo ao cartão; no
   * claro, o próprio cartão (branco).
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
  fundo: '#0A0A0C',
  superficie: '#18181B',
  superficie2: '#222226',
  superficie3: '#2C2C31',
  faixaForte: '#34343B',
  divisor: '#36363C',
  borda: '#4C4C55',
  campo: '#0F0F12',
  bordaCampo: '#82828C',
  painel: '#101013',
  texto: '#F4F4F5',
  textoSuave: '#B5B5BE',
  sucesso: '#4ADE80',
  atencao: '#FBBF24',
  // O guia propõe #FB7185; fica um passo mais vermelho para não se confundir com o magenta da categoria (ΔE ≥ 40 em `tokens.test.ts`).
  perigo: '#FA717B',
  neutro: '#9A9AA3',
  sucessoSuave: '#143222',
  atencaoSuave: '#352915',
  perigoSuave: '#3B1C26',
  perigoFundo: '#C62828',
  anelFoco: '#F4F4F5',
  // Rosa e lavanda um pouco mais claros que antes: o `perigo` novo é mais claro e a fase não pode parecer erro.
  fase1: '#E7AEC1',
  fase2: '#7DCFC6',
  fase3: '#E2C56A',
  fase4: '#ADBAEB',
};

export const CLARO: Cores = {
  fundo: '#F7F7F8',
  superficie: '#FFFFFF',
  superficie2: '#F4F4F5',
  superficie3: '#E7E7EA',
  faixaForte: '#DCDCE1',
  divisor: '#D4D4D8',
  borda: '#B9B9C0',
  campo: '#FFFFFF',
  bordaCampo: '#80808A',
  painel: '#FFFFFF',
  texto: '#111114',
  textoSuave: '#52525B',
  sucesso: '#176E3C',
  atencao: '#875710',
  perigo: '#B71C1C',
  neutro: '#616169',
  sucessoSuave: tingido('#176E3C', '#FFFFFF'),
  atencaoSuave: tingido('#875710', '#FFFFFF'),
  perigoSuave: tingido('#B71C1C', '#FFFFFF'),
  perigoFundo: '#B71C1C',
  anelFoco: '#111114',
  fase1: '#C46B86',
  fase2: '#5E8F8A',
  fase3: '#A67C2E',
  fase4: '#7A86C4',
};

/**
 * "Claro areia" (D2 da frente "Clareza do treinador", 30/10): a mesma regra do claro, com fundo e faixas em tom areia,
 * a pedido do Gustavo na reunião de 29/10. Vale como opção nas Preferências e como paleta da marca; o padrão continua o claro neutro. Status,
 * fases, foco e texto são os do claro (conferidos sobre estas superfícies em `tokens.test.ts`).
 */
export const AREIA: Cores = {
  ...CLARO,
  fundo: '#FAF9F6',
  superficie: '#FFFFFF',
  superficie2: '#F7F5F0',
  superficie3: '#E7E3DB',
  faixaForte: '#DDD6CA',
  divisor: '#DDD8CF',
  borda: '#B9B3A9',
  campo: '#FFFFFF',
  bordaCampo: '#77736B',
};

/** Modo de uma paleta: decide a barra de status, as paletas das agendas e da identificação e o esquema do Uniwind. */
export type ModoDoTema = 'ESCURO' | 'CLARO';

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
  fundo: '#06141B',
  superficie: '#11212D',
  superficie2: '#0D1C26',
  superficie3: '#1F2E3A',
  faixaForte: '#263540',
  divisor: '#303E48',
  borda: '#48545D',
  campo: '#162531',
  bordaCampo: '#737C83',
});

export const AMEIXA: Cores = paletaEscura({
  fundo: '#190019',
  superficie: '#2B124C',
  superficie2: '#240B38',
  superficie3: '#382057',
  faixaForte: '#3E275C',
  divisor: '#473163',
  borda: '#5C4975',
  campo: '#2F1750',
  bordaCampo: '#827395',
});

/** Cartão ajustado da prévia (o original era #1C2541): o mais claro em que série feita, tingido e neutro passam 4,5:1. */
export const OCEANO: Cores = paletaEscura({
  fundo: '#0B132B',
  superficie: '#1A223C',
  superficie2: '#141C35',
  superficie3: '#232B44',
  faixaForte: '#2A314A',
  divisor: '#383F55',
  borda: '#4F5569',
  campo: '#1F2640',
  bordaCampo: '#787D8C',
});

/** Cartão ajustado da prévia (o original era #3A2418): o mais claro em que série feita, tingido e neutro passam 4,5:1. */
export const CAFE: Cores = paletaEscura({
  fundo: '#1A120E',
  superficie: '#301E14',
  superficie2: '#271912',
  superficie3: '#38271D',
  faixaForte: '#3E2E24',
  divisor: '#4B3B33',
  borda: '#60524A',
  campo: '#342319',
  bordaCampo: '#857A74',
});

export const LAVANDA: Cores = { ...CLARO, fundo: '#F7F8FF', superficie3: '#E6E0FF' };
export const CEU: Cores = { ...CLARO, fundo: '#F0F7FF', superficie3: '#DBEAFE' };
export const ROSA: Cores = { ...CLARO, fundo: '#FFF9FB', superficie3: '#FCE7F3' };

/** Código da paleta (= `Tema` da API, o `temaPadrao` da consultoria) → nome na tela, cores e modo. Fonte única do modo. */
export const PALETAS: Record<Tema, { nome: string; cores: Cores; modo: ModoDoTema }> = {
  ESCURO: { nome: 'Escuro', cores: ESCURO, modo: 'ESCURO' },
  MEIA_NOITE: { nome: 'Meia-noite', cores: MEIA_NOITE, modo: 'ESCURO' },
  AMEIXA: { nome: 'Ameixa', cores: AMEIXA, modo: 'ESCURO' },
  OCEANO: { nome: 'Oceano', cores: OCEANO, modo: 'ESCURO' },
  CAFE: { nome: 'Café', cores: CAFE, modo: 'ESCURO' },
  CLARO: { nome: 'Claro', cores: CLARO, modo: 'CLARO' },
  AREIA: { nome: 'Areia', cores: AREIA, modo: 'CLARO' },
  LAVANDA: { nome: 'Lavanda', cores: LAVANDA, modo: 'CLARO' },
  CEU: { nome: 'Céu', cores: CEU, modo: 'CLARO' },
  ROSA: { nome: 'Rosa', cores: ROSA, modo: 'CLARO' },
};

/**
 * A paleta de um código, com reserva no Escuro: um código que o app não conhece (app antigo com a API nova, ou o contrário)
 * nunca derruba a tela. Todo código vindo de fora (marca da sessão, prévia) passa por aqui, não por `PALETAS[codigo]`.
 */
export const paletaDe = (codigo: string | null | undefined): (typeof PALETAS)[Tema] =>
  (codigo && Object.hasOwn(PALETAS, codigo) ? PALETAS[codigo as Tema] : undefined) ?? PALETAS.ESCURO;

export const modoDaPaleta = (codigo: string | null | undefined): ModoDoTema => paletaDe(codigo).modo;

/**
 * Paleta fixa das agendas pessoais (D7): a cor IDENTIFICA a agenda (ponto ou barra lateral), nunca diz status. Cada chave
 * tem o par claro e escuro, longe dos tons de `sucesso`/`atencao`/`perigo`. Fica fora de `Cores` de propósito: não é token
 * de superfície e não muda no contraste alto (o texto do evento usa `texto`). Cada cor chega a 3:1 sobre o fundo e as
 * superfícies do tema (marcador, WCAG 1.4.11); `tokens.test.ts` confere isso e a distância das cores de status.
 */
export const CHAVES_DA_AGENDA: readonly CorDaAgenda[] = ['AZUL', 'INDIGO', 'VIOLETA', 'MAGENTA', 'TURQUESA', 'ARDOSIA', 'TERRA', 'OLIVA'];

export const PALETA_DA_AGENDA: Record<'claro' | 'escuro', Record<CorDaAgenda, string>> = {
  claro: {
    AZUL: '#1B6FD6', INDIGO: '#4B3FBF', VIOLETA: '#9333B8', MAGENTA: '#C0306F',
    TURQUESA: '#0B7F8A', ARDOSIA: '#51677E', TERRA: '#A64F43', OLIVA: '#758418',
  },
  escuro: {
    AZUL: '#4A90F7', INDIGO: '#8B7CF0', VIOLETA: '#C07DE8', MAGENTA: '#E8579F',
    TURQUESA: '#2BBFC9', ARDOSIA: '#8FA3B8', TERRA: '#BE8068', OLIVA: '#A8B53F',
  },
};

/** Cor do marcador de uma agenda pela chave e pelo tema em uso; chave desconhecida cai em ARDOSIA, a mais neutra. */
export function corDaAgenda(chave: string | null | undefined, escuro: boolean): string {
  const paleta = PALETA_DA_AGENDA[escuro ? 'escuro' : 'claro'];
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

export const PALETA_SO_DO_PERFIL: Record<'claro' | 'escuro', Record<CorSoDoPerfil, string>> = {
  claro: { LARANJA: '#D15700' },
  escuro: { LARANJA: '#FF7A1A' },
};

/** Tom de uma cor do perfil: uma das agendas ou uma só do perfil. */
export type TomDoPerfil = CorDaAgenda | CorSoDoPerfil;

/** Cor do anel e da amostra do perfil no tema em uso; o que não é só do perfil sai da paleta das agendas. */
export function corDoTomDoPerfil(tom: TomDoPerfil, escuro: boolean): string {
  const so = PALETA_SO_DO_PERFIL[escuro ? 'escuro' : 'claro'];
  return Object.hasOwn(so, tom) ? so[tom as CorSoDoPerfil] : corDaAgenda(tom, escuro);
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

export const PALETA_DE_IDENTIFICACAO: Record<'claro' | 'escuro', Record<ChaveDeIdentificacao, string>> = {
  claro: { CIANO: '#00698A', AZUL: '#1A5CBA', INDIGO: '#4B3FBF', VIOLETA: '#8A2DB0', MAGENTA: '#A3237F' },
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
export function coresDeIdentificacao(cores: Cores, escuro: boolean): Record<ChaveDeIdentificacao, CorDeIdentificacao> {
  const paleta = PALETA_DE_IDENTIFICACAO[escuro ? 'escuro' : 'claro'];
  const resultado = {} as Record<ChaveDeIdentificacao, CorDeIdentificacao>;
  for (const chave of CHAVES_DE_IDENTIFICACAO) {
    resultado[chave] = { cor: paleta[chave], fundo: tingido(paleta[chave], cores.superficie) };
  }
  return resultado;
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
