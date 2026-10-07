import AsyncStorage from '@react-native-async-storage/async-storage';

const WORKING_WEIGHTS_KEY = '@saraiva_working_weights_v1';
const WORKOUT_LOGS_KEY = '@saraiva_workout_logs_v1';
const DAY_EXERCISE_DATA_KEY = '@saraiva_day_exercise_data_v2'; // chave individualizada por (data + exercicio)
const MEAL_CHECKLIST_KEY = '@saraiva_meal_checklist_v1';
const WATER_LOG_KEY = '@saraiva_water_log_v1';

export interface SavedExecutionLog {
  id: string;
  folderId?: string; // ID da Pasta / Plano (garante isolamento estrito de relatórios)
  date: string; // YYYY-MM-DD
  divisionCode: string;
  exerciseName: string;
  workingSetWeight: number;
  completedReps: number;
  rir?: number;
  notes?: string;
  isSynced: boolean;
  timestamp: number;
}

export interface DayExerciseState {
  workingSetWeight: number; // carga base do dia (topo)
  completedSetIndexes: number[]; // índices de séries concluídas neste dia específico
  customSetWeights?: Record<number, number>; // pesos editados manualmente por índice da série
  customSetReps?: Record<number, number>; // repetições feitas manualmente por índice da série
  notes?: string; // Anotações específicas do usuário para esta sessão
  actualWsWeight?: number; // Carga real executada na Working Set (se alterada na série da WS)
}

