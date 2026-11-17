import { misturar, type Cores } from '../tema/tokens';

/**
 * Seleção neutra (11/11, troca a seleção invertida): a cor da marca nunca diz "escolhido"; o que diz é a superfície de
 * seleção (`sobre`, 17/11) com o contorno forte (`bordaCampo`, ≥ 3:1 contra a seleção e a trilha, `tokens.test.ts`) e,
 * nos chips, o ✓. Peças: `Escolha`, `Abas`, chips de filtro, opções de lista, calendário.
 */

/** Chip ou opção solta (várias escolhas ou mais de cinco opções): escolhido = superfície de seleção + ✓. */
export const coresDaSelecao = (cores: Pick<Cores, 'superficie' | 'sobre' | 'bordaCampo' | 'texto'>, escolhido: boolean) => ({
  fundo: escolhido ? cores.sobre : cores.superficie,
  borda: cores.bordaCampo,
  texto: cores.texto,
});

/**
 * Segmento (uma escolha entre poucas, numa trilha `superficie2`): o escolhido sobe para o cartão com o contorno forte;
 * os outros ficam sem contorno, com o texto secundário.
 */
export const coresDoSegmento = (cores: Pick<Cores, 'superficie' | 'superficie2' | 'bordaCampo' | 'texto' | 'textoSuave'>, escolhido: boolean) =>
  escolhido
    ? { fundo: cores.superficie, borda: cores.bordaCampo, texto: cores.texto }
    : { fundo: 'transparent', borda: 'transparent', texto: cores.textoSuave };

/**
 * Item EM EDIÇÃO (visual-ponytail, 17/11): o que a pessoa está mexendo agora (sessão, exercício, série, refeição) leva três
 * sinais juntos, todos na cor de ação: fundo `acaoSuave`, contorno `acao` com halo e o selo "Editando" (`SeloEditando`).
 * Não é a seleção neutra de chips e opções.
 */
export const coresDaEdicao = (cores: Pick<Cores, 'acao' | 'acaoSuave' | 'superficie'>) => ({
  fundo: cores.acaoSuave,
  borda: cores.acao,
  halo: `0px 0px 0px 4px ${misturar(cores.superficie, cores.acao, 0.18)}`,
});
