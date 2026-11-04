import { textoSobre, type Cores } from '../tema/tokens';

/** Gravar nunca espera a animação ou o feedback do aparelho. */
export function aoPressionarMarcar({ aoTocar, animar, vibrar }: {
  aoTocar: () => void; animar: () => void; vibrar: () => void;
}) {
  aoTocar();
  animar();
  vibrar();
}

/**
 * Cores do ✓: desabilitado (número inválido, também em cima de um já feito) = faixa `superficie3` com a `borda` suave,
 * igual aos outros botões desabilitados; feito = verde; vazio = campo com `bordaCampo`. Só tokens do tema, sem
 * opacidade (o ícone `textoSuave` segue ≥ 4,5:1 sobre a faixa, conferido em `contrasteDasPecas.test.ts`).
 */
export function coresDoMarcar(cores: Pick<Cores, 'sucesso' | 'bordaCampo' | 'borda' | 'campo' | 'superficie3' | 'textoSuave'>, { feito, desabilitado, pressionado }: { feito: boolean; desabilitado: boolean; pressionado: boolean }) {
  if (desabilitado) return { borda: cores.borda, fundo: cores.superficie3, icone: cores.textoSuave };
  if (feito) return { borda: cores.sucesso, fundo: cores.sucesso, icone: textoSobre(cores.sucesso) };
  return { borda: cores.bordaCampo, fundo: pressionado ? cores.superficie3 : cores.campo, icone: cores.textoSuave };
}
