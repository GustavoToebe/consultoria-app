import type { Cores } from '../tema/tokens';

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