// Armazenamento de Última Carga de Trabalho Global
export async function getGlobalWorkingWeights(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(WORKING_WEIGHTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveGlobalWorkingWeight(exerciseName: string, weight: number): Promise<void> {
  const current = await getGlobalWorkingWeights();
  current[exerciseName] = weight;
  await AsyncStorage.setItem(WORKING_WEIGHTS_KEY, JSON.stringify(current));
}

const EXERCISE_WEIGHT_HISTORY_KEY = '@saraiva_exercise_weight_history_v2';

export interface ExerciseDateWeightRecord {
  date: string;
  weight: number;
  reps?: number;
}

// Histórico de pesos por exercício e data
export async function getExerciseWeightHistory(): Promise<Record<string, ExerciseDateWeightRecord[]>> {
  try {
    const raw = await AsyncStorage.getItem(EXERCISE_WEIGHT_HISTORY_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function recordExerciseWeightForDate(exerciseName: string, dateStr: string, weight: number, reps?: number): Promise<void> {
  if (weight <= 0) return;
  const history = await getExerciseWeightHistory();
  const list = history[exerciseName] || [];
  const filtered = list.filter(item => item.date !== dateStr);
  filtered.push({ date: dateStr, weight, reps });
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  history[exerciseName] = filtered;
  await AsyncStorage.setItem(EXERCISE_WEIGHT_HISTORY_KEY, JSON.stringify(history));
}

// ARMAZENAMENTO INDIVIDUALIZADO POR DIA ESPECÍFICO (dateStr + exerciseName)
export async function getDayExerciseState(dateStr: string, exerciseName: string): Promise<DayExerciseState> {
  try {
    const key = `${DAY_EXERCISE_DATA_KEY}_${dateStr}_${exerciseName}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed: DayExerciseState = JSON.parse(raw);
      // Se este dia já tem carga definida manualmente ou maior que 0, mantém
      if (parsed.workingSetWeight && parsed.workingSetWeight > 0) {
        return parsed;
      }
      // Se não tem carga definida neste dia, tenta herdar a carga do dia anterior
      const previousWeight = await getLatestWorkingWeightBeforeDate(dateStr, exerciseName);
      if (previousWeight > 0) {
        return {
          ...parsed,
          workingSetWeight: previousWeight,
        };
      }
      return parsed;
    }
  } catch {}

  // Caso ainda não exista registro para este dia específico,
  // herda automaticamente a carga da última sessão anterior realizada
  const previousWeight = await getLatestWorkingWeightBeforeDate(dateStr, exerciseName);
  return {
    workingSetWeight: previousWeight,
    completedSetIndexes: [],
    customSetWeights: {},
    customSetReps: {},
  };
}

export async function saveDayExerciseState(
  dateStr: string,
  exerciseName: string,
  state: DayExerciseState
): Promise<void> {
  const key = `${DAY_EXERCISE_DATA_KEY}_${dateStr}_${exerciseName}`;
  await AsyncStorage.setItem(key, JSON.stringify(state));

  // A carga que deve ser propagada para a próxima sessão é a carga real executada na WS
  const effectiveWsWeight = (state.actualWsWeight && state.actualWsWeight > 0)
    ? state.actualWsWeight
    : state.workingSetWeight;

  if (effectiveWsWeight > 0) {
    await saveGlobalWorkingWeight(exerciseName, effectiveWsWeight);
    await recordExerciseWeightForDate(exerciseName, dateStr, effectiveWsWeight);
  }
}

// Busca a carga da última sessão estritamente ANTERIOR à data informada
export async function getLatestWorkingWeightBeforeDate(dateStr: string, exerciseName: string): Promise<number> {
  // 1. Busca no histórico cronológico de dias registrados
  const history = await getExerciseWeightHistory();
  const list = history[exerciseName] || [];
  const previousEntries = list
    .filter(item => item.date < dateStr && item.weight > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (previousEntries.length > 0) {
    return previousEntries[0].weight;
  }

  // 2. Busca nos logs finalizados com data estritamente menor que dateStr
  const logs = await getWorkoutLogs();
  const matchingLogs = logs
    .filter(l => l.exerciseName === exerciseName && l.date < dateStr && l.workingSetWeight > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (matchingLogs.length > 0) {
    return matchingLogs[0].workingSetWeight;
  }

  // 3. Fallback: Se for o primeiro dia registrado, tenta carga global recente
  const globals = await getGlobalWorkingWeights();
  return globals[exerciseName] || 0;
}

// Logs Concluídos (filtráveis por pasta ou por intervalo de data)
export async function getWorkoutLogs(folderId?: string): Promise<SavedExecutionLog[]> {
  try {
    const raw = await AsyncStorage.getItem(WORKOUT_LOGS_KEY);
    if (!raw) return [];
    const allLogs: SavedExecutionLog[] = JSON.parse(raw);
    if (folderId) {
      return allLogs.filter(l => l.folderId === folderId);
    }
    return allLogs;
  } catch {
    return [];
  }
}

export async function saveWorkoutLog(log: SavedExecutionLog): Promise<void> {
  const current = await getWorkoutLogs();
  // Remove log duplicado do mesmo dia e mesmo exercício, se existir
  const filtered = current.filter(l => !(l.date === log.date && l.exerciseName === log.exerciseName));
  filtered.unshift(log);
  await AsyncStorage.setItem(WORKOUT_LOGS_KEY, JSON.stringify(filtered));
}

// Dieta e Refeições do Dia
export interface DailyMealStatus {
  date: string;
  checkedMeals: number[];
}

export async function getDailyMealStatus(dateStr: string): Promise<DailyMealStatus> {
  try {
    const raw = await AsyncStorage.getItem(`${MEAL_CHECKLIST_KEY}_${dateStr}`);
    if (!raw) return { date: dateStr, checkedMeals: [] };
    return JSON.parse(raw);
  } catch {
    return { date: dateStr, checkedMeals: [] };
  }
}

export async function toggleMealCheck(dateStr: string, mealNumber: number): Promise<DailyMealStatus> {
  const current = await getDailyMealStatus(dateStr);
  const exists = current.checkedMeals.includes(mealNumber);
  const checkedMeals = exists 
    ? current.checkedMeals.filter(m => m !== mealNumber)
    : [...current.checkedMeals, mealNumber];
  
  const updated = { date: dateStr, checkedMeals };
  await AsyncStorage.setItem(`${MEAL_CHECKLIST_KEY}_${dateStr}`, JSON.stringify(updated));
  return updated;
}

// Água
export async function getDailyWater(dateStr: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(`${WATER_LOG_KEY}_${dateStr}`);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export async function addWater(dateStr: string, ml: number): Promise<number> {
  const current = await getDailyWater(dateStr);
  const next = Math.max(0, current + ml);
  await AsyncStorage.setItem(`${WATER_LOG_KEY}_${dateStr}`, next.toString());
  return next;
}
