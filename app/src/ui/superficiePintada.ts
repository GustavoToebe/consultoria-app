import { Platform, type ViewStyle } from 'react-native';

import { contraste, misturar, type Cores, type VarianteDoTema } from '../tema/tokens';

/**
 * Superfície "pintada" com uma cor de situação ou de categoria (cartão de indicador pintado, 23/11): fundo em degradê
 * diagonal da cor misturada à base até a base pura, borda de 1 px na cor misturada à base e, para o texto, a própria cor
 * só quando ela passa 4,5:1 sobre o ponto mais forte do fundo (senão `cores.texto`). Regra pura, sem React, para o Jest
 * medir os pares (`tema/tokens.test.ts`) e para outras peças reusarem (ex.: linha de lesão ativa tingida de `atencao`).
 *
 * Contrato de reuso:
 * - `superficiePintada(cor, base, variante, cores)`: `cor` = `cores.sucesso|atencao|perigo|informacao|conquista` ou a cor
 *   de identificação do tema (`useTema().identificacao[chave].cor`); `base` = o fundo neutro onde a peça fica
 *   (`superficie` solta na página, `superficie2` dentro de um `Cartao`). Devolve `{ base, forte, degrade, borda, texto }`.
 * - `fundoPintado(p)`: o estilo do fundo (degradê no web e no nativo, `forte` liso por baixo). Quem prefere fundo liso
 *   (linha de lista, faixa estreita) usa `backgroundColor: p.forte`; o contraste é medido nele, então vale igual.
 * - Texto por cima: `p.texto` para o que vai na cor (rótulo, número); o resto em `cores.texto`/`textoSuave` (≥ 4,5:1 sobre
 *   `forte`, travado no teste). Marca (ponto, ícone) na própria `cor` (≥ 3:1 sobre `forte`).
 * Neutro (sem significado) não passa por aqui: fundo `base` e borda `divisor`, como sempre.
 */

/** Quanto da cor entra no canto mais forte: 14% nas escuras; 11% nas claras (Claro, Areia, Céu, Lavanda, Rosa). 26/11: 8% ficava apagado e 12% ou mais derruba o `textoSuave` abaixo de 4,5:1 no Claro e no Céu. */
export const TINTA_DA_PINTURA: Record<VarianteDoTema, number> = { escuro: 0.14, claro: 0.11, areia: 0.11 };
/** Onde o degradê chega à base pura (em % da diagonal): o terço de baixo do cartão fica neutro. */
export const FIM_DO_DEGRADE = 70;
/** Quanto da cor entra na borda (o resto é a base). */
const TINTA_DA_BORDA = 0.5;

export interface SuperficiePintada {
  /** O fundo neutro de sempre, onde o degradê termina. */
  base: string;
  /** Ponto mais forte (canto superior esquerdo): a cor misturada à base. É onde o contraste do texto é medido. */
  forte: string;
  /** `linear-gradient(135deg, forte 0%, base 70%)`, CSS (web) e `experimental_backgroundImage` (nativo). */
  degrade: string;
  /** Borda de 1 px: a cor a 50% sobre a base. */
  borda: string;
  /** Cor do texto que leva o sinal (rótulo, número): a própria cor se ≥ 4,5:1 sobre `forte`, senão `cores.texto`. */
  texto: string;
}

export function superficiePintada(cor: string, base: string, variante: VarianteDoTema, cores: Pick<Cores, 'texto'>): SuperficiePintada {
  const forte = misturar(base, cor, TINTA_DA_PINTURA[variante]);
  return {
    base,
    forte,
    degrade: `linear-gradient(135deg, ${forte} 0%, ${base} ${FIM_DO_DEGRADE}%)`,
    borda: misturar(base, cor, TINTA_DA_BORDA),
    texto: contraste(cor, forte) >= 4.5 ? cor : cores.texto,
  };
}

/**
 * Fundo da superfície pintada: o degradê (`experimental_backgroundImage` no nativo, RN 0.76+ na Nova Arquitetura;
 * `backgroundImage` no web, que o react-native-web repassa ao CSS) sobre o `forte` liso, que fica se o degradê não pintar.
 */
export function fundoPintado(p: SuperficiePintada): ViewStyle {
  // A chave do web não existe no `ViewStyle` do React Native: o mesmo molde do `position: 'sticky'` das telas.
  return Platform.OS === 'web'
    ? ({ backgroundColor: p.forte, backgroundImage: p.degrade } as unknown as ViewStyle)
    : { backgroundColor: p.forte, experimental_backgroundImage: p.degrade };
}
