import type { Tema } from '../api/tipos';
import { CLARO, contraste, ESCURO, PALETAS as PALETAS_DO_TEMA } from '../tema/tokens';

export interface Paleta {
  id: string;
  nome: string;
  cor: string;
  descricao: string;
}

/**
 * Cores prontas para a marca da consultoria. O servidor continua recebendo só o `#RRGGBB`: a paleta é um atalho.
 * Todas têm texto branco com contraste ≥ 4,5 por cima e ≥ 3 contra o fundo dos dois temas (ícone e menu ativo).
 */
export const PALETAS: Paleta[] = [
  { id: 'vermelho', nome: 'Vermelho intenso', cor: '#C62828', descricao: 'Força e energia' },
  { id: 'laranja', nome: 'Laranja', cor: '#C2410C', descricao: 'Calor e explosão' },
  { id: 'ambar', nome: 'Âmbar', cor: '#A16207', descricao: 'Ouro e conquista' },
  { id: 'verde', nome: 'Verde', cor: '#15803D', descricao: 'Saúde e equilíbrio' },
  { id: 'esmeralda', nome: 'Esmeralda', cor: '#047857', descricao: 'Profundo e sóbrio' },
  { id: 'turquesa', nome: 'Turquesa', cor: '#0F766E', descricao: 'Leve e moderno' },
  { id: 'ciano', nome: 'Ciano', cor: '#0E7490', descricao: 'Água e foco' },
  { id: 'azul', nome: 'Azul', cor: '#2563EB', descricao: 'Confiança' },
  { id: 'indigo', nome: 'Índigo', cor: '#4F46E5', descricao: 'Concentração' },
  { id: 'roxo', nome: 'Roxo', cor: '#7C3AED', descricao: 'Ousado' },
  { id: 'magenta', nome: 'Magenta', cor: '#BE185D', descricao: 'Vibrante' },
  { id: 'bronze', nome: 'Bronze', cor: '#9A5B13', descricao: 'Terroso, clássico' },
];

/** Paleta com exatamente esta cor (sem diferenciar maiúsculas), ou `undefined` = "Cor personalizada". */
export function paletaDaCor(hex: string): Paleta | undefined {
  return PALETAS.find((p) => p.cor.toLowerCase() === hex.trim().toLowerCase());
}

export interface AvaliacaoDaMarca {
  /** Texto dos botões ilegível sobre esta cor: não deixa salvar. */
  bloqueia: string | null;
  /** Ícone e menu ativo ficam apagados em um dos temas: só avisa. */
  aviso: string | null;
}

/** CIELAB (D65) de uma cor #RRGGBB, só para medir "parecida com" (a mesma conta do `tokens.test.ts`). */
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

/** Distância mínima (ΔE CIE76) da marca ao vermelho de erro; a mesma que o `tokens.test.ts` exige das agendas. */
export const DISTANCIA_DO_STATUS = 25;

/**
 * D10 do `docs/planos/auditoria-cores.md`: marca parecida com o vermelho de erro (`perigo`) em um dos dois temas. Só avisa,
 * nunca bloqueia o Salvar; a tela distingue pela forma (ícone e texto) e não pela cor. Verde e âmbar não avisam (decisão
 * de 03/11: avisar nas seis cores prontas viraria ruído). Cor inválida ou longe do vermelho: `null`.
 */
export function avisoDeMarcaPertoDeStatus(hex: string): string | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const alvo = lab(hex);
  const perto = [CLARO, ESCURO].some((t) => Math.hypot(...lab(t.perigo).map((v, i) => v - alvo[i])) < DISTANCIA_DO_STATUS);
  return perto ? 'Esta cor lembra a de erro (vermelho). Avisos e botões de confirmação continuam distintos pelo ícone e pelo texto.' : null;
}

/**
 * Confere a cor da marca contra o texto branco que vai por cima (≥ 4,5, a mesma régua das paletas), contra o fundo e o
 * cartão da paleta escolhida (decisão 4 de `docs/planos/paletas-da-marca.md`) e contra o fundo do Escuro e do Claro, que
 * o aluno ainda pode escolher nas Preferências (≥ 3). Não usa `textoSobre` aqui: ele escolhe branco ou preto e o melhor
 * dos dois nunca fica abaixo de 4,58, então nunca bloquearia.
 */
export function avaliarMarca(hex: string, tema: Tema): AvaliacaoDaMarca {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return { bloqueia: null, aviso: null };
  const bloqueia = contraste(hex, '#FFFFFF') < 4.5 ? 'Esta cor deixa o texto dos botões difícil de ler.' : null;
  const apagada = (...fundos: string[]) => fundos.some((f) => contraste(hex, f) < 3);
  const { nome, cores } = PALETAS_DO_TEMA[tema];
  const onde = [
    apagada(cores.fundo, cores.superficie) ? `na paleta ${nome}` : null,
    tema !== 'ESCURO' && apagada(ESCURO.fundo) ? 'no tema escuro' : null,
    tema !== 'CLARO' && apagada(CLARO.fundo) ? 'no tema claro' : null,
  ].filter(Boolean).join(' e ');
  return { bloqueia, aviso: onde ? `${onde.charAt(0).toUpperCase()}${onde.slice(1)}, ícones e o menu ativo ficam apagados.` : null };
}
