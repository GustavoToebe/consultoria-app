import { textoSobre, type Cores } from './tokens';
/** Os tokens continuam sendo a fonte de todas as cores, inclusive as variáveis do RNR. */
export function variaveisDoTema(cores: Cores, marca: string) {
 return {
  '--color-background': cores.fundo, '--color-foreground': cores.texto,
  '--color-card': cores.superficie, '--color-card-foreground': cores.texto,
  '--color-muted': cores.superficie2, '--color-muted-foreground': cores.textoSuave,
  '--color-accent': cores.superficie3, '--color-accent-foreground': cores.texto,
  '--color-secondary': cores.superficie2, '--color-secondary-foreground': cores.texto,
  '--color-border': cores.borda, '--color-input': cores.bordaCampo, '--color-ring': marca,
  '--color-primary': marca, '--color-primary-foreground': textoSobre(marca),
  '--color-destructive': cores.perigo, '--color-sucesso': cores.sucesso,
  '--color-atencao': cores.atencao, '--color-perigo': cores.perigo, '--color-neutro': cores.neutro,
 };
}
