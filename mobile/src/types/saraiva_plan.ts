export type SetType = 
  | 'WARMUP'       // Aquecimento (0.3 do WS)
  | 'FEEDER_1'     // Feeder Set 1 (0.5 ou 0.7 do WS)
  | 'FEEDER_2'     // Feeder Set 2 (0.7 ou 0.85 do WS)
  | 'FEEDER_3'     // Feeder Set 3 (0.85 a 0.90 do WS)
  | 'WORKING_SET'  // Working Set (1.0 do WS)
  | 'TOP_SET'      // Top Set (1.1 do WS ou maior carga do dia)
  | 'BACKOFF'      // Back off (0.85 ou 0.90 do WS)
  | 'REST_PAUSE'   // Rest Pause (1.0 do WS, falha + 20-30s + falha)
  | 'CLUSTER';     // Muscle Round

export interface PresetSetPlan {
  kind: SetType;
  label: string;
  repRange: string;
  multiplier: number; // ex: 0.3, 0.5, 0.7, 0.85, 0.9, 1.0, 1.1
}

export interface PresetExercise {
  id: string;
  name: string;
  substitutes?: string[]; // Opções alternativas do BD (ex: Remada cavalinho, chinesa...)
  category: 'Costas' | 'Peito' | 'Ombro' | 'Tríceps' | 'Bíceps' | 'Quadríceps' | 'Posterior' | 'Glúteo';
  isFreeWeight: boolean; // Se true -> 1 RIR nas séries válidas. Se false -> falha.
  videoUrl?: string;
  notes?: string;
  setsPlan: PresetSetPlan[];
}

export interface PresetDivision {
  code: 'A1' | 'B1' | 'A2' | 'B2' | 'A3' | 'B3';
  title: string; // Ex: "A1 - Upper Heavy"
  type: 'Upper' | 'Lower';
  exercises: PresetExercise[];
}

export interface DayWorkoutPlan {
  dayOfWeek: 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Domingo';
  title: string; // Ex: "Costas", "Peito + Ombros", "Pernas", "Off ativo"
  cardioMin?: number;
  isOffDay: boolean;
  exercises: PresetExercise[];
}
