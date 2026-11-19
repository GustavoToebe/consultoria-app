import type { Cores } from '../tema/tokens';

/** Regra pura do `CartaoDeIndicador` (sem React, para o Jest medir os pares em `contrasteDasPecas.test.ts`). */

/** Situação que o número sinaliza (cor como sinal): recebido = sucesso, pendência = atenção, atraso = perigo. */
export type TomDoIndicador = 'sucesso' | 'atencao' | 'perigo' | 'neutro';
/** `zero` ("R$ 0,00", "0") e `indisponivel` ("—" com o motivo) nunca levam o tom: zero não é alerta nem sucesso. */
export type EstadoDoIndicador = 'valor' | 'zero' | 'indisponivel';

export interface AparenciaDoIndicador {
  /** Faixa de 4 px à esquerda, ponto e ícone: a cor do tom (≥ 3:1 sobre o fundo do cartão); `null` sem tom. */
  faixa: string | null;
  /** Número: `texto`, ou `textoSuave` no zero e no indisponível (4,5:1). */
  valor: string;
  /** Rótulo: sempre `textoSuave` (o tom fica na faixa e no ponto; o rótulo diz o que é). */
  rotulo: string;
  /** `superficie` solto na página; `superficie2` (poço) dentro de um `Cartao`. */
  fundo: string;
}

export function aparenciaDoIndicador(
  tom: TomDoIndicador,
  estado: EstadoDoIndicador,
  lugar: 'pagina' | 'cartao',
  cores: Pick<Cores, 'texto' | 'textoSuave' | 'superficie' | 'superficie2' | 'sucesso' | 'atencao' | 'perigo'>,
): AparenciaDoIndicador {
  const apagado = estado !== 'valor';
  return {
    faixa: apagado || tom === 'neutro' ? null : cores[tom],
    valor: apagado ? cores.textoSuave : cores.texto,
    rotulo: cores.textoSuave,
    fundo: lugar === 'cartao' ? cores.superficie2 : cores.superficie,
  };
}
