/**
 * Dicionário PT <-> EN para busca inteligente de exercícios (N24).
 * Mapeia termos comuns em inglês para os nomes cadastrados em português e vice-versa.
 */

export const DICIONARIO_PT_EN: Readonly<Record<string, readonly string[]>> = {
  barra: ['barbell'],
  barbell: ['barra'],
  halter: ['dumbbell', 'dumbell'],
  dumbbell: ['halter'],
  dumbell: ['halter'],
  polia: ['cable', 'cabo'],
  cable: ['polia', 'cabo'],
  supino: ['bench press', 'chest press', 'bench'],
  'bench press': ['supino'],
  'chest press': ['supino'],
  bench: ['supino'],
  inclinado: ['incline'],
  incline: ['inclinado'],
  declinado: ['decline'],
  decline: ['declinado'],
  remada: ['row'],
  row: ['remada'],
  puxada: ['pulldown', 'lat pulldown'],
  pulldown: ['puxada'],
  'lat pulldown': ['puxada'],
  'barra fixa': ['pull up', 'chin up'],
  'pull up': ['barra fixa'],
  'chin up': ['barra fixa'],
  agachamento: ['squat'],
  squat: ['agachamento'],
  'levantamento terra': ['deadlift', 'terra'],
  deadlift: ['levantamento terra', 'terra', 'stiff'],
  terra: ['deadlift'],
  stiff: ['rdl', 'romanian deadlift', 'deadlift'],
  rdl: ['stiff', 'romanian deadlift'],
  'romanian deadlift': ['stiff'],
  'elevacao pelvica': ['hip thrust'],
  'hip thrust': ['elevacao pelvica', 'pelvica'],
  'leg press': ['leg press'],
  extensora: ['leg extension', 'extension'],
  'leg extension': ['extensora'],
  flexora: ['leg curl', 'curl'],
  'leg curl': ['flexora'],
  'elevacao lateral': ['lateral raise', 'side raise'],
  'lateral raise': ['elevacao lateral'],
  'side raise': ['elevacao lateral'],
  desenvolvimento: ['shoulder press', 'overhead press', 'ohp', 'press'],
  'shoulder press': ['desenvolvimento'],
  overhead: ['desenvolvimento'],
  ohp: ['desenvolvimento'],
  rosca: ['bicep curl', 'biceps curl', 'curl'],
  'bicep curl': ['rosca'],
  'biceps curl': ['rosca'],
  'rosca martelo': ['hammer curl', 'hammer'],
  'hammer curl': ['rosca martelo'],
  hammer: ['rosca martelo'],
  triceps: ['tricep'],
  tricep: ['triceps'],
  'triceps testa': ['skull crusher', 'skullcrusher', 'french press'],
  'skull crusher': ['triceps testa'],
  skullcrusher: ['triceps testa'],
  panturrilha: ['calf', 'calf raise'],
  calf: ['panturrilha'],
  'calf raise': ['panturrilha'],
  afundo: ['lunge', 'split squat', 'bulgarian'],
  lunge: ['afundo'],
  'split squat': ['afundo', 'bulgaro'],
  'bulgarian split squat': ['agachamento bulgaro', 'bulgaro'],
  bulgaro: ['bulgarian', 'split squat'],
  crucifixo: ['fly', 'flye', 'pec deck', 'peck deck'],
  fly: ['crucifixo'],
  flye: ['crucifixo'],
  'pec deck': ['crucifixo', 'voador'],
  voador: ['pec deck', 'fly'],
  mergulho: ['dip', 'dips'],
  dips: ['mergulho', 'paralela'],
  dip: ['mergulho', 'paralela'],
  paralela: ['dips', 'dip'],
  encolhimento: ['shrug', 'shrugs'],
  shrug: ['encolhimento'],
  shrugs: ['encolhimento'],
  antibraco: ['forearm'],
  forearm: ['antibraco'],
};

/** Retorna lista de termos correspondentes para busca expandida. */
export function expandirTermosDeBusca(termoNormalizado: string): string[] {
  const t = termoNormalizado.trim().toLowerCase();
  if (!t) return [];
  const termos = new Set<string>([t]);
  for (const [chave, equivalentes] of Object.entries(DICIONARIO_PT_EN)) {
    if (t.includes(chave) || chave.includes(t)) {
      for (const eq of equivalentes) termos.add(eq);
    }
  }
  return [...termos];
}

/** Confere se o texto do exercício coincide com a busca direta ou termos em inglês/português. */
export function coincideComBuscaExercicio(textoExercicio: string, termoBusca: string): boolean {
  if (!termoBusca) return true;
  const termos = expandirTermosDeBusca(termoBusca);
  return termos.some((t) => textoExercicio.includes(t));
}
