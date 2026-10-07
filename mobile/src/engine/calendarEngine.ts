import { SARAIVA_PDF_SCHEDULE, DayWorkoutSchedule } from '../database/pdf_plan_parser';

export interface CalendarDayWorkout {
  dateStr: string;        // "2026-10-05"
  dayOfWeekName: string;  // "Segunda", "Terça", etc.
  formattedDate: string;  // "05/10"
  focus: string;          // "Costas", "Peito + Ombros", "Off ativo"...
  isOff: boolean;
  cardioMin?: number;
  schedule: DayWorkoutSchedule;
}

const DOW_MAP: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

/**
 * Gera a grade de calendário real de dias entre a data de início e a data de fim,
 * associando cada dia da semana ao respectivo treino da planilha de controle de cargas / PDF Saraiva Team.
 */
export function generateWorkoutCalendar(startDateStr: string, endDateStr: string): CalendarDayWorkout[] {
  const result: CalendarDayWorkout[] = [];

  const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

  const current = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);

  while (current <= end) {
    const dowNumber = current.getDay();
    const dayOfWeekName = DOW_MAP[dowNumber];

    // Busca o treino mapeado daquele dia da semana
    const scheduleMatch = SARAIVA_PDF_SCHEDULE.find((s: DayWorkoutSchedule) => s.dayName === dayOfWeekName) || SARAIVA_PDF_SCHEDULE[0];

    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const formattedDate = `${d}/${m}`;

    result.push({
      dateStr,
      dayOfWeekName,
      formattedDate,
      focus: scheduleMatch.focus,
      isOff: scheduleMatch.isOff,
      cardioMin: scheduleMatch.cardioMin,
      schedule: scheduleMatch,
    });

    current.setDate(current.getDate() + 1);
  }

  return result;
}
