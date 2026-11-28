/**
 * Quantas prévias o editor dos PDFs mostra e quais (`/treinador/documentos/personalizar`, 28/11), pela largura medida da
 * ÁREA DE PRÉVIA (não da janela nem da área de conteúdo): de 2400 px, as três lado a lado, cada uma com o título; de 1500 a
 * 2400, duas, cada uma com o segmento "Treino · Dieta · Mobilidade"; abaixo, uma com o segmento. Sem React nem plataforma.
 */

export type DocumentoDaPrevia = 'treino' | 'dieta' | 'mobilidade';

export const DOCUMENTOS_DA_PREVIA: readonly DocumentoDaPrevia[] = ['treino', 'dieta', 'mobilidade'];
/** Da esquerda para a direita, enquanto ninguém escolheu (duas prévias: Treino e Dieta; uma: Treino). */
export const ESCOLHIDOS_PADRAO: readonly [DocumentoDaPrevia, DocumentoDaPrevia] = ['treino', 'dieta'];
/** A partir desta largura da área de prévia, duas prévias. */
export const AREA_DAS_DUAS_PREVIAS = 1500;
/** A partir desta, as três e sem segmento. */
export const AREA_DAS_TRES_PREVIAS = 2400;

export interface PreviasDaLargura {
  /** Um documento por coluna, da esquerda para a direita. */
  documentos: DocumentoDaPrevia[];
  /** Cada coluna tem o segmento para trocar o documento (`false`: o título simples, com as três à vista). */
  escolha: boolean;
}

export function previasDaLargura(area: number, escolhidos: readonly [DocumentoDaPrevia, DocumentoDaPrevia] = ESCOLHIDOS_PADRAO): PreviasDaLargura {
  if (area >= AREA_DAS_TRES_PREVIAS) return { documentos: [...DOCUMENTOS_DA_PREVIA], escolha: false };
  if (area >= AREA_DAS_DUAS_PREVIAS) return { documentos: [...escolhidos], escolha: true };
  return { documentos: [escolhidos[0]], escolha: true };
}

/**
 * Escolher `documento` na coluna `lado`: o mesmo documento nunca fica nos dois lados. Escolher o que o outro lado mostra
 * TROCA os dois (o outro passa a mostrar o que este tinha), em vez de apagar a opção: as três continuam a um toque de cada
 * lado, sem motivo de desabilitado para ler. Com uma prévia só (lado 0), a troca guarda o par para quando abrir a segunda.
 */
export function escolherNaPrevia(
  escolhidos: readonly [DocumentoDaPrevia, DocumentoDaPrevia],
  lado: 0 | 1,
  documento: DocumentoDaPrevia,
): [DocumentoDaPrevia, DocumentoDaPrevia] {
  const proximo: [DocumentoDaPrevia, DocumentoDaPrevia] = [escolhidos[0], escolhidos[1]];
  const outro = lado === 0 ? 1 : 0;
  if (proximo[outro] === documento) proximo[outro] = proximo[lado];
  proximo[lado] = documento;
  return proximo;
}
