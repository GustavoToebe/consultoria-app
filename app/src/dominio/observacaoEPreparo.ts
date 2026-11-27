/**
 * Seção "Observação e modo de preparo" da refeição no editor de dieta (27/11): o que o título mostra com a seção fechada
 * e se ela nasce aberta. Só conta e corta texto do treinador; nada é calculado sobre a comida.
 */

/** Limite da observação da refeição (o `@Size(max = 1000)` de `ConteudoDieta.Refeicao.observacao` na API). */
export const OBSERVACAO_DA_REFEICAO_MAXIMO = 1000;

const vazio = (texto: string | null | undefined) => !(texto ?? '').trim();

/** Linhas não vazias do modo de preparo (linha só com espaços não conta). */
export function linhasDoModoDePreparo(texto: string | null | undefined): number {
  return (texto ?? '').split(/\r?\n/).filter((l) => l.trim()).length;
}

/** Há algo escrito na observação ou no modo de preparo (só espaços é vazio): a seção nasce aberta. */
export function temObservacaoOuPreparo(observacao: string | null | undefined, modoDePreparo: string | null | undefined): boolean {
  return !vazio(observacao) || !vazio(modoDePreparo);
}

/** Vazia é válida; preenchida, até {@link OBSERVACAO_DA_REFEICAO_MAXIMO} caracteres, como a API. */
export function observacaoDaRefeicaoValida(texto: string | null | undefined): boolean {
  return (texto ?? '').length <= OBSERVACAO_DA_REFEICAO_MAXIMO;
}

/**
 * Resumo da seção fechada, em partes: o começo da observação numa linha (a tela corta com reticências) e "Modo de
 * preparo: N linhas". Nada escrito = `vazio`, que a tela mostra como "Nenhuma".
 */
export interface ResumoDaObservacaoEPreparo {
  observacao: string | null;
  preparo: string | null;
  vazio: boolean;
}

export function resumoDaObservacaoEPreparo(observacao: string | null | undefined, modoDePreparo: string | null | undefined): ResumoDaObservacaoEPreparo {
  const inicio = (observacao ?? '').replace(/\s+/g, ' ').trim();
  const linhas = linhasDoModoDePreparo(modoDePreparo);
  const preparo = linhas ? `Modo de preparo: ${linhas} ${linhas === 1 ? 'linha' : 'linhas'}` : null;
  return { observacao: inicio || null, preparo, vazio: !inicio && !preparo };
}

/** O mesmo resumo numa frase só (leitor de tela e teste): "Nenhuma" ou as partes separadas por " · ". */
export function textoDoResumo(r: ResumoDaObservacaoEPreparo): string {
  return r.vazio ? 'Nenhuma' : [r.observacao, r.preparo].filter(Boolean).join(' · ');
}
