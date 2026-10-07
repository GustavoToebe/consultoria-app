import type { CalculatedSet, ExerciseDefinition, ExerciseType, SetKind } from '../types/workout';

/**
 * Arredonda a carga para o incremento mais próximo da anilha/máquina.
 * Por padrão, arredonda para o múltiplo de 0.5kg ou 1.0kg mais próximo.
 */
export function roundWeight(weight: number, step: number = 0.5): number {
  if (weight <= 0) return 0;
  return Math.round(weight / step) * step;
}

export interface GenerateSetsConfig {
  workingSetWeight: number;
  exerciseType: ExerciseType;
  includeWarmup?: boolean;
  feederCount?: 1 | 2 | 3;
  backoffCount?: number;
  backoffMultiplier?: 0.85 | 0.90;
}

/**
 * Engine de Cálculo Saraiva Team:
 * Calcula dinamicamente todas as séries de aquecimento, feeders, working set e back-offs
 * a partir da carga informada para o Working Set (WS).
 * 
 * Multiplicadores e Regras:
 * - Aquecimento: 0.3 (30% WS), 10-15 reps
 * - Feeder Set 1: 0.5 (50% WS), 3-5 reps
 * - Feeder Set 2: 0.7 (70% WS), 3 reps
 * - Feeder Set 3: 0.85 (85% WS), 3 reps
 * - Working Set / Top Set: 1.0 (100% WS), Livre = 1 RIR / Máquina = Falha
 * - Back-off Set: 0.85 ou 0.90 (85-90% WS), repetições de volume aumentado
 */
export function calculateWorkoutSets(config: GenerateSetsConfig): CalculatedSet[] {
  const {
    workingSetWeight,
    exerciseType,
    includeWarmup = true,
    feederCount = 2,
    backoffCount = 1,
    backoffMultiplier = 0.85,
  } = config;

  const sets: CalculatedSet[] = [];

  // 1. Aquecimento (30% WS - 10-15 reps)
  if (includeWarmup && workingSetWeight > 0) {
    sets.push({
      id: `warmup-${Date.now()}-1`,
      kind: 'WARMUP',
      label: 'Aquecimento',
      multiplier: 0.3,
      targetReps: '10-15',
      targetWeight: roundWeight(workingSetWeight * 0.3),
      isCompleted: false,
    });
  }

  // 2. Feeder Sets (50%, 70%, 85%)
  if (feederCount >= 1 && workingSetWeight > 0) {
    sets.push({
      id: `feeder-${Date.now()}-1`,
      kind: 'FEEDER_1',
      label: 'Feeder Set 1',
      multiplier: 0.5,
      targetReps: '3-5',
      targetWeight: roundWeight(workingSetWeight * 0.5),
      isCompleted: false,
    });
  }

  if (feederCount >= 2 && workingSetWeight > 0) {
    sets.push({
      id: `feeder-${Date.now()}-2`,
      kind: 'FEEDER_2',
      label: 'Feeder Set 2',
      multiplier: 0.7,
      targetReps: '3',
      targetWeight: roundWeight(workingSetWeight * 0.7),
      isCompleted: false,
    });
  }

  if (feederCount >= 3 && workingSetWeight > 0) {
    sets.push({
      id: `feeder-${Date.now()}-3`,
      kind: 'FEEDER_3',
      label: 'Feeder Set 3',
      multiplier: 0.85,
      targetReps: '3',
      targetWeight: roundWeight(workingSetWeight * 0.85),
      isCompleted: false,
    });
  }

  // 3. Working Set / Top Set (100% WS)
  const isMachine = exerciseType === 'machine' || exerciseType === 'cable';
  const targetRir = isMachine ? 0 : 1;
  const wsTargetText = isMachine ? 'Falha concêntrica' : '1 RIR (Reserva)';

  sets.push({
    id: `ws-${Date.now()}`,
    kind: 'WORKING_SET',
    label: 'Working Set (Top Set)',
    multiplier: 1.0,
    targetReps: `6-10 (${wsTargetText})`,
    targetWeight: roundWeight(workingSetWeight * 1.0),
    targetRir,
    isCompleted: false,
  });

  // 4. Back-off Sets (85% ou 90% WS)
  for (let i = 0; i < backoffCount; i++) {
    sets.push({
      id: `backoff-${Date.now()}-${i + 1}`,
      kind: 'BACKOFF',
      label: backoffCount > 1 ? `Back-off Set ${i + 1}` : 'Back-off Set',
      multiplier: backoffMultiplier,
      targetReps: '8-12',
      targetWeight: roundWeight(workingSetWeight * backoffMultiplier),
      isCompleted: false,
    });
  }

  return sets;
}
