import type { Cores, VarianteDoTema } from '../tema/tokens';
import { superficiePintada, type SuperficiePintada } from './superficiePintada';

/** Regra pura do `CartaoDeIndicador` (sem React, para o Jest medir os pares em `contrasteDasPecas.test.ts`). */

/**
 * Situação que o número sinaliza (cor como sinal): recebido = sucesso, pendência = atenção, atraso = perigo, medida sem
 * juízo que precisa ser achada = informação, recorde = conquista. O resto é `neutro`. Categoria vem por `corDeCategoria`.
 */
export type TomDoIndicador = 'sucesso' | 'atencao' | 'perigo' | 'informacao' | 'conquista' | 'neutro';
/** `zero` ("R$ 0,00", "0") e `indisponivel` ("—" com o motivo) nunca levam a cor: zero não é alerta nem sucesso. */
export type EstadoDoIndicador = 'valor' | 'zero' | 'indisponivel';

export interface AparenciaDoIndicador {
  /** Fundo, borda e cor de texto pintados (`ui/superficiePintada`); `null` no neutro, no zero e no indisponível. */
  pintura: SuperficiePintada | null;
  /** Ponto e ícone: a cor (≥ 3:1 sobre o ponto mais forte do fundo); sem cor, o `corDoMarcador` (só a bolinha) ou `null`. */
  marca: string | null;
  /** Rótulo: a cor quando ela passa 4,5:1 (senão `texto`); sem cor, `textoSuave`. */
  rotulo: string;
  /** Número: a cor quando ela passa 4,5:1 (senão `texto`); sem cor, `texto`; zero e indisponível, `textoSuave`. */
  valor: string;
  /** Base neutra: `superficie` solto na página; `superficie2` (poço) dentro de um `Cartao`. */
  fundo: string;
  /** Contorno de 1 px: a cor a 50% com cor; `divisor` sem. */
  borda: string;
}

/**
 * `cor` = a da situação (`cores[tom]`) ou a de categoria; `null` = neutro. `corDoMarcador` (25/11): cor de categoria só na
 * bolinha do cartão neutro (cartão, borda, rótulo e valor seguem neutros); é identificação, então vale também no zero.
 */
export function aparenciaDoIndicador(
  cor: string | null,
  estado: EstadoDoIndicador,
  lugar: 'pagina' | 'cartao',
  cores: Pick<Cores, 'texto' | 'textoSuave' | 'superficie' | 'superficie2' | 'divisor'>,
  variante: VarianteDoTema,
  corDoMarcador: string | null = null,
): AparenciaDoIndicador {
  const fundo = lugar === 'cartao' ? cores.superficie2 : cores.superficie;
  const apagado = estado !== 'valor';
  if (apagado || !cor) {
    return { pintura: null, marca: corDoMarcador, rotulo: cores.textoSuave, valor: apagado ? cores.textoSuave : cores.texto, fundo, borda: cores.divisor };
  }
  const pintura = superficiePintada(cor, fundo, variante, cores);
  return { pintura, marca: cor, rotulo: pintura.texto, valor: pintura.texto, fundo, borda: pintura.borda };
}

/** A cor do tom no tema (`null` no neutro). */
export function corDoTom(tom: TomDoIndicador, cores: Pick<Cores, 'sucesso' | 'atencao' | 'perigo' | 'informacao' | 'conquista'>): string | null {
  return tom === 'neutro' ? null : cores[tom];
}
