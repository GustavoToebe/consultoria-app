/**
 * Tipagens Fundamentais do Domínio de Treino, Dieta e Protocolo
 * Baseado na metodologia Saraiva Team e arquitetura Offline-First.
 */

export type WorkoutSplitType = 'A' | 'B'; // A: Upper, B: Lower/Biceps

export type ExerciseType = 'free_weight' | 'machine' | 'cable' | 'bodyweight';

export type SetKind = 
  | 'WARMUP'       // 30% WS
  | 'FEEDER_1'     // 50% WS
  | 'FEEDER_2'     // 70% WS
  | 'FEEDER_3'     // 85% WS
  | 'WORKING_SET'  // 100% WS (Livre = 1 RIR, Máquina = Falha)
  | 'BACKOFF';     // 85% ou 90% WS

export interface CalculatedSet {
  id: string;
  kind: SetKind;
  label: string;             // ex: "Aquecimento", "Feeder 1", "Top Set / WS", "Back-off"
  multiplier: number;        // ex: 0.3, 0.5, 0.7, 0.85, 1.0, 0.90
  targetReps: string;        // ex: "10-15", "3-5", "3", "Falha ou 1 RIR", "8-12"
  targetWeight: number;      // peso arredondado calculado em kg
  targetRir?: number;        // Repetições na reserva (1 RIR para livre, 0 para máquina)
  completedWeight?: number;  // Carga efetivamente levantada
  completedReps?: number;    // Repetições efetivamente feitas
  isCompleted: boolean;
  notes?: string;
}

export interface ExerciseDefinition {
  id: string;
  name: string;              // ex: "T-Bar Row", "Supino Inclinado", "Hack Squat"
  targetMuscle: string;      // ex: "Costas", "Peitoral", "Quadríceps"
  exerciseType: ExerciseType;
  defaultWorkingSetWeight: number; // Carga base de partida
  includeWarmup: boolean;
  feederCount: 1 | 2 | 3;
  backoffCount: number;
  backoffMultiplier: 0.85 | 0.90;
  order: number;
}

export interface WorkoutSession {
  id: string;
  splitType: WorkoutSplitType;
  name: string;              // ex: "A1 - Upper Heavy", "B1 - Lower Quad Focus"
  date: string;              // ISO String
  startedAt?: string;
  finishedAt?: string;
  isSynced: boolean;
  exercises: ExerciseSession[];
}

export interface ExerciseSession {
  id: string;
  exerciseId: string;
  exerciseName: string;
  workingSetWeight: number;  // Carga definida para o Working Set
  sets: CalculatedSet[];
  notes?: string;
}

// Log consolidado para espelhar a estrutura do Log.csv e envio para a API
export interface WorkoutExecutionLog {
  id: string;
  sessionId: string;
  date: string;              // YYYY-MM-DD
  split: string;             // A1, B1, etc.
  exerciseName: string;
  setKind: SetKind;
  finalWeight: number;
  completedReps: number;
  rir?: number;
  sync: boolean;
  createdAt: string;
}

// Dieta Estática (2.236 kcal)
export interface MealOption {
  id: string;
  name: string;              // ex: "Opção A: Arroz Branco (200g) + Peito de Frango (150g)"
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface MealChecklistItem {
  id: string;
  mealNumber: number;        // 1 a 6
  name: string;              // "Refeição 1 - Café da manhã"
  scheduledTime?: string;    // "08:00"
  options: MealOption[];
  selectedOptionId?: string;
  isCompleted: boolean;
  completedAt?: string;
}

// Suplementação e Farmacologia
export interface ProtocolItem {
  id: string;
  name: string;              // ex: "Vitamina D3", "NAC", "Enantato de Testosterona"
  dosage: string;            // ex: "10.000 UI", "600mg", "150mg"
  category: 'SUPPLEMENT' | 'MEDICATION' | 'HORMONAL';
  frequency: 'DAILY' | 'SCHEDULED_DAYS';
  scheduledDays?: number[];  // 0-6 (domingo a sábado, ex: Segunda e Quinta)
  isCompleted: boolean;
  lastTakenAt?: string;
}

export interface DailyHydrationLog {
  date: string;
  targetMl: number;          // 3000 a 4000 ml
  currentMl: number;
}
