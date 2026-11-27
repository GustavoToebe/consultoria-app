import { Platform, type ViewStyle } from 'react-native';

import { contraste, misturar, type Cores, type VarianteDoTema } from '../tema/tokens';

/**
 * Superfície "pintada" com uma cor de situação ou de categoria (cartão de indicador pintado, 23/11; tinta lisa nas claras,
 * 26/11): nas paletas claras (Claro, Areia, Céu, Lavanda, Rosa) o fundo é a cor misturada à base a 14%, **lisa** no cartão
 * inteiro (o degradê chegava ao branco e a metade do cartão sumia no fundo); no escuro, o degradê diagonal de 14%
 * (decisão visual aprovada). A borda é a neutra de sempre (`divisor`): cartão pintado não leva borda colorida. Para o
 * texto, a própria cor só quando ela passa 4,5:1 sobre o ponto mais forte do fundo (senão `cores.texto`), e só no valor: o
 * rótulo e o detalhe ficam neutros (`textoSuave`, ≥ 4,5:1 sobre `forte` nas claras, `tokens.test.ts`) e a cor da situação
 * fica no ponto e no valor. Regra pura, sem React, para o Jest medir os pares (`tema/tokens.test.ts`) e para outras peças
 * reusarem (ex.: linha de lesão ativa tingida de `atencao`). A regra mora aqui, não em cada tela.
 *
 * Contrato de reuso:
 * - `superficiePintada(cor, base, variante, cores)`: `cor` = `cores.sucesso|atencao|perigo|informacao|conquista` ou a cor
 *   de identificação do tema (`useTema().identificacao[chave].cor`); `base` = o fundo neutro onde a peça fica
 *   (`superficie` solta na página, `superficie2` dentro de um `Cartao`). Devolve `{ base, forte, degrade, borda, texto }`.
 * - `fundoPintado(p)`: o estilo do fundo (liso nas claras; degradê no escuro, web e nativo, com `forte` liso por baixo).
 * - Texto por cima: `p.texto` só para o valor (número); rótulo e detalhe em `textoSuave`; o resto em `cores.texto`. Marca
 *   (ponto, ícone) na própria `cor` (≥ 3:1 sobre `forte`).
 * Neutro (sem significado) não passa por aqui: fundo `base` e borda `divisor`, como sempre.
 */

/** Quanto da cor entra no fundo (liso nas claras, ponto mais forte do degradê no escuro): 14% em todas as paletas. */
export const TINTA_DA_PINTURA: Record<VarianteDoTema, number> = { escuro: 0.14, claro: 0.14, areia: 0.14 };
/** Onde o degradê do escuro chega à base pura (em % da diagonal): o terço de baixo do cartão fica neutro. */
export const FIM_DO_DEGRADE = 70;

export interface SuperficiePintada {
  /** O fundo neutro de sempre, onde o degradê termina. */
  base: string;
  /** O fundo: a cor misturada à base. Liso nas claras; no escuro é o ponto mais forte (canto superior esquerdo) do degradê. É onde o contraste do texto é medido. */
  forte: string;
  /** Só no escuro: `linear-gradient(135deg, forte 0%, base 70%)`, CSS (web) e `experimental_backgroundImage` (nativo). `null` nas claras (fundo liso). */
  degrade: string | null;
  /** Borda de 1 px: a neutra de sempre (`divisor`). */
  borda: string;
  /** Cor do texto que leva o sinal (o valor): a própria cor se ≥ 4,5:1 sobre `forte`, senão `cores.texto`. */
  texto: string;
}

export function superficiePintada(cor: string, base: string, variante: VarianteDoTema, cores: Pick<Cores, 'texto' | 'divisor'>): SuperficiePintada {
  const forte = misturar(base, cor, TINTA_DA_PINTURA[variante]);
  return {
    base,
    forte,
    degrade: variante === 'escuro' ? `linear-gradient(135deg, ${forte} 0%, ${base} ${FIM_DO_DEGRADE}%)` : null,
    borda: cores.divisor,
    texto: contraste(cor, forte) >= 4.5 ? cor : cores.texto,
  };
}

/**
 * Fundo da superfície pintada: o `forte` liso (claras) ou, no escuro, o degradê (`experimental_backgroundImage` no nativo,
 * RN 0.76+ na Nova Arquitetura; `backgroundImage` no web, que o react-native-web repassa ao CSS) sobre o `forte` liso, que
 * fica se o degradê não pintar.
 */
export function fundoPintado(p: SuperficiePintada): ViewStyle {
  if (!p.degrade) return { backgroundColor: p.forte };
  // A chave do web não existe no `ViewStyle` do React Native: o mesmo molde do `position: 'sticky'` das telas.
  return Platform.OS === 'web'
    ? ({ backgroundColor: p.forte, backgroundImage: p.degrade } as unknown as ViewStyle)
    : { backgroundColor: p.forte, experimental_backgroundImage: p.degrade };
}
