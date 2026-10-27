import type { TipoSelo } from './Selo';

/** Selo de uma `LinhaDaLista`: só o que pede atenção, sempre com texto. */
export interface SeloDaLinha { texto: string; tipo: TipoSelo }

/** Nome acessível padrão da `LinhaDaLista`: "título, metadados, selo, selo". */
export function rotuloDaLinha(titulo: string, metadados?: string, selos: readonly SeloDaLinha[] = []): string {
  return [titulo, metadados, ...selos.map((s) => s.texto)].filter(Boolean).join(', ');
}
