import type { Cores } from '../tema/tokens';

/**
 * Preferências visuais de cada pessoa, só neste aparelho e para a conta dela (não vão para a API nem para log). A
 * cor da marca não entra aqui: é do treinador e vale para todos os alunos dele.
 */
export type TemaEscolhido = 'CONSULTORIA' | 'ESCURO' | 'CLARO' | 'SISTEMA';
export type Contraste = 'PADRAO' | 'ALTO';
export type TamanhoTexto = 'PADRAO' | 'MEDIO' | 'GRANDE' | 'EXTRA';
export type Movimento = 'SISTEMA' | 'REDUZIDO';

export interface Preferencias {
  tema: TemaEscolhido;
  contraste: Contraste;
  tamanhoTexto: TamanhoTexto;
  movimento: Movimento;
  /** Só aparece no celular. */
  vibracao: boolean;
  /** Gráficos de progresso por exercício e de peso; desligado, só as listas. */
  graficos: boolean;
  /** Só na web: barras de rolagem (e demais controles do navegador) no escuro quando o tema em uso é escuro. */
  barrasEscuras: boolean;
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  tema: 'CONSULTORIA',
  contraste: 'PADRAO',
  tamanhoTexto: 'PADRAO',
  movimento: 'SISTEMA',
  vibracao: true,
  graficos: true,
  barrasEscuras: true,
};

const TEMAS: readonly TemaEscolhido[] = ['CONSULTORIA', 'ESCURO', 'CLARO', 'SISTEMA'];
const CONTRASTES: readonly Contraste[] = ['PADRAO', 'ALTO'];
const TAMANHOS: readonly TamanhoTexto[] = ['PADRAO', 'MEDIO', 'GRANDE', 'EXTRA'];
const MOVIMENTOS: readonly Movimento[] = ['SISTEMA', 'REDUZIDO'];

function entre<T extends string>(valor: unknown, validos: readonly T[], padrao: T): T {
  return typeof valor === 'string' && (validos as readonly string[]).includes(valor) ? (valor as T) : padrao;
}

/** Aceita o texto salvo ou o objeto; valor desconhecido ou faltando volta ao padrão, sem derrubar o app. */
export function normalizarPreferencias(qualquer: unknown): Preferencias {
  let bruto: unknown = qualquer;
  if (typeof bruto === 'string') {
    try {
      bruto = JSON.parse(bruto);
    } catch {
      return { ...PREFERENCIAS_PADRAO };
    }
  }
  const o = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : {};
  return {
    tema: entre(o.tema, TEMAS, PREFERENCIAS_PADRAO.tema),
    contraste: entre(o.contraste, CONTRASTES, PREFERENCIAS_PADRAO.contraste),
    tamanhoTexto: entre(o.tamanhoTexto, TAMANHOS, PREFERENCIAS_PADRAO.tamanhoTexto),
    movimento: entre(o.movimento, MOVIMENTOS, PREFERENCIAS_PADRAO.movimento),
    vibracao: typeof o.vibracao === 'boolean' ? o.vibracao : PREFERENCIAS_PADRAO.vibracao,
    graficos: typeof o.graficos === 'boolean' ? o.graficos : PREFERENCIAS_PADRAO.graficos,
    barrasEscuras: typeof o.barrasEscuras === 'boolean' ? o.barrasEscuras : PREFERENCIAS_PADRAO.barrasEscuras,
  };
}

const FATORES: Record<TamanhoTexto, number> = { PADRAO: 1, MEDIO: 1.12, GRANDE: 1.25, EXTRA: 1.4 };

export function fatorDoTexto(tamanho: TamanhoTexto): number {
  return FATORES[tamanho];
}

/** Tamanho de fonte (ou altura de linha) com o fator aplicado, em número inteiro. */
export function escalar(valor: number, fator: number): number {
  return Math.round(valor * fator);
}

/**
 * Contraste alto: borda de cartão e divisão ficam tão nítidas quanto a borda de campo, e o texto secundário fica mais
 * forte (≥ 7:1 sobre todas as superfícies).
 */
export function coresComContraste(cores: Cores, contraste: Contraste, escuro: boolean): Cores {
  if (contraste === 'PADRAO') return cores;
  return {
    ...cores,
    borda: cores.bordaCampo,
    divisor: cores.borda,
    textoSuave: escuro ? '#C4C4CC' : '#3F3F46',
  };
}
