import { misturar, type Cores, type VarianteDoTema } from '../tema/tokens';
import { superficiePintada, type SuperficiePintada } from '../ui/superficiePintada';

export type EstadoDoMarcar = 'FEITA' | 'PRONTA' | 'INCOMPLETA';

/**
 * Cores do ✓ da tela do exercício (pedido de 25/11): pronta (tem kg e reps) = neutro forte, fundo `texto` e ✓ `fundo`
 * (preto no claro, branco no escuro, como o botão principal); incompleta = contorno tracejado `bordaCampo` sem ✓ cheio;
 * feita = verde cheio (`sucesso`) com o ✓ `fundo`. Contraste travado em `aluno/MarcarSerie.test.ts`.
 */
export function coresDoMarcarSerie(cores: Pick<Cores, 'texto' | 'fundo' | 'sucesso' | 'bordaCampo' | 'textoSuave' | 'campo'>, estado: EstadoDoMarcar) {
  if (estado === 'FEITA') return { fundo: cores.sucesso, borda: cores.sucesso, icone: cores.fundo, tracejado: false };
  if (estado === 'PRONTA') return { fundo: cores.texto, borda: cores.texto, icone: cores.fundo, tracejado: false };
  return { fundo: cores.campo, borda: cores.bordaCampo, icone: cores.textoSuave, tracejado: true };
}

/** A série da vez (a primeira não feita), a já feita e as que ainda vêm depois. */
export type EstadoDaSerie = 'ATIVA' | 'FEITA' | 'PENDENTE';

/** Largura da faixa reta na cor do tipo, à esquerda do cartão da série. */
export const LARGURA_DA_FAIXA_DA_SERIE = 4;
/** Quanto da cor do tipo fica na série pendente (o resto é a superfície): fundo, borda e faixa mais apagados. */
export const COR_DA_PENDENTE = 0.5;
/** Faixa da pendente: mais apagada que a da ativa, mas ainda ≥ 3:1 sobre o cartão (medido nas 9 paletas). */
export const FAIXA_DA_PENDENTE = 0.75;
/** Borda da série ativa na cor de ação (pedido de 25/11); com as bordas reforçadas vale a mais grossa. */
export const BORDA_DA_ATIVA = 1.5;

export interface PinturaDaSerie {
  /** Fundo pintado (degradê) e borda na cor do tipo; nulo = tipo sem cor (fundo `superficie`, borda `divisor`). */
  pintada: SuperficiePintada | null;
  /** Cor da faixa lateral; nula = sem faixa. */
  faixa: string | null;
  borda: string;
  larguraDaBorda: number;
}

/**
 * Cartão da série na cor do tipo (Gustavo, 25/11): o padrão pintado de `ui/superficiePintada` sobre a `superficie`, com a
 * faixa reta de 4 px à esquerda. Feita fica na cor do tipo (o "feita" é o ✓ verde e o selo); a ativa leva a borda de ação
 * por cima; a pendente usa a cor do tipo diluída (`COR_DA_PENDENTE`), sem opacidade no texto. Contraste nas paletas em
 * `coresDoMarcarSerie.test.ts`.
 */
export function pinturaDaSerie(
  corDoTipo: string | null,
  estado: EstadoDaSerie,
  cores: Pick<Cores, 'superficie' | 'divisor' | 'acao' | 'texto'>,
  variante: VarianteDoTema,
  bordaDoItem: number,
): PinturaDaSerie {
  const ativa = estado === 'ATIVA';
  const larguraDaBorda = ativa ? Math.max(BORDA_DA_ATIVA, bordaDoItem) : bordaDoItem;
  if (!corDoTipo) return { pintada: null, faixa: null, borda: ativa ? cores.acao : cores.divisor, larguraDaBorda };
  const pendente = estado === 'PENDENTE';
  const tom = pendente ? misturar(cores.superficie, corDoTipo, COR_DA_PENDENTE) : corDoTipo;
  const pintada = superficiePintada(tom, cores.superficie, variante, cores);
  return {
    pintada,
    faixa: pendente ? misturar(cores.superficie, corDoTipo, FAIXA_DA_PENDENTE) : corDoTipo,
    borda: ativa ? cores.acao : pintada.borda,
    larguraDaBorda,
  };
}
