import type { Atualizacao } from '../api/tipos';
import { atualizacaoDaPasta } from './atualizacao';

/**
 * Qual atualização mostrar ao lado do editor do plano do aluno (reunião de 30/10).
 *
 * - A da pasta do plano, se o aluno já a enviou (ou foi revisada): `daPasta: true`.
 * - Senão, a última que o aluno enviou, de outra pasta: é a que o treinador lê ao montar os rascunhos da pasta
 *   renovada, que ainda não tem atualização. `daPasta: false`, e a tela diz de qual pasta e data ela é.
 * - Sem nenhuma enviada, a da pasta mesmo que ainda não enviada (mostra o status dela), ou null.
 */
export interface AtualizacaoParaOPlano { atualizacao: Atualizacao; daPasta: boolean }

// Sem predicado de tipo: no ramo falso a atualização continua podendo existir (só não foi enviada).
const enviada = (a: Atualizacao | null | undefined): boolean => !!a?.dataAtualizacao && !!a.enviadaEm;

export function atualizacaoParaOPlano(
  pastaId: string,
  atual: Atualizacao | null | undefined,
  historico: readonly Atualizacao[],
): AtualizacaoParaOPlano | null {
  const daPasta = atualizacaoDaPasta(pastaId, atual, historico);
  if (daPasta && enviada(daPasta)) return { atualizacao: daPasta, daPasta: true };
  const ultima = ultimaEnviada([...(atual ? [atual] : []), ...historico]);
  if (ultima) return { atualizacao: ultima, daPasta: false };
  return daPasta?.dataAtualizacao ? { atualizacao: daPasta, daPasta: true } : null;
}

/** A enviada de data mais recente; empate, a enviada por último. Não confia na ordem da lista. */
export function ultimaEnviada(lista: readonly Atualizacao[]): Atualizacao | null {
  let melhor: Atualizacao | null = null;
  for (const a of lista) {
    if (!enviada(a)) continue;
    if (!melhor || maisRecente(a, melhor)) melhor = a;
  }
  return melhor;
}

function maisRecente(a: Atualizacao, b: Atualizacao) {
  const da = a.dataAtualizacao ?? '';
  const db = b.dataAtualizacao ?? '';
  if (da !== db) return da > db;
  return (a.enviadaEm ?? '') > (b.enviadaEm ?? '');
}

/** "Atualização de Plano 16 · 20/10/2026": diz de onde vem a atualização que não é da pasta do plano. */
export function rotuloDaAtualizacaoAnterior(tituloDaPasta: string | null | undefined, data: string) {
  const pasta = tituloDaPasta?.trim() ? tituloDaPasta.trim() : 'outra pasta';
  return `Atualização de ${pasta} · ${data}`;
}

export const AVISO_SEM_ATUALIZACAO_NA_PASTA = 'A pasta deste plano ainda não tem atualização.';
