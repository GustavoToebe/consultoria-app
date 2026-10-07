import React, { useState, useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  StatusBar,
  SafeAreaView,
  Modal,
  Alert,
  Linking
} from 'react-native';
import { 
  Dumbbell, 
  Utensils, 
  Pill, 
  Check, 
  ChevronRight, 
  ArrowLeft, 
  FolderPlus, 
  Calendar, 
  FileDown, 
  Layers, 
  FileUp, 
  FileCheck, 
  Video,
  PlayCircle,
  Clock,
  MessageSquare
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from './src/constants/theme';
import { SARAIVA_DIVISIONS } from './src/database/seed_divisions';
import { SARAIVA_PDF_SCHEDULE, DayWorkoutSchedule } from './src/database/pdf_plan_parser';
import { generateWorkoutCalendar, CalendarDayWorkout } from './src/engine/calendarEngine';
import { SARAIVA_DIET_PLAN, SARAIVA_PROTOCOL_ITEMS } from './src/database/seed_diet';
import { PresetDivision, PresetExercise } from './src/types/saraiva_plan';
import { 
  getDayExerciseState,
  saveDayExerciseState,
  getDailyMealStatus, 
  toggleMealCheck, 
  getDailyWater, 
  addWater, 
  saveWorkoutLog,
  getWorkoutLogs,
  SavedExecutionLog,
  DayExerciseState
} from './src/database/storage';
import { roundWeight } from './src/engine/calculator';
import { generateAndSharePdfReport } from './src/services/pdfReportService';
import { getExerciseVideoUrl } from './src/constants/exerciseVideos';

type Tab = 'folders' | 'workout' | 'diet' | 'protocol';

interface WorkoutFolder {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  importedPdfName?: string;
  isPdfPlan: boolean;
  daysCount: number;
}

interface GroupedWorkoutCategory {
  title: string;          // Ex: "Costas", "Peito + Ombros", "Pernas", "Upper", "Off ativo"
  dayName: string;        // "Segunda", "Terça", etc.
  dates: CalendarDayWorkout[]; // Todos os dias do período que pertencem a esse treino
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('folders');
  
  // Pastas / Ciclos
  const [folders, setFolders] = useState<WorkoutFolder[]>([
    {
      id: 'plano_16',
      name: 'Gustavo Cesar Toebe - Plano 16',
      startDate: '2026-10-05',
      endDate: '2026-10-20',
      importedPdfName: 'Gustavo Cesar Toebe - Plano 16.pdf',
      isPdfPlan: true,
      daysCount: 16
    }
  ]);
  const [activeFolder, setActiveFolder] = useState<WorkoutFolder | null>(folders[0]);
  const [modalNewFolder, setModalNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newStartDate, setNewStartDate] = useState('2026-10-05');
  const [newEndDate, setNewEndDate] = useState('2026-10-20');
  const [selectedPdfFile, setSelectedPdfFile] = useState<string | null>(null);

  // Calendário Geral do Período
  const calendarDays = useMemo(() => {
    if (!activeFolder) return [];
    return generateWorkoutCalendar(activeFolder.startDate, activeFolder.endDate);
  }, [activeFolder]);

  // Agrupamento por Categoria/Divisão de Treino dentro do período
  const groupedCategories = useMemo<GroupedWorkoutCategory[]>(() => {
    if (calendarDays.length === 0) return [];
    const map = new Map<string, GroupedWorkoutCategory>();

    SARAIVA_PDF_SCHEDULE.forEach(s => {
      map.set(s.dayName, {
        title: s.focus,
        dayName: s.dayName,
        dates: [],
      });
    });

    calendarDays.forEach(cd => {
      const existing = map.get(cd.dayOfWeekName);
      if (existing) {
        existing.dates.push(cd);
      }
    });

    return Array.from(map.values()).filter(g => g.dates.length > 0);
  }, [calendarDays]);

  // Treino do Dia Atual (Hoje)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayWorkout = useMemo(() => {
    return calendarDays.find(d => d.dateStr === todayStr) || calendarDays[0] || null;
  }, [calendarDays, todayStr]);

  // Estados de navegação interna da aba Treino:
  // Se selectedCalendarDay for null -> exibe a PRÉ-TELA com os blocos agrupados
  // Se tiver um dia selecionado -> exibe os exercícios daquele dia específico
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<CalendarDayWorkout | null>(null);

  // Exercício aberto em execução
  const [activeExercise, setActiveExercise] = useState<PresetExercise | null>(null);

  // Estado individualizado das séries daquele dia
  const [currentDayExerciseStates, setCurrentDayExerciseStates] = useState<Record<string, DayExerciseState>>({});

  // Drafts de texto em tempo real para permitir apagar dígitos livremente sem travar (incluindo deixar o input vazio)
  const [setWeightDrafts, setSetWeightDrafts] = useState<Record<string, string>>({});
  const [topWeightDrafts, setTopWeightDrafts] = useState<Record<string, string>>({});
  const [repsDrafts, setRepsDrafts] = useState<Record<string, string>>({});

  // Dieta & Hidratação
  const [checkedMeals, setCheckedMeals] = useState<number[]>([]);
  const [waterMl, setWaterMl] = useState<number>(0);

  useEffect(() => {
    loadDietData();
  }, []);

  useEffect(() => {
    if (selectedCalendarDay) {
      loadDayExerciseStates(selectedCalendarDay);
    }
  }, [selectedCalendarDay]);

  async function loadDietData() {
    const mealStatus = await getDailyMealStatus(todayStr);
    setCheckedMeals(mealStatus.checkedMeals);

    const currentWater = await getDailyWater(todayStr);
    setWaterMl(currentWater);
  }

  async function loadDayExerciseStates(day: CalendarDayWorkout) {
    const statesMap: Record<string, DayExerciseState> = {};
    for (const ex of day.schedule.exercises) {
      const state = await getDayExerciseState(day.dateStr, ex.name);
      statesMap[ex.name] = state;
    }
    setCurrentDayExerciseStates(statesMap);
  }

  async function handlePickPdf() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setSelectedPdfFile(file.name);
        if (!newFolderName) {
          const cleanName = file.name.replace('.pdf', '');
          setNewFolderName(cleanName);
        }
        Alert.alert('PDF Selecionado', `Arquivo "${file.name}" pronto para importação.`);
      }
    } catch (err: any) {
      Alert.alert('Erro ao selecionar', err?.message || 'Não foi possível ler o arquivo.');
    }
  }

  async function handleUpdateWeight(exerciseName: string, text: string) {
    if (!selectedCalendarDay) return;
    const cleanText = text.replace(',', '.');
    const draftKey = `${selectedCalendarDay.dateStr}_${exerciseName}_top`;
    setTopWeightDrafts(prev => ({ ...prev, [draftKey]: cleanText }));

    const currentState = currentDayExerciseStates[exerciseName] || { workingSetWeight: 0, completedSetIndexes: [] };
    if (cleanText.trim() === '') {
      const nextState: DayExerciseState = {
        ...currentState,
        workingSetWeight: 0,
      };
      setCurrentDayExerciseStates(prev => ({
        ...prev,
        [exerciseName]: nextState,
      }));
      await saveDayExerciseState(selectedCalendarDay.dateStr, exerciseName, nextState);
      return;
    }

    const val = parseFloat(cleanText);
    if (!isNaN(val)) {
      const nextState: DayExerciseState = {
        ...currentState,
        workingSetWeight: val,
      };
      setCurrentDayExerciseStates(prev => ({
        ...prev,
        [exerciseName]: nextState,
      }));
      await saveDayExerciseState(selectedCalendarDay.dateStr, exerciseName, nextState);
    }
  }

  async function handleUpdateSetWeight(exerciseName: string, setIndex: number, text: string, isWorkingSet: boolean) {
    if (!selectedCalendarDay) return;
    const cleanText = text.replace(',', '.');
    const draftKey = `${selectedCalendarDay.dateStr}_${exerciseName}_${setIndex}`;
    setSetWeightDrafts(prev => ({ ...prev, [draftKey]: cleanText }));

    const currentState = currentDayExerciseStates[exerciseName] || { workingSetWeight: 0, completedSetIndexes: [] };
    const customWeights = { ...(currentState.customSetWeights || {}) };

    // Se o usuário apagou tudo (input vazio), remove a customização e não força número antigo
    if (cleanText.trim() === '') {
      delete customWeights[setIndex];
      const nextState: DayExerciseState = {
        ...currentState,
        actualWsWeight: isWorkingSet ? 0 : currentState.actualWsWeight,
        customSetWeights: customWeights,
      };
      setCurrentDayExerciseStates(prev => ({
        ...prev,
        [exerciseName]: nextState,
      }));
      await saveDayExerciseState(selectedCalendarDay.dateStr, exerciseName, nextState);
      return;
    }

    const val = parseFloat(cleanText);
    if (!isNaN(val)) {
      customWeights[setIndex] = val;
      const nextState: DayExerciseState = {
        ...currentState,
        actualWsWeight: isWorkingSet ? val : currentState.actualWsWeight,
        customSetWeights: customWeights,
      };
      setCurrentDayExerciseStates(prev => ({
        ...prev,
        [exerciseName]: nextState,
      }));
      await saveDayExerciseState(selectedCalendarDay.dateStr, exerciseName, nextState);
    }
  }

  async function handleUpdateSetReps(exerciseName: string, setIndex: number, text: string) {
    if (!selectedCalendarDay) return;
    const cleanText = text.replace(/[^0-9]/g, '');
    const draftKey = `${selectedCalendarDay.dateStr}_${exerciseName}_reps_${setIndex}`;
    setRepsDrafts(prev => ({ ...prev, [draftKey]: cleanText }));

    const currentState = currentDayExerciseStates[exerciseName] || { workingSetWeight: 0, completedSetIndexes: [] };
    const customReps = { ...(currentState.customSetReps || {}) };

    if (cleanText.trim() === '') {
      delete customReps[setIndex];
      const nextState: DayExerciseState = {
        ...currentState,
        customSetReps: customReps,
      };
      setCurrentDayExerciseStates(prev => ({
        ...prev,
        [exerciseName]: nextState,
      }));
      await saveDayExerciseState(selectedCalendarDay.dateStr, exerciseName, nextState);
      return;
    }

    const val = parseInt(cleanText, 10);
    if (!isNaN(val)) {
      customReps[setIndex] = val;
      const nextState: DayExerciseState = {
        ...currentState,
        customSetReps: customReps,
      };
      setCurrentDayExerciseStates(prev => ({
        ...prev,
        [exerciseName]: nextState,
      }));
      await saveDayExerciseState(selectedCalendarDay.dateStr, exerciseName, nextState);
    }
  }

  async function handleToggleSetCompletion(exerciseName: string, setIndex: number) {
    if (!selectedCalendarDay) return;
    const currentState = currentDayExerciseStates[exerciseName] || { workingSetWeight: 0, completedSetIndexes: [] };
    const isCompleted = currentState.completedSetIndexes.includes(setIndex);
    const nextIndexes = isCompleted
      ? currentState.completedSetIndexes.filter(i => i !== setIndex)
      : [...currentState.completedSetIndexes, setIndex];

    const nextState: DayExerciseState = {
      ...currentState,
      completedSetIndexes: nextIndexes,
    };

    setCurrentDayExerciseStates(prev => ({
      ...prev,
      [exerciseName]: nextState,
    }));

    await saveDayExerciseState(selectedCalendarDay.dateStr, exerciseName, nextState);
  }

  async function handleToggleMeal(mealNumber: number) {
    const updated = await toggleMealCheck(todayStr, mealNumber);
    setCheckedMeals(updated.checkedMeals);
  }

  async function handleAddWater(amount: number) {
    const updated = await addWater(todayStr, amount);
    setWaterMl(updated);
  }

  async function handleUpdateNotes(exerciseName: string, text: string) {
    if (!selectedCalendarDay) return;
    const currentState = currentDayExerciseStates[exerciseName] || { workingSetWeight: 0, completedSetIndexes: [] };
    const nextState: DayExerciseState = {
      ...currentState,
      notes: text,
    };

    setCurrentDayExerciseStates(prev => ({
      ...prev,
      [exerciseName]: nextState,
    }));

    await saveDayExerciseState(selectedCalendarDay.dateStr, exerciseName, nextState);
  }

  async function handleSaveExerciseLog(exercise: PresetExercise) {
    if (!selectedCalendarDay) return;
    const state = currentDayExerciseStates[exercise.name];
    const wsIdx = exercise.setsPlan.findIndex(s => s.kind === 'WORKING_SET' || s.multiplier === 1.0);
    const wsWeight = (state?.customSetWeights?.[wsIdx] && state.customSetWeights[wsIdx] > 0)
      ? state.customSetWeights[wsIdx]
      : (state?.actualWsWeight && state.actualWsWeight > 0
          ? state.actualWsWeight
          : (state?.workingSetWeight || 0));

    if (wsWeight <= 0) {
      Alert.alert('Atenção', 'Insira o peso do Working Set para este dia primeiro!');
      return;
    }

    // Identifica as repetições feitas no Working Set
    let completedReps = 6;
    if (wsIdx >= 0 && state?.customSetReps?.[wsIdx]) {
      completedReps = state.customSetReps[wsIdx];
    } else {
      const targetRep = exercise.setsPlan[wsIdx >= 0 ? wsIdx : 0]?.repRange;
      if (targetRep) {
        const num = parseInt(targetRep.replace(/\D/g, ''), 10);
        if (num > 0) completedReps = num;
      }
    }

    const log: SavedExecutionLog = {
      id: `log_${selectedCalendarDay.dateStr}_${exercise.id}`,
      folderId: activeFolder?.id || 'plano_16',
      date: selectedCalendarDay.dateStr,
      divisionCode: selectedCalendarDay.dayOfWeekName,
      exerciseName: exercise.name,
      workingSetWeight: wsWeight,
      completedReps: completedReps,
      rir: exercise.isFreeWeight ? 1 : 0,
      notes: state?.notes,
      isSynced: false,
      timestamp: Date.now()
    };

    await saveWorkoutLog(log);
    Alert.alert('Progresso Salvo', `Log de ${exercise.name} (${wsWeight}kg x ${completedReps} reps) gravado para ${selectedCalendarDay.formattedDate}!`);
    setActiveExercise(null);
  }

  function handleCreateFolder() {
    if (!newFolderName.trim()) {
      Alert.alert('Erro', 'Informe o nome do plano (ex: Plano 16)');
      return;
    }

    const newF: WorkoutFolder = {
      id: `folder_${Date.now()}`,
      name: newFolderName.trim(),
      startDate: newStartDate,
      endDate: newEndDate,
      importedPdfName: selectedPdfFile || 'Gustavo Cesar Toebe - Plano 16.pdf',
      isPdfPlan: true,
      daysCount: 16
    };

    setFolders(prev => [newF, ...prev]);
    setActiveFolder(newF);
    setSelectedCalendarDay(null); // Abre na pré-tela agrupada
    setModalNewFolder(false);
    setNewFolderName('');
    setSelectedPdfFile(null);
    Alert.alert('Sucesso', `Pasta "${newF.name}" criada com sucesso!`);
  }

  async function handleExportReport(folder: WorkoutFolder) {
    try {
      const logs = await getWorkoutLogs();
      // Garante que qualquer anotação/observação salva para o exercício naquele dia apareça no PDF
      const enrichedLogs = await Promise.all(
        logs.map(async (l) => {
          const dayState = await getDayExerciseState(l.date, l.exerciseName);
          const currentNotes = (dayState.notes && dayState.notes.trim()) || (l.notes && l.notes.trim()) || undefined;
          return {
            ...l,
            notes: currentNotes,
          };
        })
      );

      await generateAndSharePdfReport({
        folderId: folder.id,
        name: folder.name,
        startDate: folder.startDate,
        endDate: folder.endDate,
        logs: enrichedLogs,
        groupingMode: 'by_division'
      });
    } catch (err: any) {
      Alert.alert('Erro ao gerar PDF', err?.message || 'Falha ao processar o relatório.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      {/* Header Premium */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>LOG DE TREINO</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {activeFolder ? `${activeFolder.name.toUpperCase()} • SARAIVA TEAM` : 'SARAIVA TEAM • PROGRESSIVE OVERLOAD'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.badgeOffline}
          onPress={() => setActiveTab('folders')}
        >
          <Text style={styles.badgeOfflineText}>
            {activeFolder ? 'PASTA ATIVA' : 'PASTAS'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL CRIAR PASTA */}
      <Modal visible={modalNewFolder} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>NOVA PASTA DE PLANO</Text>
            <Text style={styles.modalSubtitle}>Crie o ciclo e importe o PDF do Saraiva Team</Text>

            <TouchableOpacity 
              style={[styles.btnImportPdf, selectedPdfFile && styles.btnImportPdfActive]}
              onPress={handlePickPdf}
            >
              {selectedPdfFile ? (
                <>
                  <FileCheck color="#10B981" size={20} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.importedPdfTitle}>PDF IMPORTADO</Text>
                    <Text style={styles.importedPdfName} numberOfLines={1}>{selectedPdfFile}</Text>
                  </View>
                </>
              ) : (
                <>
                  <FileUp color={colors.primary} size={20} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.btnImportPdfText}>Importar PDF de Treino</Text>
                    <Text style={styles.btnImportPdfSub}>Converte treinos, exercícios e dias automaticamente</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Nome do Plano:</Text>
            <TextInput 
              style={styles.textInput}
              placeholder="Ex: Plano 16"
              placeholderTextColor={colors.textSecondary}
              value={newFolderName}
              onChangeText={setNewFolderName}
            />

            <View style={styles.rowBetween}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Data Inicial:</Text>
                <TextInput 
                  style={styles.textInput}
                  value={newStartDate}
                  onChangeText={setNewStartDate}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.inputLabel}>Data Final:</Text>
                <TextInput 
                  style={styles.textInput}
                  value={newEndDate}
                  onChangeText={setNewEndDate}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.btnCancel} 
                onPress={() => { setModalNewFolder(false); setSelectedPdfFile(null); }}
              >
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.btnConfirm} 
                onPress={handleCreateFolder}
              >
                <Text style={styles.btnConfirmText}>Criar Pasta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Main Content Area */}
      {activeExercise ? (
        // Detalhe e Execução Ativa do Exercício para a data selecionada
        <ScrollView 
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 350 }}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => setActiveExercise(null)}
          >
            <ArrowLeft color={colors.textSecondary} size={18} />
            <Text style={styles.backButtonText}>
              Voltar para {selectedCalendarDay ? `${selectedCalendarDay.dayOfWeekName} (${selectedCalendarDay.formattedDate})` : 'Treino'}
            </Text>
          </TouchableOpacity>

          <View style={styles.exerciseDetailCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.detailTitle}>{activeExercise.name}</Text>
              <View style={styles.pillType}>
                <Text style={styles.pillTypeText}>
                  {activeExercise.isFreeWeight ? 'LIVRE (1 RIR)' : 'MÁQUINA (FALHA)'}
                </Text>
              </View>
            </View>
            <Text style={styles.detailCategory}>
              {activeExercise.category} • Data do Treino: {selectedCalendarDay?.formattedDate} ({selectedCalendarDay?.dayOfWeekName})
            </Text>

            {activeExercise.notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>💡 Obs: {activeExercise.notes}</Text>
              </View>
            )}

            {/* BOTÃO DE VÍDEO DE EXECUÇÃO */}
            {(() => {
              const videoUrl = activeExercise.videoUrl || getExerciseVideoUrl(activeExercise.name);
              if (!videoUrl) return null;
              return (
                <TouchableOpacity 
                  style={styles.btnWatchVideo} 
                  onPress={() => Linking.openURL(videoUrl)}
                >
                  <Video color="#FFFFFF" size={16} />
                  <Text style={styles.btnWatchVideoText}>Assistir Vídeo de Execução (YouTube)</Text>
                </TouchableOpacity>
              );
            })()}

            {/* Input do Working Set individual deste dia */}
            <View style={styles.wsInputContainer}>
              <Text style={styles.wsInputLabel}>
                Carga do Working Set ({selectedCalendarDay?.formattedDate}):
              </Text>
              <View style={styles.wsInputRow}>
                {(() => {
                  const topDraftKey = `${selectedCalendarDay?.dateStr}_${activeExercise.name}_top`;
                  const topDraft = topWeightDrafts[topDraftKey];
                  const savedTopVal = currentDayExerciseStates[activeExercise.name]?.workingSetWeight;
                  const topDisplayValue = topDraft !== undefined 
                    ? topDraft 
                    : (savedTopVal && savedTopVal > 0 ? savedTopVal.toString() : '');
                  return (
                    <TextInput
                      style={styles.wsInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      value={topDisplayValue}
                      onChangeText={(txt) => handleUpdateWeight(activeExercise.name, txt)}
                    />
                  );
                })()}
                <Text style={styles.wsUnit}>kg</Text>
              </View>
            </View>

            {/* Séries Calculadas Dinamicamente com Cargas e Reps Editáveis Manualmente */}
            <View style={styles.seriesSectionHeaderRow}>
              <Text style={styles.sectionHeader}>SÉRIES DO PLANO (EDITÁVEIS)</Text>
              <Text style={styles.sectionHeaderHint}>Edite pesos e reps livremente</Text>
            </View>

            {activeExercise.setsPlan.map((set, idx) => {
              const currentDayState = currentDayExerciseStates[activeExercise.name];
              const wsIndex = activeExercise.setsPlan.findIndex(s => s.kind === 'WORKING_SET' || s.multiplier === 1.0);

              // Carga base inicial definida no topo
              const baseTopWeight = currentDayState?.workingSetWeight || 0;

              // Carga da Working Set (se alterada na linha da WS ou em actualWsWeight, usa ela; senão usa baseTopWeight)
              const realWsWeight = (currentDayState?.customSetWeights?.[wsIndex] && currentDayState.customSetWeights[wsIndex] > 0)
                ? currentDayState.customSetWeights[wsIndex]
                : (currentDayState?.actualWsWeight && currentDayState.actualWsWeight > 0
                    ? currentDayState.actualWsWeight
                    : baseTopWeight);

              const isWorkingSet = idx === wsIndex || set.kind === 'WORKING_SET' || set.multiplier === 1.0;

              // REGRA EXATA DO SARAIVA TEAM & SOLICITAÇÃO DO USUÁRIO:
              // - Séries ANTERIORES à WS (idx < wsIndex, ex: Feeder 1, 2, 3): calculadas com base na carga do topo (baseTopWeight).
              //   NÃO mudam se o usuário alterar a WS!
              // - A própria WS (idx === wsIndex): exibe realWsWeight.
              // - Séries SEGUINTES à WS (idx > wsIndex, ex: Back Off 1, Back Off 2): calculadas com base em realWsWeight!
              //   Mudam SOMENTE os seguintes!
              let calcWeight = 0;
              if (idx < wsIndex) {
                calcWeight = roundWeight(baseTopWeight * set.multiplier);
              } else if (idx === wsIndex) {
                calcWeight = realWsWeight;
              } else {
                calcWeight = roundWeight(realWsWeight * set.multiplier);
              }

              const setDraftKey = `${selectedCalendarDay?.dateStr}_${activeExercise.name}_${idx}`;
              const setDraft = setWeightDrafts[setDraftKey];
              const customWeight = currentDayState?.customSetWeights?.[idx];

              // Se o usuário interagiu com o input (mesmo que tenha apagado tudo, ficando ''),
              // exibe rigorosamente o draft! Permite apagar qualquer dígito livremente sem travar.
              const displayWeight = setDraft !== undefined 
                ? setDraft 
                : (customWeight !== undefined 
                    ? customWeight.toString() 
                    : (calcWeight > 0 ? calcWeight.toString() : ''));

              const repsDraftKey = `${selectedCalendarDay?.dateStr}_${activeExercise.name}_reps_${idx}`;
              const repsDraft = repsDrafts[repsDraftKey];
              const customReps = currentDayState?.customSetReps?.[idx];
              const displayReps = repsDraft !== undefined 
                ? repsDraft 
                : (customReps !== undefined ? customReps.toString() : '');

              const isDone = currentDayState?.completedSetIndexes.includes(idx) || false;

              return (
                <View 
                  key={idx}
                  style={[styles.setCard, isDone && styles.setCardCompleted]}
                >
                  {/* Cabeçalho da Série */}
                  <View style={styles.setCardHeader}>
                    <View style={styles.setLabelRow}>
                      <View style={[styles.setTagBadge, isWorkingSet && styles.setTagBadgeWS]}>
                        <Text style={[styles.setTagBadgeText, isWorkingSet && styles.setTagBadgeTextWS]}>
                          {isWorkingSet ? 'WS' : `SÉRIE ${idx + 1}`}
                        </Text>
                      </View>
                      <Text style={[styles.setKindText, isDone && styles.textCompleted]}>
                        {set.label}
                      </Text>
                      <Text style={styles.setMultiplierText}>
                        ({Math.round(set.multiplier * 100)}% WS)
                      </Text>
                    </View>
                    <Text style={styles.setTargetReps}>Meta: {set.repRange} reps</Text>
                  </View>

                  {/* Linha de Controles: Carga Editável + Reps Feitas + Botão de Check */}
                  <View style={styles.setControlsRow}>
                    {/* Campo de Carga */}
                    <View style={styles.setInputBox}>
                      <Text style={styles.inputMiniLabel}>PESO</Text>
                      <View style={styles.inputFieldContainer}>
                        <TextInput
                          style={styles.setNumericInput}
                          keyboardType="numeric"
                          placeholder={calcWeight > 0 ? calcWeight.toString() : '0'}
                          placeholderTextColor={colors.textSecondary}
                          value={displayWeight}
                          onChangeText={(txt) => handleUpdateSetWeight(activeExercise.name, idx, txt, isWorkingSet)}
                        />
                        <Text style={styles.inputUnitText}>kg</Text>
                      </View>
                    </View>

                    {/* Campo de Reps Feitas */}
                    <View style={styles.setInputBox}>
                      <Text style={styles.inputMiniLabel}>REPS FEITAS</Text>
                      <View style={styles.inputFieldContainer}>
                        <TextInput
                          style={styles.setNumericInput}
                          keyboardType="numeric"
                          placeholder="-"
                          placeholderTextColor={colors.textSecondary}
                          value={displayReps}
                          onChangeText={(txt) => handleUpdateSetReps(activeExercise.name, idx, txt)}
                        />
                        <Text style={styles.inputUnitText}>reps</Text>
                      </View>
                    </View>

                    {/* Botão de Check de Conclusão */}
                    <TouchableOpacity 
                      style={[styles.btnCheckSet, isDone && styles.btnCheckSetActive]}
                      onPress={() => handleToggleSetCompletion(activeExercise.name, idx)}
                      activeOpacity={0.7}
                    >
                      <Check color={isDone ? '#FFFFFF' : '#71717A'} size={18} strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* CAMPO DE ANOTAÇÕES / OBSERVAÇÕES DO DIA (demarcado pelo retângulo) */}
            <View style={styles.userNotesContainer}>
              <View style={styles.userNotesHeader}>
                <MessageSquare color={colors.textSecondary} size={14} />
                <Text style={styles.userNotesLabel}>Anotações / Observações da Execução:</Text>
              </View>
              <TextInput
                style={styles.userNotesInput}
                placeholder="Ex: Banco inclinado na furação 3, senti o ombro estabilizado, falha na 5ª rep..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
                value={currentDayExerciseStates[activeExercise.name]?.notes || ''}
                onChangeText={(txt) => handleUpdateNotes(activeExercise.name, txt)}
              />
            </View>

            <TouchableOpacity 
              style={styles.btnPrimary} 
              onPress={() => handleSaveExerciseLog(activeExercise)}
            >
              <Check color="#FFFFFF" size={18} />
              <Text style={styles.btnPrimaryText}>Gravar Séries de {selectedCalendarDay?.formattedDate}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        // Telas Principais por Abas
        <>
          {activeTab === 'folders' && (
            <ScrollView style={styles.content}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.sectionMainTitle}>PASTAS DE TREINO</Text>
                  <Text style={styles.sectionMainSubtitle}>Gerencie seus ciclos e planos periódicos</Text>
                </View>
                <TouchableOpacity 
                  style={styles.btnNewFolder}
                  onPress={() => setModalNewFolder(true)}
                >
                  <FolderPlus color="#FFFFFF" size={16} />
                  <Text style={styles.btnNewFolderText}>Nova Pasta</Text>
                </TouchableOpacity>
              </View>

              {folders.map((folder) => {
                const isActive = activeFolder?.id === folder.id;
                return (
                  <View key={folder.id} style={[styles.cardFolder, isActive && styles.cardFolderActive]}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.folderName}>{folder.name}</Text>
                        <View style={styles.folderPeriodRow}>
                          <Calendar color={colors.textSecondary} size={13} />
                          <Text style={styles.folderPeriodText}>
                            {folder.startDate} até {folder.endDate}
                          </Text>
                        </View>
                        {folder.importedPdfName && (
                          <View style={styles.pdfBadge}>
                            <FileCheck color="#10B981" size={12} />
                            <Text style={styles.pdfBadgeText} numberOfLines={1}>
                              {folder.importedPdfName}
                            </Text>
                          </View>
                        )}
                      </View>
                      {isActive && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>ATIVO</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.folderActionsRow}>
                      <TouchableOpacity 
                        style={styles.btnOpenFolder}
                        onPress={() => {
                          setActiveFolder(folder);
                          setSelectedCalendarDay(null); // Abre na pré-tela agrupada
                          setActiveTab('workout');
                        }}
                      >
                        <Text style={styles.btnOpenFolderText}>Abrir Treinos</Text>
                        <ChevronRight color="#FFFFFF" size={16} />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={styles.btnExportReport}
                        onPress={() => handleExportReport(folder)}
                      >
                        <FileDown color={colors.primary} size={16} />
                        <Text style={styles.btnExportReportText}>Exportar PDF</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {activeTab === 'workout' && (
            <ScrollView style={styles.content}>
              {selectedCalendarDay ? (
                // TELA 2: EXERCÍCIOS DO DIA SELECIONADO
                <>
                  <TouchableOpacity 
                    style={styles.backButton} 
                    onPress={() => setSelectedCalendarDay(null)}
                  >
                    <ArrowLeft color={colors.textSecondary} size={18} />
                    <Text style={styles.backButtonText}>Voltar para Todos os Treinos</Text>
                  </TouchableOpacity>

                  <View style={styles.divisionHeader}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.divisionTitle}>
                        {selectedCalendarDay.dayOfWeekName} • {selectedCalendarDay.focus}
                      </Text>
                      <View style={styles.badgeDateBox}>
                        <Text style={styles.badgeDateText}>{selectedCalendarDay.formattedDate}</Text>
                      </View>
                    </View>
                    <Text style={styles.divisionSubtitle}>
                      {selectedCalendarDay.isOff 
                        ? `Off Ativo • Cardio de ${selectedCalendarDay.cardioMin} min (BPM 140-150)` 
                        : `${selectedCalendarDay.schedule.exercises.length} exercícios programados para este dia`}
                    </Text>
                  </View>

                  {selectedCalendarDay.isOff ? (
                    <View style={styles.offCard}>
                      <Text style={styles.offTitle}>Dia de Recuperação e Cardio (Saraiva Team)</Text>
                      <Text style={styles.offDesc}>
                        • 50 min de caminhada rápida, natação ou bike OU HIIT de 25 min (1 min rápido + 1 min lento).
                      </Text>
                      <Text style={styles.offBpm}>Faixa de Batimentos Cardíacos: 140 a 150 BPM</Text>
                    </View>
                  ) : (
                    selectedCalendarDay.schedule.exercises.map((item: PresetExercise) => {
                      const state = currentDayExerciseStates[item.name];
                      const currentWeight = state?.workingSetWeight || 0;
                      const completedCount = state?.completedSetIndexes.length || 0;

                      return (
                        <TouchableOpacity 
                          key={item.id} 
                          style={styles.cardExercise}
                          onPress={() => setActiveExercise(item)}
                        >
                          <View style={styles.exerciseHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.exerciseName}>{item.name}</Text>
                              <Text style={styles.exerciseMeta}>
                                {item.category} • {item.isFreeWeight ? 'Livre (1 RIR)' : 'Máquina (Falha)'}
                              </Text>
                            </View>
                            <ChevronRight color={colors.textSecondary} size={20} />
                          </View>

                          <View style={styles.exerciseFooter}>
                            <View style={styles.wsSummary}>
                              <Text style={styles.wsSummaryLabel}>Working Set:</Text>
                              <Text style={styles.wsSummaryValue}>
                                {currentWeight > 0 ? `${currentWeight} kg` : 'Sem carga'}
                              </Text>
                            </View>
                            <Text style={styles.seriesCount}>
                              {completedCount > 0 ? `${completedCount}/${item.setsPlan.length} feitas` : `${item.setsPlan.length} séries planejadas`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              ) : (
                // TELA 1 (PRÉ-TELA): AGRUPAMENTO POR DIAS DE TREINO EXATAMENTE COMO NO SEU ESBOÇO!
                <>
                  {/* Banner do Treino de Hoje (Treino do dia) */}
                  {todayWorkout && (
                    <TouchableOpacity 
                      style={styles.cardTodayWorkout}
                      onPress={() => setSelectedCalendarDay(todayWorkout)}
                    >
                      <View style={styles.rowBetween}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <PlayCircle color="#FFFFFF" size={20} />
                          <Text style={styles.todayLabel}>TREINO DO DIA (HOJE)</Text>
                        </View>
                        <Text style={styles.todayDateText}>{todayWorkout.formattedDate}</Text>
                      </View>
                      <Text style={styles.todayTitle}>
                        {todayWorkout.dayOfWeekName} - {todayWorkout.focus}
                      </Text>
                      <Text style={styles.todaySub}>
                        {todayWorkout.isOff ? 'Cardio 50 min' : `${todayWorkout.schedule.exercises.length} exercícios programados`}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <Text style={styles.sectionHeaderCategories}>DIVISÕES E DIAS DO PROTOCOLO</Text>

                  {/* Lista de Grupos de Treino (Costas, Peito+Ombro, Pernas, Upper...) */}
                  {groupedCategories.map((group) => (
                    <View key={group.dayName} style={styles.cardCategoryGroup}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryTitle}>{group.dayName} - {group.title}</Text>
                        <Text style={styles.categorySub}>
                          {group.dates.length} sessões no período
                        </Text>
                      </View>

                      {/* Chips com as datas correspondentes a esse treino */}
                      <View style={styles.datesRow}>
                        {group.dates.map((d) => (
                          <TouchableOpacity 
                            key={d.dateStr} 
                            style={[
                              styles.dateChip,
                              d.dateStr === todayStr && styles.dateChipToday
                            ]}
                            onPress={() => setSelectedCalendarDay(d)}
                          >
                            <Calendar color={d.dateStr === todayStr ? '#FFFFFF' : colors.primary} size={14} />
                            <Text style={[
                              styles.dateChipText,
                              d.dateStr === todayStr && styles.dateChipTextToday
                            ]}>
                              {d.formattedDate}
                            </Text>
                            <ChevronRight color={colors.textSecondary} size={14} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}

          {activeTab === 'diet' && (
            <ScrollView style={styles.content}>
              {/* Card Meta Hídrica */}
              <View style={styles.cardWater}>
                <View style={styles.rowBetween}>
                  <Text style={styles.waterTitle}>CONTROLE DE HIDRATAÇÃO</Text>
                  <Text style={styles.waterProgressText}>{waterMl} / {SARAIVA_DIET_PLAN.waterGoalMl} ml</Text>
                </View>
                <View style={styles.waterProgressBarBg}>
                  <View 
                    style={[
                      styles.waterProgressBarFill, 
                      { width: `${Math.min(100, (waterMl / SARAIVA_DIET_PLAN.waterGoalMl) * 100)}%` }
                    ]} 
                  />
                </View>
                <View style={styles.waterButtonsRow}>
                  <TouchableOpacity style={styles.btnWater} onPress={() => handleAddWater(250)}>
                    <Text style={styles.btnWaterText}>+250ml</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnWater} onPress={() => handleAddWater(500)}>
                    <Text style={styles.btnWaterText}>+500ml</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnWater} onPress={() => handleAddWater(-250)}>
                    <Text style={styles.btnWaterText}>-250ml</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Checklist Dieta Estática */}
              <View style={styles.dietHeader}>
                <Text style={styles.dietTitle}>PLANO ALIMENTAR FIXO</Text>
                <Text style={styles.dietCalories}>META: {SARAIVA_DIET_PLAN.calories} KCAL</Text>
              </View>

              {SARAIVA_DIET_PLAN.meals.map((meal) => {
                const isChecked = checkedMeals.includes(meal.id);
                return (
                  <TouchableOpacity 
                    key={meal.id} 
                    style={[styles.cardMeal, isChecked && styles.cardMealCompleted]}
                    onPress={() => handleToggleMeal(meal.id)}
                  >
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.mealName, isChecked && styles.textCompleted]}>
                          {meal.name}
                        </Text>
                        <Text style={styles.mealTime}>{meal.timeEstimate}</Text>
                      </View>
                      <View style={[styles.checkCircle, isChecked && styles.checkCircleActive]}>
                        {isChecked && <Check color="#FFFFFF" size={16} />}
                      </View>
                    </View>

                    {meal.options.map((opt, oIdx) => (
                      <View key={oIdx} style={styles.mealOption}>
                        <Text style={styles.mealOptionTitle}>• {opt.title}:</Text>
                        <Text style={styles.mealOptionDesc}>{opt.description}</Text>
                      </View>
                    ))}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {activeTab === 'protocol' && (
            <ScrollView style={styles.content}>
              <View style={styles.dietHeader}>
                <Text style={styles.dietTitle}>PROTOCOLO & SUPLEMENTAÇÃO</Text>
                <Text style={styles.dietCalories}>FARMACOLOGIA E DIÁRIOS</Text>
              </View>

              {SARAIVA_PROTOCOL_ITEMS.map((item) => (
                <View key={item.id} style={styles.cardProtocol}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.protocolName}>{item.name}</Text>
                    <View style={item.type === 'HORMONAL' ? styles.pillHormonal : styles.pillSupp}>
                      <Text style={styles.pillTextProtocol}>{item.type}</Text>
                    </View>
                  </View>
                  <Text style={styles.protocolDosage}>Dose: {item.dosage}</Text>
                  <Text style={styles.protocolFreq}>Frequência: {item.frequency}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'folders' && styles.navItemActive]}
          onPress={() => { setActiveTab('folders'); setActiveExercise(null); }}
        >
          <Layers color={activeTab === 'folders' ? colors.primary : colors.textSecondary} size={22} />
          <Text style={[styles.navText, activeTab === 'folders' && styles.navTextActive]}>Pastas</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'workout' && styles.navItemActive]}
          onPress={() => { setActiveTab('workout'); setActiveExercise(null); setSelectedCalendarDay(null); }}
        >
          <Dumbbell color={activeTab === 'workout' ? colors.primary : colors.textSecondary} size={22} />
          <Text style={[styles.navText, activeTab === 'workout' && styles.navTextActive]}>Treino</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'diet' && styles.navItemActive]}
          onPress={() => { setActiveTab('diet'); setActiveExercise(null); }}
        >
          <Utensils color={activeTab === 'diet' ? colors.primary : colors.textSecondary} size={22} />
          <Text style={[styles.navText, activeTab === 'diet' && styles.navTextActive]}>Dieta</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navItem, activeTab === 'protocol' && styles.navItemActive]}
          onPress={() => { setActiveTab('protocol'); setActiveExercise(null); }}
        >
          <Pill color={activeTab === 'protocol' ? colors.primary : colors.textSecondary} size={22} />
          <Text style={[styles.navText, activeTab === 'protocol' && styles.navTextActive]}>Protocolo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  badgeOffline: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  badgeOfflineText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionMainTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionMainSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  btnNewFolder: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnNewFolderText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 6,
  },
  btnImportPdf: {
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  btnImportPdfActive: {
    borderColor: '#10B981',
    borderStyle: 'solid',
    backgroundColor: '#064E3B22',
  },
  btnImportPdfText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  btnImportPdfSub: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  importedPdfTitle: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  importedPdfName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  cardFolder: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardFolderActive: {
    borderColor: colors.primary,
  },
  folderName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  folderPeriodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  folderPeriodText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  pdfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: '#064E3B33',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pdfBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  activePill: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  activePillText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  folderActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surface2,
  },
  btnOpenFolder: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  btnOpenFolderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 4,
  },
  btnExportReport: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnExportReportText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.surface2,
    color: colors.textPrimary,
    padding: 10,
    borderRadius: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  btnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  btnCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  btnConfirm: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 6,
  },
  btnConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Estilos da PRÉ-TELA de Grupos
  cardTodayWorkout: {
    backgroundColor: '#7F1D1D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  todayLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginLeft: 6,
  },
  todayDateText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '800',
  },
  todayTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 6,
  },
  todaySub: {
    color: '#FECACA',
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeaderCategories: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  cardCategoryGroup: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryHeader: {
    marginBottom: 10,
  },
  categoryTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  categorySub: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  datesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateChip: {
    backgroundColor: colors.surface2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateChipToday: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateChipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
    marginRight: 4,
  },
  dateChipTextToday: {
    color: '#FFFFFF',
  },

  // Estilos da Tela 2 (Exercícios do dia)
  badgeDateBox: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeDateText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  divisionHeader: {
    marginBottom: 16,
  },
  divisionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  divisionSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  offCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  offTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  offDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },
  offBpm: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  cardExercise: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  exerciseMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  exerciseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.surface2,
  },
  wsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wsSummaryLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginRight: 4,
  },
  wsSummaryValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  seriesCount: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '600',
  },
  exerciseDetailCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 40,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  detailCategory: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  notesBox: {
    backgroundColor: colors.surface2,
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notesText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
  },
  btnWatchVideo: {
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 12,
  },
  btnWatchVideoText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 8,
  },
  pillType: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pillTypeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  wsInputContainer: {
    backgroundColor: colors.surface2,
    padding: 14,
    borderRadius: 8,
    marginVertical: 16,
  },
  wsInputLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  wsInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wsInput: {
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    width: 100,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  wsUnit: {
    color: colors.textSecondary,
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '700',
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  seriesSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sectionHeaderHint: {
    color: colors.textSecondary,
    fontSize: 10,
    fontStyle: 'italic',
  },
  setCard: {
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A2E',
  },
  setCardCompleted: {
    borderColor: '#10B981',
    backgroundColor: '#0A2016',
  },
  setCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  setTagBadge: {
    backgroundColor: '#27272A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  setTagBadgeWS: {
    backgroundColor: colors.primary,
  },
  setTagBadgeText: {
    color: '#D4D4D8',
    fontSize: 9,
    fontWeight: '800',
  },
  setTagBadgeTextWS: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  setControlsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  setInputBox: {
    flex: 1,
    marginRight: 8,
  },
  inputMiniLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    height: 40,
  },
  setNumericInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 0,
  },
  inputUnitText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  btnCheckSet: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#202024',
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCheckSetActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  setRow: {
    backgroundColor: colors.surface2,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  setRowCompleted: {
    borderColor: colors.primary,
    opacity: 0.7,
  },
  setInfo: {
    flex: 1,
  },
  setLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setKindText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  setMultiplierText: {
    color: colors.textSecondary,
    fontSize: 11,
    marginLeft: 4,
  },
  setTargetReps: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  setWeightBox: {
    marginRight: 12,
  },
  setWeightValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  setWeightUnit: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: 'normal',
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  textCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 18,
  },
  userNotesContainer: {
    backgroundColor: colors.surface2,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  userNotesLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  userNotesInput: {
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontSize: 13,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 54,
    textAlignVertical: 'top',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 6,
  },
  cardWater: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  waterTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  waterProgressText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  waterProgressBarBg: {
    height: 8,
    backgroundColor: colors.surface2,
    borderRadius: 4,
    marginVertical: 12,
    overflow: 'hidden',
  },
  waterProgressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  waterButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btnWater: {
    backgroundColor: colors.surface2,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  btnWaterText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  dietHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dietTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  dietCalories: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  cardMeal: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMealCompleted: {
    borderColor: colors.border,
    opacity: 0.6,
  },
  mealName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  mealTime: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  mealOption: {
    backgroundColor: colors.surface2,
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  mealOptionTitle: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  mealOptionDesc: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  cardProtocol: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  protocolName: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  pillHormonal: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillSupp: {
    backgroundColor: colors.surface2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillTextProtocol: {
    color: '#F5F5F5',
    fontSize: 9,
    fontWeight: '800',
  },
  protocolDosage: {
    color: colors.textPrimary,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  protocolFreq: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemActive: {},
  navText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  navTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});
