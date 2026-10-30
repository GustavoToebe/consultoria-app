import type { CorDaAgenda } from '../api/agendaTipos';

/**
 * Design flat utilitário: cores sólidas, sem sombra nem gradiente, cantos de 12 px, bordas de
 * 1 px nos campos e 2 px nos blocos, grade de 8 px. A cor da marca só aparece em ação principal, menu e aba ativos, cartão "Hoje" e título da
 * marca; seleção (chips, escolhas) é invertida (fundo `texto`, letra `fundo`); status nunca usa a cor da marca (verde
 * ok, âmbar pendente, vermelho erro, cinza inativo) e sempre vem com texto.
 *
 * Níveis: fundo quase branco → cartão (`superficie` + `borda` de 2 px) → faixa do título (`superficie3`, ou `faixaForte` no
 * exercício, com linha de 3 px embaixo) → item (`superficie2` + `borda`).
 * Bordas e divisores ficaram mais fortes em 30/10 (reunião de 29/10: o treinador não via onde um bloco terminava); a
 * borda do cartão não precisa de 3:1 (é decorativa), mas passa de 1,9:1 nos dois temas.
 * Campo de digitar = `campo` + `bordaCampo` (mais escuro que o cartão, um "buraco" onde se escreve).
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
  texto: string;
  textoSuave: string;
  /** Status como texto e borda (≥ 4,5:1 sobre `superficie`, `superficie2` e `superficie3`). */
  sucesso: string;
  atencao: string;
  perigo: string;
  neutro: string;
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
  bordaCampo: '#63636B',
  texto: '#F4F4F5',
  textoSuave: '#A1A1AA',
  sucesso: '#2BB36A',
  atencao: '#D9962C',
  perigo: '#F0666B',
  neutro: '#9A9AA3',
  perigoFundo: '#C62828',
  anelFoco: '#F4F4F5',
  fase1: '#E3A0B6',
  fase2: '#7DCFC6',
  fase3: '#E2C56A',
  fase4: '#A9B6EA',
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
  bordaCampo: '#8A8A93',
  texto: '#111114',
  textoSuave: '#52525B',
  sucesso: '#176E3C',
  atencao: '#875710',
  perigo: '#B71C1C',
  neutro: '#616169',
  perigoFundo: '#B71C1C',
  anelFoco: '#111114',
  fase1: '#C46B86',
  fase2: '#5E8F8A',
  fase3: '#A67C2E',
  fase4: '#7A86C4',
};

/**
 * "Claro areia" (D2 da frente "Clareza do treinador", 30/10): a mesma regra do claro, com fundo e faixas em tom areia,
 * a pedido do Gustavo na reunião de 29/10. É só uma opção nas Preferências; o padrão continua o claro neutro. Status,
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

/** Cor neutra para telas sem marca (entrar, cadastro). */
export const MARCA_NEUTRA = '#52525B';

export const espaco = (n: number) => n * 8;
/** Cantos de 12 px (protótipo do editor, 30/10: o Gustavo escolheu 12 em vez de 8). */
export const RAIO = 12;
/**
 * Espessuras escolhidas no protótipo do editor (30/10): borda do bloco (cartão, sessão, exercício) de 2 px, linha de
 * 3 px embaixo da faixa do título e 2 px na borda de um item com cabeçalho próprio (o grupo de séries). Com o fundo
 * quase branco, quem separa os blocos é a borda e a faixa, não o cinza da página.
 */
export const BORDA_BLOCO = 2;
export const LINHA_DA_FAIXA = 3;
export const BORDA_ITEM = 2;
export const ALVO_TOQUE = 44;
export const LARGURA_MAXIMA = 1800;
/** Telas declaradas até esta largura são formulários curtos e não esticam. */
export const LARGURA_FORMULARIO = 640;
/** A partir daqui o treinador tem menu lateral (e barra de topo na web); abaixo, barra inferior do celular. */
export const LARGURA_MENU_LATERAL = 768;
/** Abaixo disto o menu lateral fica só com ícones (trilho) para sobrar espaço ao conteúdo. */
export const LARGURA_MENU_EXPANDIDO = 1024;
/** Editores e formulários longos (treino, dieta, modelo, marca, perfil). */
export const LARGURA_EDITOR = 1040;
/** Listas e painéis (ficha do aluno, início, alunos, biblioteca, planejamento): todo o espaço útil (= `LARGURA_MAXIMA`). */
export const LARGURA_LISTA = 1800;

export const fontes = {
  normal: 'Inter_400Regular',
  semi: 'Inter_600SemiBold',
  negrito: 'Inter_700Bold',
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
function misturar(cor: string, alvo: string, t: number): string {
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
