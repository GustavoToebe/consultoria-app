/**
 * Design flat utilitário: cores sólidas, sem sombra nem gradiente, cantos de 8 px, bordas de
 * 1 px, grade de 8 px. A cor da marca só aparece em ação principal, menu e aba ativos, "Treino de hoje" e título da
 * marca; seleção (chips, escolhas) é invertida (fundo `texto`, letra `fundo`); status nunca usa a cor da marca (verde
 * ok, âmbar pendente, vermelho erro, cinza inativo) e sempre vem com texto.
 *
 * Níveis: fundo → cartão (`superficie` + `borda`) → faixa de grupo (`superficie2`) → item (`superficie2` + `borda`).
 * Campo de digitar = `campo` + `bordaCampo` (mais escuro que o cartão, um "buraco" onde se escreve).
 */
export interface Cores {
  fundo: string;
  superficie: string;
  superficie2: string;
  superficie3: string;
  divisor: string;
  borda: string;
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
}

export const ESCURO: Cores = {
  fundo: '#0A0A0C',
  superficie: '#18181B',
  superficie2: '#222226',
  superficie3: '#2C2C31',
  divisor: '#2A2A2F',
  borda: '#3A3A41',
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
};

export const CLARO: Cores = {
  fundo: '#EAEAED',
  superficie: '#FFFFFF',
  superficie2: '#F4F4F5',
  superficie3: '#E7E7EA',
  divisor: '#E4E4E7',
  borda: '#D4D4D8',
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
};

/** Cor neutra para telas sem marca (entrar, cadastro). */
export const MARCA_NEUTRA = '#52525B';

export const espaco = (n: number) => n * 8;
export const RAIO = 8;
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
