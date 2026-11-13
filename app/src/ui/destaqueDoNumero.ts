import type { ViewStyle } from 'react-native';

import type { EnfaseDoNumero, FuncaoDeDestaque } from '../dominio/destaque';
import { RAIO, type CorDeDestaque, type Cores } from '../tema/tokens';

/** Regras puras da peça `NumeroDeDestaque` (sem React, para o Jest medir os pares em `contrasteDasPecas.test.ts`). */

/** Largura da faixa lateral do número com destaque; sem destaque o recuo compensa, para o conteúdo não pular. */
export const LARGURA_DA_FAIXA = 4;

export interface AparenciaDoNumero {
  /** Cor do número: a da função, `texto` (neutro) ou `textoSuave` (zero ou sem dado, D5; o que os distingue é o texto, D14). */
  numero: string;
  /** Fundo da peça: tonalizado com destaque, `superficie` sem. */
  fundo: string;
  /** Fundo no hover/pressionado (peça tocável): tonalizado sobre `superficie2`. */
  fundoSobre: string;
  /** Cor da faixa lateral; `null` sem destaque. */
  faixa: string | null;
}

/** Regra pura da aparência (D1, D4, D5): a cor fica só no número, na faixa e no fundo; rótulo e detalhe seguem neutros. */
export function aparenciaDoNumero(enfase: EnfaseDoNumero, cores: Pick<Cores, 'texto' | 'textoSuave' | 'superficie' | 'superficie2'>,
  destaques: Record<FuncaoDeDestaque, CorDeDestaque>): AparenciaDoNumero {
  if (enfase === 'neutro' || enfase === 'zero' || enfase === 'indisponivel') {
    return { numero: enfase === 'neutro' ? cores.texto : cores.textoSuave, fundo: cores.superficie, fundoSobre: cores.superficie2, faixa: null };
  }
  const d = destaques[enfase];
  return { numero: d.cor, fundo: d.fundo, fundoSobre: d.fundoSobre, faixa: d.cor };
}

/**
 * Contorno do contêiner: `divisor` na espessura do bloco e, com destaque, a faixa de 4 px à esquerda. Sem faixa o recuo
 * da esquerda cresce o que a borda não ocupa, e o conteúdo fica no mesmo lugar com e sem destaque.
 */
export function contornoDoNumero(faixa: string | null, cores: Pick<Cores, 'divisor'>, bloco: number, recuo: number): ViewStyle {
  return {
    borderWidth: bloco, borderColor: cores.divisor, borderRadius: RAIO,
    borderLeftWidth: faixa ? LARGURA_DA_FAIXA : bloco, borderLeftColor: faixa ?? cores.divisor,
    paddingLeft: recuo + (faixa ? 0 : LARGURA_DA_FAIXA - bloco),
  };
}
