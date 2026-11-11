import type { Cores } from '../tema/tokens';

/** Gravar nunca espera a animação ou o feedback do aparelho. */
export function aoPressionarMarcar({ aoTocar, animar, vibrar }: {
  aoTocar: () => void; animar: () => void; vibrar: () => void;
}) {
  aoTocar();
  animar();
  vibrar();
}

/**
 * Cores do ✓ (prévia aprovada de 11/11, `.marcar-mob`): vazio = campo com `bordaCampo` e sem ✓; feito = faixa
 * `superficie3` com o ✓ em `textoSuave` (o contorno de campo fica); feito agora (marcado com a tela aberta) = `sucessoSuave`
 * com borda e ✓ em `sucesso`; desabilitado (prévia, número inválido) = faixa `superficie3` com a `borda` suave, o ✓ só se
 * já estava feito. Vazio e feito se distinguem pelo ✓, não só pela cor. `icone` nulo = sem ✓. Só tokens, sem opacidade
 * (contrastes em `contrasteDasPecas.test.ts`).
 */
export function coresDoMarcar(
  cores: Pick<Cores, 'sucesso' | 'sucessoSuave' | 'bordaCampo' | 'borda' | 'campo' | 'superficie3' | 'textoSuave'>,
  { feito, desabilitado, pressionado, agora = false }: { feito: boolean; desabilitado: boolean; pressionado: boolean; agora?: boolean },
): { borda: string; fundo: string; icone: string | null } {
  if (desabilitado) return { borda: cores.borda, fundo: cores.superficie3, icone: feito ? cores.textoSuave : null };
  if (feito && agora) return { borda: cores.sucesso, fundo: cores.sucessoSuave, icone: cores.sucesso };
  if (feito) return { borda: cores.bordaCampo, fundo: cores.superficie3, icone: cores.textoSuave };
  return { borda: cores.bordaCampo, fundo: pressionado ? cores.superficie3 : cores.campo, icone: null };
}
