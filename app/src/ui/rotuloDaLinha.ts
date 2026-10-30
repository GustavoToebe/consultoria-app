import type { LucideIcon } from 'lucide-react-native';

import type { TipoSelo } from './Selo';

/** Selo de uma `LinhaDaLista`: só o que pede atenção, sempre com texto (com `Icone`, a pílula do editor de treino). */
export interface SeloDaLinha { texto: string; tipo: TipoSelo; Icone?: LucideIcon }

/** Nome acessível padrão da `LinhaDaLista`: "título, metadados, selo, selo". */
export function rotuloDaLinha(titulo: string, metadados?: string, selos: readonly SeloDaLinha[] = []): string {
  return [titulo, metadados, ...selos.map((s) => s.texto)].filter(Boolean).join(', ');
}
