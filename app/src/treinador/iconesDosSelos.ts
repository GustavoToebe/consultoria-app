import { CalendarClock, CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react-native';

import type { TipoSelo } from '../ui/Selo';

/**
 * Ícone do selo de status pelo tom (estilo novo: selo com ícone, a pílula do editor de treino): pronto, atenção,
 * problema e "agendado" no neutro. Fonte única (D13 de `cores-de-destaque.md`: o mesmo selo em todas as telas) da lista
 * de alunos, de Atualizações, de Números, do Resumo da ficha e das pastas.
 */
export const ICONE_DO_SELO: Record<TipoSelo, LucideIcon> = {
  sucesso: CircleCheck,
  atencao: TriangleAlert,
  perigo: CircleAlert,
  neutro: CalendarClock,
};
