/**
 * Design flat utilitário (seção 10.3 do plano): cores sólidas, sem sombra nem gradiente, cantos de 8 px, bordas de
 * 1 px, grade de 8 px. A cor da marca só aparece em ação principal, menu ativo e título da marca; status nunca usa a
 * cor da marca (verde ok, âmbar pendente, vermelho erro, cinza inativo) e sempre vem com texto.
 */
export interface Cores {
  fundo: string;
  superficie: string;
  superficie2: string;
  borda: string;
  texto: string;
  textoSuave: string;
  sucesso: string;
  atencao: string;
  perigo: string;
  neutro: string;
}

export const ESCURO: Cores = {
  fundo: '#0E0E10',
  superficie: '#17171A',
  superficie2: '#1F1F23',
  borda: '#2A2A2F',
  texto: '#F2F2F3',
  textoSuave: '#9A9AA2',
  sucesso: '#1F9D55',
  atencao: '#B7791F',
  perigo: '#E5484D',
  neutro: '#6B6B73',
};

export const CLARO: Cores = {
  fundo: '#F4F4F5',
  superficie: '#FFFFFF',
  superficie2: '#F0F0F2',
  borda: '#DCDCE0',
  texto: '#111114',
  textoSuave: '#5F5F67',
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
export const LARGURA_MAXIMA = 1100;
export const LARGURA_MENU_LATERAL = 900;

export const fontes = {
  normal: 'Inter_400Regular',
  semi: 'Inter_600SemiBold',
  negrito: 'Inter_700Bold',
  metal: 'MetalMania_400Regular',
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
