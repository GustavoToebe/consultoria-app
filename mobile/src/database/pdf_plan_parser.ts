import { PresetExercise } from '../types/saraiva_plan';

export interface DayWorkoutSchedule {
  dayName: string; // "Segunda", "Terça", etc.
  focus: string;   // "Costas", "Peito + Ombros", etc.
  isOff: boolean;
  cardioMin?: number;
  exercises: PresetExercise[];
}

/**
 * Mapeamento fiel e exato dos exercícios e divisões do PDF Saraiva Team
 * (Gustavo Cesar Toebe - Plano 16):
 * - Segunda: Costas
 * - Terça: Peito + Ombros
 * - Quarta: Pernas
 * - Quinta: Off ativo (Cardio 50 min)
 * - Sexta: Upper
 * - Sábado: Pernas
 * - Domingo: Off ativo (Cardio 50 min)
 */
export const SARAIVA_PDF_SCHEDULE: DayWorkoutSchedule[] = [
  {
    dayName: 'Segunda',
    focus: 'Costas',
    isOff: false,
    exercises: [
      {
        id: 'pdf_seg_1',
        name: 'Remada baixa na polia unilateral',
        category: 'Costas',
        isFreeWeight: false,
        notes: 'Back off - 85% WS. Tronco levemente inclinado para o lado.',
        setsPlan: [
          { kind: 'WARMUP', label: 'Aquecimento', repRange: '10 - 15', multiplier: 0.3 },
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6 (Falha)', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_seg_2',
        name: 'Puxada alta com pegada romana (neutra)',
        category: 'Costas',
        isFreeWeight: false,
        notes: 'Back off - 85% WS.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6 (Falha)', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_seg_3',
        name: 'Remada na máquina com pegada neutra (unilateral)',
        category: 'Costas',
        isFreeWeight: false,
        notes: 'Back off - 85% WS.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6 (Falha)', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_seg_4',
        name: 'Elevação lateral com halteres',
        category: 'Ombro',
        isFreeWeight: true,
        notes: '1 RIR nas séries válidas.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set 1', repRange: '6 - 8 (1 RIR)', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 2', repRange: '6 - 8 (1 RIR)', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 3', repRange: '6 - 8 (1 RIR)', multiplier: 1.0 },
        ],
      },
    ],
  },
  {
    dayName: 'Terça',
    focus: 'Peito + Ombros + Tríceps',
    isOff: false,
    exercises: [
      {
        id: 'pdf_ter_1',
        name: 'Supino reto na máquina (sentado)',
        category: 'Peito',
        isFreeWeight: false,
        notes: 'Back off - 85% WS.',
        setsPlan: [
          { kind: 'WARMUP', label: 'Aquecimento', repRange: '10 - 15', multiplier: 0.3 },
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6 (Falha)', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_ter_2',
        name: 'Supino inclinado na máquina',
        category: 'Peito',
        isFreeWeight: false,
        notes: 'Back off - 85% WS.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3 - 5', multiplier: 0.7 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3 - 5', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6 (Falha)', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_ter_3',
        name: 'Desenvolvimento na máquina articulada (pegada neutra)',
        category: 'Ombro',
        isFreeWeight: false,
        notes: 'Back off - 85% WS. Prefira pegada neutra.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6 (Falha)', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_ter_4',
        name: 'Tríceps na polia com corda',
        category: 'Tríceps',
        isFreeWeight: false,
        notes: 'Back off - 90% WS.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set 1', repRange: '6 - 8', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 2', repRange: '6 - 8', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off', repRange: '8 - 10', multiplier: 0.90 },
        ],
      },
      {
        id: 'pdf_ter_5',
        name: 'Tríceps cruzado na polia (unilateral)',
        category: 'Tríceps',
        isFreeWeight: false,
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set 1', repRange: '6 - 8', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 2', repRange: '6 - 8', multiplier: 1.0 },
        ],
      },
    ],
  },
  {
    dayName: 'Quarta',
    focus: 'Pernas',
    isOff: false,
    exercises: [
      {
        id: 'pdf_qua_1',
        name: 'Clamshell (com band)',
        category: 'Glúteo',
        isFreeWeight: true,
        setsPlan: [
          { kind: 'WORKING_SET', label: 'Working Set 1', repRange: '8 - 10', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 2', repRange: '8 - 10', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 3', repRange: '8 - 10', multiplier: 1.0 },
        ],
      },
      {
        id: 'pdf_qua_2',
        name: 'Mesa flexora',
        category: 'Posterior',
        isFreeWeight: false,
        notes: 'Back off - 90% WS.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3 - 5', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3 - 5', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3 - 5', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.90 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.90 },
        ],
      },
      {
        id: 'pdf_qua_3',
        name: 'Cadeira flexora',
        category: 'Posterior',
        isFreeWeight: false,
        notes: 'Back off - 90% WS.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off', repRange: '6 - 8', multiplier: 0.90 },
        ],
      },
      {
        id: 'pdf_qua_4',
        name: 'Leg press horizontal',
        category: 'Quadríceps',
        isFreeWeight: false,
        notes: 'Back off - 85% WS.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_qua_5',
        name: 'Elevação pélvica na máquina ou com barra',
        category: 'Glúteo',
        isFreeWeight: false,
        notes: 'Carga baixa, controle extremo. Não é para progressão pesada.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3 - 5', multiplier: 0.7 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3 - 5', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set 1', repRange: '6 - 8', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 2', repRange: '6 - 8', multiplier: 1.0 },
        ],
      },
    ],
  },
  {
    dayName: 'Quinta',
    focus: 'Off ativo',
    isOff: true,
    cardioMin: 50,
    exercises: [],
  },
  {
    dayName: 'Sexta',
    focus: 'Upper',
    isOff: false,
    exercises: [
      {
        id: 'pdf_sex_1',
        name: 'Remada na máquina articulada (pegada pronada simultâneo)',
        category: 'Costas',
        isFreeWeight: false,
        notes: 'Back off - 85% WS.',
        setsPlan: [
          { kind: 'WARMUP', label: 'Aquecimento', repRange: '5 - 10', multiplier: 0.3 },
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_sex_2',
        name: 'Supino inclinado no smith (banco em 30º)',
        category: 'Peito',
        isFreeWeight: false,
        notes: 'Back off - 85% WS.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_sex_3',
        name: 'High row (unilateral)',
        category: 'Costas',
        isFreeWeight: false,
        notes: 'Back off - 85% WS.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_sex_4',
        name: 'Tríceps na polia com corda',
        category: 'Tríceps',
        isFreeWeight: false,
        notes: 'Back off - 85% WS.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3', multiplier: 0.7 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.85 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.85 },
        ],
      },
      {
        id: 'pdf_sex_5',
        name: 'Elevação lateral na máquina',
        category: 'Ombro',
        isFreeWeight: false,
        notes: 'Mantenha os braços esticados.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3 - 5', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set 1', repRange: '6 - 8', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 2', repRange: '6 - 8', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 3', repRange: '6 - 8', multiplier: 1.0 },
        ],
      },
    ],
  },
  {
    dayName: 'Sábado',
    focus: 'Pernas',
    isOff: false,
    exercises: [
      {
        id: 'pdf_sab_1',
        name: 'Cadeira flexora',
        category: 'Posterior',
        isFreeWeight: false,
        notes: 'Back off - 90% WS.',
        setsPlan: [
          { kind: 'WARMUP', label: 'Aquecimento', repRange: '5 - 10', multiplier: 0.3 },
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3 - 5', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3 - 5', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3 - 5', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set', repRange: '3 - 6', multiplier: 1.0 },
          { kind: 'BACKOFF', label: 'Back Off 1', repRange: '6 - 8', multiplier: 0.90 },
          { kind: 'BACKOFF', label: 'Back Off 2', repRange: '6 - 8', multiplier: 0.90 },
        ],
      },
      {
        id: 'pdf_sab_2',
        name: 'Stiff com barra livre',
        category: 'Posterior',
        isFreeWeight: true,
        notes: '1 RIR. Controle durante flexão e extensão do quadril.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3 - 5', multiplier: 0.5 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3 - 5', multiplier: 0.7 },
          { kind: 'FEEDER_3', label: 'Feeder Set 3', repRange: '3 - 5', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set 1', repRange: '6 - 8 (1 RIR)', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 2', repRange: '6 - 8 (1 RIR)', multiplier: 1.0 },
        ],
      },
      {
        id: 'pdf_sab_3',
        name: 'Leg press 45º',
        category: 'Quadríceps',
        isFreeWeight: false,
        notes: 'Extremamente controlado.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3 - 5', multiplier: 0.7 },
          { kind: 'FEEDER_2', label: 'Feeder Set 2', repRange: '3 - 5', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set 1', repRange: '6 - 8', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 2', repRange: '6 - 8', multiplier: 1.0 },
        ],
      },
      {
        id: 'pdf_sab_4',
        name: 'Abdução de quadril na polia',
        category: 'Glúteo',
        isFreeWeight: false,
        notes: 'Movimento bem curto.',
        setsPlan: [
          { kind: 'FEEDER_1', label: 'Feeder Set 1', repRange: '3 - 5', multiplier: 0.85 },
          { kind: 'WORKING_SET', label: 'Working Set 1', repRange: '6 - 8', multiplier: 1.0 },
          { kind: 'WORKING_SET', label: 'Working Set 2', repRange: '6 - 8', multiplier: 1.0 },
        ],
      },
    ],
  },
  {
    dayName: 'Domingo',
    focus: 'Off ativo',
    isOff: true,
    cardioMin: 50,
    exercises: [],
  },
];
