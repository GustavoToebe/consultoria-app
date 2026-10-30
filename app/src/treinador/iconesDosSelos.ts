import { CalendarClock, CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react-native';

import type { TipoSelo } from '../ui/Selo';

/**
 * Ícone do selo de status pelo tom (estilo novo: selo com ícone, a pílula do editor de treino): pronto, atenção,
 * problema e "agendado" no neutro. Os mesmos da lista de alunos (`app/treinador/alunos/index.tsx`, que ainda tem a
 * cópia local); usado em Atualizações e em Números.
 */
export const ICONE_DO_SELO: Record<TipoSelo, LucideIcon> = {
  sucesso: CircleCheck,
  atencao: TriangleAlert,
  perigo: CircleAlert,
  neutro: CalendarClock,
};
