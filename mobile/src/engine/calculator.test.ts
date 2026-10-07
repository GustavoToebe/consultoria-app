import { calculateWorkoutSets, roundWeight } from './calculator';

// Teste de Sanidade da Engine de Cálculo
function runEngineTests() {
  console.log('--- TESTANDO ENGINE DE CÁLCULO DE SÉRIES (SARAIVA TEAM) ---');

  // Teste 1: Exercício Livre (Ex: T-Bar Row 80kg)
  const tbarSets = calculateWorkoutSets({
    workingSetWeight: 80,
    exerciseType: 'free_weight',
    includeWarmup: true,
    feederCount: 3,
    backoffCount: 1,
    backoffMultiplier: 0.85,
  });

  console.log('\nExemplo: T-Bar Row (80kg WS, Livre):');
  tbarSets.forEach((s) => {
    console.log(`[${s.kind}] ${s.label}: ${s.targetWeight}kg (mult ${s.multiplier}) - Reps: ${s.targetReps}`);
  });

  // Verificações
  const warmup = tbarSets.find((s) => s.kind === 'WARMUP');
  const feeder1 = tbarSets.find((s) => s.kind === 'FEEDER_1');
  const feeder2 = tbarSets.find((s) => s.kind === 'FEEDER_2');
  const feeder3 = tbarSets.find((s) => s.kind === 'FEEDER_3');
  const ws = tbarSets.find((s) => s.kind === 'WORKING_SET');
  const backoff = tbarSets.find((s) => s.kind === 'BACKOFF');

  if (warmup?.targetWeight !== 24) throw new Error(`Warmup incorreto: esperado 24kg, obtido ${warmup?.targetWeight}kg`);
  if (feeder1?.targetWeight !== 40) throw new Error(`Feeder 1 incorreto: esperado 40kg, obtido ${feeder1?.targetWeight}kg`);
  if (feeder2?.targetWeight !== 56) throw new Error(`Feeder 2 incorreto: esperado 56kg, obtido ${feeder2?.targetWeight}kg`);
  if (feeder3?.targetWeight !== 68) throw new Error(`Feeder 3 incorreto: esperado 68kg, obtido ${feeder3?.targetWeight}kg`);
  if (ws?.targetWeight !== 80) throw new Error(`WS incorreto: esperado 80kg, obtido ${ws?.targetWeight}kg`);
  if (ws?.targetRir !== 1) throw new Error(`WS RIR para peso livre deve ser 1`);
  if (backoff?.targetWeight !== 68) throw new Error(`Backoff incorreto: esperado 68kg, obtido ${backoff?.targetWeight}kg`);

  console.log('\n✅ Todos os cálculos de T-Bar Row passaram perfeitamente!');

  // Teste 2: Máquina (Ex: Leg Press 200kg)
  const legPressSets = calculateWorkoutSets({
    workingSetWeight: 200,
    exerciseType: 'machine',
    includeWarmup: true,
    feederCount: 2,
    backoffCount: 2,
    backoffMultiplier: 0.90,
  });

  const legWs = legPressSets.find((s) => s.kind === 'WORKING_SET');
  if (legWs?.targetRir !== 0) throw new Error(`WS RIR para máquina deve ser 0 (Falha)`);
  const legBackoffs = legPressSets.filter((s) => s.kind === 'BACKOFF');
  if (legBackoffs.length !== 2) throw new Error(`Esperado 2 backoffs`);
  if (legBackoffs[0].targetWeight !== 180) throw new Error(`Backoff 90% de 200kg esperado 180kg`);

  console.log('✅ Validação para Máquinas (Falha e Back-off 90%) passou perfeitamente!');
}

runEngineTests();
