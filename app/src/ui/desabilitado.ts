import type { Cores } from '../tema/tokens';

/**
 * Visual único do que está desabilitado (D3 de `docs/planos/auditoria-cores.md`): fundo `superficie3`, borda `borda` e
 * texto e ícone `textoSuave`. Cinza, sem opacidade e sem a cor da marca. O texto segue ≥ 4,5:1 sobre o fundo, conferido
 * em `contrasteDasPecas.test.ts` (a WCAG 1.4.3 isenta o desabilitado, mas o `motivo` e o rótulo continuam legíveis).
 */
/** Só `desabilitado` vira cinza; `carregando` mantém o visual de antes (cor cheia a 50% com o spinner). */
export const visualDoInativo = (desabilitado?: boolean, carregando?: boolean) =>
  ({ cinza: !!desabilitado, apagado: !!carregando && !desabilitado });

export const coresDoDesabilitado = (cores: Pick<Cores, 'superficie3' | 'borda' | 'textoSuave'>) =>
  ({ fundo: cores.superficie3, borda: cores.borda, texto: cores.textoSuave });
