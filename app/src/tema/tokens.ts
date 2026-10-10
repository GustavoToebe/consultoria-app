/**
 * Design flat utilitário (seção 10.3 do plano): cores sólidas, sem sombra nem gradiente, cantos de 8 px, bordas de
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
  sucesso: string;
  atencao: string;
  perigo: string;
  neutro: string;
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
  sucesso: '#1F9D55',
  atencao: '#B7791F',
  perigo: '#E5484D',
  neutro: '#6B6B73',
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
  sucesso: '#1A7F45',
  atencao: '#9A6412',
  perigo: '#C62828',
  neutro: '#8A8A92',
};

/** Cor neutra para telas sem marca (entrar, cadastro). */
export const MARCA_NEUTRA = '#52525B';

export const espaco = (n: number) => n * 8;
export const RAIO = 8;
export const ALVO_TOQUE = 44;
export const LARGURA_MAXIMA = 1800;
/** Telas declaradas até esta largura são formulários curtos e não esticam. */
export const LARGURA_FORMULARIO = 640;
export const LARGURA_MENU_LATERAL = 900;
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
