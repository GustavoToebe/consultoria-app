import type { Cores } from '../tema/tokens';

/**
 * Cores do `Switch` (`components/ui/switch`). Ligado = seleção invertida (trilho `texto`, botão `fundo`), como chips e
 * escolhas; desligado = trilho `bordaCampo` com o botão `superficie`. Botão contra trilho e trilho contra o cartão ficam
 * ≥ 3:1 nos dois estados (WCAG 1.4.11, `contrasteDasPecas.test.ts`); o branco fixo de antes dava 1,95:1 no claro.
 */
export function coresDoInterruptor(cores: Pick<Cores, 'texto' | 'fundo' | 'bordaCampo' | 'superficie'>, ligado: boolean) {
  return ligado ? { trilho: cores.texto, botao: cores.fundo } : { trilho: cores.bordaCampo, botao: cores.superficie };
}
