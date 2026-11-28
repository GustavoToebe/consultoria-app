import type { FotoDaLinha } from '../api/tipos';
import { dataParaTela, numeroParaTela, SEM_DADO } from './formatos';

/**
 * Lista das fotos (28/11, pedido do Gustavo): um grupo por envio (anamnese ou atualização, que já tem uma data só), do
 * mais recente ao mais antigo, com o rótulo "11/11/2026 · Atualização · 90 kg", e as miniaturas numa grade que usa a
 * largura do cartão. Puro: o cartão só aplica.
 */
export interface EnvioDeFotos {
  chave: string;
  data: string;
  rotulo: string;
  fotos: FotoDaLinha[];
}

/** Largura de que cada miniatura se aproxima: várias por linha no PC, duas ou três no celular. */
export const MINIATURA_ALVO = 120;

export function rotuloDoEnvio(f: Pick<FotoDaLinha, 'data' | 'origem' | 'pesoKg'>): string {
  const peso = f.pesoKg == null ? SEM_DADO : `${numeroParaTela(f.pesoKg)} kg`;
  return `${dataParaTela(f.data)} · ${f.origem === 'ANAMNESE' ? 'Anamnese' : 'Atualização'} · ${peso}`;
}

/** Envio = origem + id (anamnese e atualização no mesmo dia ficam separadas: o rótulo diz de onde veio). */
export function enviosDasFotos(fotos: readonly FotoDaLinha[]): EnvioDeFotos[] {
  const envios = new Map<string, EnvioDeFotos>();
  for (const foto of [...fotos].sort((a, b) => b.data.localeCompare(a.data) || a.ordem - b.ordem)) {
    const chave = `${foto.origem}:${foto.origemId}`;
    const envio = envios.get(chave);
    if (envio) envio.fotos.push(foto);
    else envios.set(chave, { chave, data: foto.data, rotulo: rotuloDoEnvio(foto), fotos: [foto] });
  }
  return [...envios.values()];
}

/**
 * Quantas miniaturas por linha e o tamanho de cada uma para a linha fechar na largura medida (sem sobra à direita): o
 * número de colunas mais perto do alvo, nunca menos de uma. Sem largura ainda, nulo (a grade espera a medida).
 */
export function gradeDasMiniaturas(largura: number, vao: number, alvo = MINIATURA_ALVO): { colunas: number; tamanho: number } | null {
  if (!(largura > 0)) return null;
  const colunas = Math.max(1, Math.round((largura + vao) / (alvo + vao)));
  return { colunas, tamanho: Math.floor((largura - vao * (colunas - 1)) / colunas) };
}
