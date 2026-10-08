import { CLARO, contraste, ESCURO } from '../tema/tokens';

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

/**
 * Confere a cor da marca contra o texto branco que vai por cima (≥ 4,5, a mesma régua das paletas) e contra o fundo dos
 * dois temas (≥ 3). Não usa `textoSobre` aqui: ele escolhe branco ou preto e o melhor dos dois nunca fica abaixo de
 * 4,58, então nunca bloquearia.
 */
export function avaliarMarca(hex: string): AvaliacaoDaMarca {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return { bloqueia: null, aviso: null };
  const bloqueia = contraste(hex, '#FFFFFF') < 4.5 ? 'Esta cor deixa o texto dos botões difícil de ler.' : null;
  const apagadoNoEscuro = contraste(hex, ESCURO.fundo) < 3;
  const apagadoNoClaro = contraste(hex, CLARO.fundo) < 3;
  const onde = apagadoNoEscuro && apagadoNoClaro ? 'Nos dois temas' : apagadoNoEscuro ? 'No tema escuro' : apagadoNoClaro ? 'No tema claro' : null;
  return { bloqueia, aviso: onde ? `${onde}, ícones e o menu ativo ficam apagados.` : null };
}
