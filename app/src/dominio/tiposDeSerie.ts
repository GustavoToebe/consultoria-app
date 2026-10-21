import type { Tecnica } from '../api/tipos';
import { semAcento } from './telas';

/**
 * Tipo da série (para que ela serve, segundo a metodologia: aquecimento, FS, WS, back off…) não é técnica (como executar:
 * cluster, rest pause, drop-set, que mora em `Serie.tecnica`). Espelho de `ConfiguracaoConsultoria` na API: mudou lá, mude aqui.
 */
export const NOMES_DE_TECNICA: readonly string[] = ['cluster', 'rest pause', 'restpause', 'drop set', 'dropset'];

const TECNICA_POR_CHAVE: Record<string, Tecnica['tipo']> = {
  cluster: 'CLUSTER',
  'rest pause': 'REST_PAUSE',
  restpause: 'REST_PAUSE',
  'drop set': 'DROP_SET',
  dropset: 'DROP_SET',
};

/** Chave de comparação de um nome de tipo: sem acento, minúsculas, hífen/travessão/NBSP viram espaço, espaços colapsados (igual à API). */
export function chaveDeTipo(nome: string): string {
  return semAcento(nome.replace(/[-–— ]/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** "Cluster", "Rest-pause", "DROP SET"… são técnicas da série, não tipos. */
export function nomeDeTecnica(nome: string): boolean {
  return NOMES_DE_TECNICA.includes(chaveDeTipo(nome));
}

/** Mesmo texto da recusa da API (`ConfiguracaoConsultoria.validar`). */
export function mensagemTipoETecnica(nome: string): string {
  return `"${nome.trim()}" é uma técnica, não um tipo de série: escolha a técnica na própria série.`;
}

/** A técnica cujo nome é igual ao do tipo (metodologia antiga com "Cluster" como tipo), ou `null`. */
export function tecnicaHomonima(nome: string): Tecnica['tipo'] | null {
  return TECNICA_POR_CHAVE[chaveDeTipo(nome)] ?? null;
}
