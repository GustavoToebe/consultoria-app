import type { CorDasSeries } from '../dominio/preferencias';
import { contraste, misturar, type ChaveDeIdentificacao, type CorDeIdentificacao, type Cores, type VarianteDoTema } from '../tema/tokens';
import { superficiePintada, type SuperficiePintada } from './superficiePintada';

/**
 * Pintura das séries do treino (Gustavo, 25/11), a mesma no executar (`aluno/CartaoDaSerie`) e no montar
 * (`treinador/treino/TabelaDeBlocos`): o padrão pintado de `ui/superficiePintada` na cor da série e a faixa reta de 4 px à
 * esquerda (`ui/CamadaDaSerie`). `ATIVA` = a série da vez (borda de ação por cima); `CHEIA` = a cor inteira (a série feita
 * no aluno, a linha fechada no editor); `APAGADA` = a pendente, com a cor diluída (o texto nunca perde opacidade).
 * Contraste nas 9 paletas × contraste alto × bordas reforçadas × as duas preferências em `pinturaDaSerie.test.ts`.
 */
export type EstadoDaSerie = 'ATIVA' | 'CHEIA' | 'APAGADA';

/** Largura da faixa reta na cor da série, à esquerda do cartão. */
export const LARGURA_DA_FAIXA_DA_SERIE = 4;
/** Quanto da cor fica na série apagada (o resto é a base): fundo e borda mais fracos. */
export const COR_DA_APAGADA = 0.5;
/** Faixa da apagada: mais fraca que a da ativa, mas ainda ≥ 3:1 sobre o cartão (medido nas 9 paletas). */
export const FAIXA_DA_APAGADA = 0.75;
/** Borda da série ativa na cor de ação; com as bordas reforçadas vale a mais grossa. */
export const BORDA_DA_ATIVA = 1.5;

export interface PinturaDaSerie {
  /** Fundo pintado (degradê) e borda na cor da série; nulo = série sem cor (fundo da base, borda `divisor`). */
  pintada: SuperficiePintada | null;
  /** Cor da faixa lateral; nula = sem faixa. */
  faixa: string | null;
  borda: string;
  larguraDaBorda: number;
}

/**
 * A cor de uma série pela preferência "Cor das séries": a do tipo (`identificacao[chave]`) ou, em "Cor de ação", a de ação
 * da pessoa para todas. `categoria` é a cor do selo do tipo: só no modo do tipo (no de ação o selo fica neutro e o tipo
 * se lê pelo nome). Série sem cor de tipo ("Outro", cardio) fica sem cor nos dois modos.
 */
export function corDaSerie(
  modo: CorDasSeries,
  chave: ChaveDeIdentificacao | null | undefined,
  identificacao: Record<ChaveDeIdentificacao, CorDeIdentificacao> | undefined,
  cores: Pick<Cores, 'acao'>,
): { cor: string | null; categoria: CorDeIdentificacao | null } {
  if (!chave || !identificacao) return { cor: null, categoria: null };
  return modo === 'ACAO' ? { cor: cores.acao, categoria: null } : { cor: identificacao[chave].cor, categoria: identificacao[chave] };
}

export function pinturaDaSerie(
  cor: string | null,
  estado: EstadoDaSerie,
  cores: Pick<Cores, 'superficie' | 'divisor' | 'acao' | 'texto' | 'textoSuave' | 'bordaCampo' | 'perigo' | 'atencao'>,
  variante: VarianteDoTema,
  bordaDoItem: number,
): PinturaDaSerie {
  const base = cores.superficie;
  const ativa = estado === 'ATIVA';
  const larguraDaBorda = ativa ? Math.max(BORDA_DA_ATIVA, bordaDoItem) : bordaDoItem;
  if (!cor) return { pintada: null, faixa: null, borda: ativa ? cores.acao : cores.divisor, larguraDaBorda };
  const apagada = estado === 'APAGADA';
  // Cor clara demais no tema escuro (a cor de ação amarela, verde-água ou laranja, a marca) clareia o fundo e o contorno dos
  // campos ou o texto em âmbar e vermelho caem abaixo do mínimo: a tinta diminui até passarem. As do tipo passam inteiras.
  const passa = (forte: string) => contraste(cores.bordaCampo, forte) >= 3
    && [cores.texto, cores.textoSuave, cores.perigo, cores.atencao].every((t) => contraste(t, forte) >= 4.5);
  let tinta = apagada ? COR_DA_APAGADA : 1;
  let pintada = superficiePintada(misturar(base, cor, tinta), base, variante, cores);
  while (!passa(pintada.forte) && tinta > 0.1) {
    tinta -= 0.1;
    pintada = superficiePintada(misturar(base, cor, tinta), base, variante, cores);
  }
  return {
    pintada,
    faixa: apagada ? misturar(base, cor, FAIXA_DA_APAGADA) : cor,
    borda: ativa ? cores.acao : pintada.borda,
    larguraDaBorda,
  };
}
