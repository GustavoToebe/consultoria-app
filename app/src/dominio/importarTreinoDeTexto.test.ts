import type { ConteudoTreino, Serie } from '../api/tipos';
import {
  descreverSeries, lerTreinoDeTexto, modoDeTrazer, rotuloDeTrazer, textoDoResumo, trazerParaOEditor,
  type ExercicioDaBibliotecaParaTexto,
} from './importarTreinoDeTexto';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';

// O uid novo sai do expo-crypto, que no Jest não gera nada: contador no lugar.
jest.mock('./uid', () => {
  let n = 0;
  return { ...jest.requireActual('./uid'), novoUid: () => `novo-${++n}` };
});

/** Biblioteca fictícia da consultoria. */
const BIBLIOTECA: ExercicioDaBibliotecaParaTexto[] = [
  { id: 'ex-supino-inc', nome: 'Supino inclinado máquina', grupoMuscular: 'Peito', videoUrl: 'https://exemplo.com/supino', modalidade: 'MAQUINA' },
  { id: 'ex-desenv', nome: 'Desenvolvimento máquina', grupoMuscular: 'Ombro', videoUrl: null, modalidade: 'MAQUINA' },
  { id: 'ex-elev', nome: 'Elevação lateral na polia', grupoMuscular: 'Ombro', videoUrl: null, modalidade: 'MAQUINA' },
  { id: 'ex-puxada', nome: 'Puxada frontal aberta', grupoMuscular: 'Costas', videoUrl: null, modalidade: 'MAQUINA' },
  { id: 'ex-agacho', nome: 'Agachamento livre', grupoMuscular: 'Pernas', videoUrl: null, modalidade: 'LIVRE' },
  { id: 'ex-rosca-a', nome: 'Rosca direta barra W', grupoMuscular: 'Bíceps', videoUrl: null, modalidade: 'LIVRE' },
  { id: 'ex-rosca-b', nome: 'Rosca direta halteres', grupoMuscular: 'Bíceps', videoUrl: null, modalidade: 'LIVRE' },
  { id: 'ex-esteira', nome: 'Esteira', grupoMuscular: null, videoUrl: null, modalidade: 'CARDIO' },
];

const ler = (texto: string, biblioteca = BIBLIOTECA) => lerTreinoDeTexto(texto, CONFIGURACAO_PADRAO, biblioteca);

/** Os tipos das séries de um exercício, na ordem. */
const tipos = (series: Serie[]) => series.map((s) => s.tipo);
const faixas = (series: Serie[]) => series.map((s) => (s.carga?.modo === 'PERCENTUAL_WS' ? [s.carga.percentualMin, s.carga.percentualMax] : s.carga?.modo ?? null));

const FORMATO_1 = `TREINO A - PEITO E OMBRO

Supino inclinado máquina
2x3 a 5 - FS
1x8 - WS
1x6 a 8 - Top set
1x8 a 12 - Back off

Desenvolvimento máquina
2x4 a 6 - FS
2x6 a 8 - WS
1x10 a 12 - Back off - Rest pause

Elevação lateral na polia
1x8 - FS
3x10 a 12 - WS
`;

describe('formato 1: tabela de PDF (nome numa linha, NxM - Tipo nas seguintes)', () => {
  const leitura = ler(FORMATO_1);

  test('uma divisão, três exercícios, séries prontas', () => {
    expect(leitura.resumo).toEqual({ divisoes: 1, exercicios: 3, series: 5 + 5 + 4, semBiblioteca: 0, semSeries: 0 });
    expect(leitura.sessoes).toHaveLength(1);
    expect(leitura.sessoes[0].nome).toBe('TREINO A - PEITO E OMBRO');
    expect(leitura.sessoes[0].exercicios.map((e) => e.nome)).toEqual(['Supino inclinado máquina', 'Desenvolvimento máquina', 'Elevação lateral na polia']);
    expect(leitura.avisos).toEqual([]);
    expect(leitura.ignoradas).toEqual([]);
  });

  test('vincula à biblioteca (id, vídeo, grupo na prévia) e a modalidade vem dela', () => {
    const [supino] = leitura.divisoes[0].itens;
    expect(supino.plano.exercicioId).toBe('ex-supino-inc');
    expect(supino.plano.videoUrl).toBe('https://exemplo.com/supino');
    expect(supino.plano.modalidade).toBe('MAQUINA');
    expect(supino.grupoMuscular).toBe('Peito');
    expect(supino.vinculado).toBe(true);
  });

  test('tipos, repetições, carga e RIR pelos padrões da metodologia', () => {
    const supino = leitura.sessoes[0].exercicios[0].series;
    expect(tipos(supino)).toEqual(['FEEDER', 'FEEDER', 'WORKING', 'TOP_SET', 'BACK_OFF']);
    expect(supino.map((s) => [s.repsMin, s.repsMax])).toEqual([[3, 5], [3, 5], [8, 8], [6, 8], [8, 12]]);
    // FS: a regra de percentuais para 2 séries; WS: carga de trabalho com RIR 0; Top set: sem carga (como a metodologia); Back off: % da metodologia.
    expect(faixas(supino)).toEqual([[70, null], [85, 90], 'CARGA_TRABALHO', 'NENHUMA', [85, null]]);
    expect(supino.map((s) => s.esforco?.rir ?? null)).toEqual([null, null, 0, 0, 0]);
  });

  test('FS pela regra do total de séries FS do exercício (1 FS, 2 FS)', () => {
    const elevacao = leitura.sessoes[0].exercicios[2].series;
    expect(faixas(elevacao).slice(0, 1)).toEqual([[85, null]]);
    const desenv = leitura.sessoes[0].exercicios[1].series;
    expect(faixas(desenv).slice(0, 2)).toEqual([[70, null], [85, 90]]);
  });

  test('técnica no fim da linha usa o padrão da metodologia', () => {
    const backOff = leitura.sessoes[0].exercicios[1].series.at(-1)!;
    expect(backOff.tipo).toBe('BACK_OFF');
    expect(backOff.tecnica).toMatchObject({ tipo: 'REST_PAUSE', pausaSegundos: 20, pausas: 1 });
    expect(leitura.sessoes[0].exercicios[1].series[0].tecnica).toBeNull();
  });

  test('o exercício e a 1ª série na mesma linha (PDF junta com espaço duplo ou tabulação)', () => {
    const junto = ler('Supino inclinado máquina    2x3 a 5 - FS\n1x8 - WS\nDesenvolvimento máquina\t2x6 a 8\tWS');
    expect(junto.resumo).toMatchObject({ divisoes: 1, exercicios: 2, series: 5 });
    expect(junto.sessoes[0].exercicios[0].exercicioId).toBe('ex-supino-inc');
    expect(tipos(junto.sessoes[0].exercicios[0].series)).toEqual(['FEEDER', 'FEEDER', 'WORKING']);
    expect(tipos(junto.sessoes[0].exercicios[1].series)).toEqual(['WORKING', 'WORKING']);
  });
});

const FORMATO_2 = `Treino B — Costas, Trapézio e Bíceps
1. Puxada frontal aberta - 2x4 a 6 FS + 2x6 a 8 WS + 1x10 a 12 Back off
2. Remada baixa triângulo - 3x8 a 10 - RIR 1 - 90s
3. Pulldown corda - 3x12 a 15 - Drop-set
4. Rosca direta barra W - 3x8-10 - 60s
Cardio: Esteira 20 min moderado`;

describe('formato 2: uma linha por exercício (Docs, Word, WhatsApp)', () => {
  const leitura = ler(FORMATO_2);
  const [puxada, remada, pulldown, rosca, esteira] = leitura.sessoes[0].exercicios;

  test('a divisão e os exercícios, sem a numeração', () => {
    expect(leitura.sessoes[0].nome).toBe('Treino B - Costas, Trapézio e Bíceps');
    expect(leitura.sessoes[0].exercicios.map((e) => e.nome)).toEqual([
      'Puxada frontal aberta', 'Remada baixa triângulo', 'Pulldown corda', 'Rosca direta barra W', 'Esteira',
    ]);
    expect(leitura.resumo).toEqual({ divisoes: 1, exercicios: 5, series: 5 + 3 + 3 + 3 + 1, semBiblioteca: 2, semSeries: 0 });  });

  test('vários blocos na mesma linha, cada um com o seu tipo', () => {
    expect(puxada.exercicioId).toBe('ex-puxada');
    expect(tipos(puxada.series)).toEqual(['FEEDER', 'FEEDER', 'WORKING', 'WORKING', 'BACK_OFF']);
    expect(puxada.series.map((s) => [s.repsMin, s.repsMax])).toEqual([[4, 6], [4, 6], [6, 8], [6, 8], [10, 12]]);
    expect(faixas(puxada.series)).toEqual([[70, null], [85, 90], 'CARGA_TRABALHO', 'CARGA_TRABALHO', [85, null]]);
  });

  test('sem tipo escrito vale WS; RIR e descanso escritos entram', () => {
    expect(remada.exercicioId).toBeNull();
    expect(tipos(remada.series)).toEqual(['WORKING', 'WORKING', 'WORKING']);
    expect(remada.series.every((s) => s.esforco?.rir === 1 && s.descansoSegundos === 90)).toBe(true);
    expect(rosca.series.map((s) => [s.repsMin, s.repsMax, s.descansoSegundos, s.esforco?.rir])).toEqual([[8, 10, 60, 0], [8, 10, 60, 0], [8, 10, 60, 0]]);
  });

  test('drop-set com o padrão da metodologia', () => {
    expect(pulldown.series.every((s) => s.tecnica?.tipo === 'DROP_SET' && s.tecnica.quedas === 1)).toBe(true);
  });

  test('linha de cardio vira exercício de cardio, ligado à biblioteca quando existe', () => {
    expect(esteira.modalidade).toBe('CARDIO');
    expect(esteira.unidade).toBe('nenhuma');
    expect(esteira.exercicioId).toBe('ex-esteira');
    expect(esteira.series).toHaveLength(1);
    expect(esteira.series[0]).toMatchObject({ tipo: null, repsMin: null, carga: null, esforco: null, cardio: { duracaoMin: 20, ritmo: 'moderado' } });
  });
});

const FORMATO_3 = `Treino C: Inferiores Completo
Agachamento livre
- Aquecimento: 2x12 a 15 (50%)
- FS: 2x4 a 6
- WS: 2x6 a 8 (RIR 0) - 120s
- Top set: 1x5 a 6
- Back off: 1x10 a 12 (80%)`;

describe('formato 3: lista com marcadores, percentuais e RIR', () => {
  const leitura = ler(FORMATO_3);
  const agachamento = leitura.sessoes[0].exercicios[0];

  test('rótulo antes do número define o tipo', () => {
    expect(leitura.sessoes[0].nome).toBe('Treino C: Inferiores Completo');
    expect(agachamento.exercicioId).toBe('ex-agacho');
    expect(tipos(agachamento.series)).toEqual(['WARM_UP', 'WARM_UP', 'FEEDER', 'FEEDER', 'WORKING', 'WORKING', 'TOP_SET', 'BACK_OFF']);
    expect(agachamento.series.map((s) => [s.repsMin, s.repsMax])).toEqual([[12, 15], [12, 15], [4, 6], [4, 6], [6, 8], [6, 8], [5, 6], [10, 12]]);
  });

  test('o percentual escrito vale (aquecimento e back off); sem ele valem a regra e o padrão', () => {
    expect(faixas(agachamento.series)).toEqual([[50, null], [50, null], [70, null], [85, 90], 'CARGA_TRABALHO', 'CARGA_TRABALHO', 'NENHUMA', [80, null]]);
    expect(agachamento.series[0].esforco).toBeNull();
    expect(agachamento.series[4].esforco).toEqual({ rir: 0, rpe: null });
    expect(agachamento.series[4].descansoSegundos).toBe(120);
  });

  test('aquecimento sem percentual fica sem carga (NENHUMA)', () => {
    const l = ler('Agachamento livre\n- Aquecimento: 2x12 a 15\n- WS: 1x8');
    expect(l.sessoes[0].exercicios[0].series[0].carga).toBeNull();
  });
});

describe('divisões', () => {
  test('sem título nenhum, tudo vai para "Treino A"', () => {
    const l = ler('Supino inclinado máquina\n3x8 - WS\nAgachamento livre\n3x10');
    expect(l.sessoes.map((s) => s.nome)).toEqual(['Treino A']);
    expect(l.sessoes[0].exercicios).toHaveLength(2);
  });

  test.each([
    ['Treino A', 'Treino A'], ['Dia 1', 'Dia 1'], ['Sessão B', 'Sessão B'], ['Divisão C', 'Divisão C'], ['Segunda', 'Segunda'],
    ['Terça-feira - Peito', 'Terça-feira - Peito'], ['Upper', 'Upper'], ['Lower', 'Lower'], ['Push', 'Push'], ['Pull', 'Pull'],
    ['Legs', 'Legs'], ['Inferiores', 'Inferiores'], ['Superiores', 'Superiores'], ['PUSH DAY', 'PUSH DAY'],
  ])('título "%s" abre uma divisão', (titulo, nome) => {
    const l = ler(`${titulo}\nAgachamento livre\n3x8 - WS`);
    expect(l.sessoes.map((s) => s.nome)).toEqual([nome]);
  });

  test('várias divisões, cada exercício na sua; divisão sem exercício fica de fora com aviso', () => {
    const l = ler('Treino A\nAgachamento livre\n3x8\nTreino B\nTreino C\nPuxada frontal aberta\n3x10');
    expect(l.sessoes.map((s) => s.nome)).toEqual(['Treino A', 'Treino C']);
    expect(l.avisos).toEqual(['A divisão “Treino B” não tem exercício reconhecido: ficou de fora.']);
    expect(l.resumo).toMatchObject({ divisoes: 2, exercicios: 2, series: 6 });
  });

  test('exercícios que começam como título não viram divisão (push-up, leg press, pulldown)', () => {
    const l = ler('Push-up\n3x10\nLeg press\n3x12\nPulldown corda\n3x12');
    expect(l.sessoes).toHaveLength(1);
    expect(l.sessoes[0].exercicios.map((e) => e.nome)).toEqual(['Push-up', 'Leg press', 'Pulldown corda']);
  });
});

describe('vínculo com a biblioteca', () => {
  test('sem acento, sem caixa e com pontuação', () => {
    const l = ler('ELEVACAO LATERAL, NA POLIA\n3x12');
    expect(l.sessoes[0].exercicios[0]).toMatchObject({ exercicioId: 'ex-elev', nome: 'Elevação lateral na polia' });
  });

  test('um único com todas as palavras vincula; dois possíveis não vinculam; sem par fica null', () => {
    const l = ler('Agachamento\n3x8\nRosca direta\n3x8\nXyzzy fictício\n3x8');
    const [agacho, rosca, xyzzy] = l.sessoes[0].exercicios;
    expect(agacho.exercicioId).toBe('ex-agacho');
    expect(rosca.exercicioId).toBeNull();
    expect(rosca.nome).toBe('Rosca direta');
    expect(xyzzy).toMatchObject({ exercicioId: null, nome: 'Xyzzy fictício', modalidade: null });
    expect(l.resumo.semBiblioteca).toBe(2);
  });

  test('sem biblioteca nenhuma tudo fica sem vínculo e a leitura segue', () => {
    const l = ler(FORMATO_1, []);
    expect(l.resumo).toMatchObject({ exercicios: 3, semBiblioteca: 3 });
    expect(l.sessoes[0].exercicios.every((e) => e.exercicioId === null)).toBe(true);
  });

  test('exercício de força nunca vincula a um de cardio', () => {
    const l = ler('Esteira\n3x10');
    expect(l.sessoes[0].exercicios[0]).toMatchObject({ exercicioId: null, modalidade: null });
  });
});

describe('séries, apelidos e valores', () => {
  const unico = (texto: string) => ler(`Agachamento livre\n${texto}`).sessoes[0].exercicios[0].series;

  test.each([
    ['2x10 Aquecimento', 'WARM_UP'], ['2x10 Aquec', 'WARM_UP'], ['2x10 Warm up', 'WARM_UP'], ['2x4 FS', 'FEEDER'], ['2x4 Feeder', 'FEEDER'],
    ['2x4 Feeder set', 'FEEDER'], ['2x4 Preparação', 'FEEDER'], ['2x8 WS', 'WORKING'], ['2x8 Work set', 'WORKING'],
    ['2x8 Working set', 'WORKING'], ['2x8 Trabalho', 'WORKING'], ['1x6 Top set', 'TOP_SET'], ['1x6 Topset', 'TOP_SET'],
    ['1x6 TS', 'TOP_SET'], ['1x10 Back off', 'BACK_OFF'], ['1x10 Backoff', 'BACK_OFF'], ['1x10 Back-off', 'BACK_OFF'], ['1x10 BO', 'BACK_OFF'],
    ['3x10 a 12', 'WORKING'],
  ])('"%s" vira %s', (linha, codigo) => {
    expect(unico(linha).every((s) => s.tipo === codigo)).toBe(true);
  });

  test('intervalos e separadores de repetição', () => {
    expect(unico('3x10-12 WS').map((s) => [s.repsMin, s.repsMax])).toEqual([[10, 12], [10, 12], [10, 12]]);
    expect(unico('3 x 10 – 12 WS')[0]).toMatchObject({ repsMin: 10, repsMax: 12 });
    expect(unico('4×8 WS')).toHaveLength(4);
    expect(unico('1x8')[0]).toMatchObject({ repsMin: 8, repsMax: 8 });
  });

  test('descanso em segundos, minutos e decimais', () => {
    expect(unico('3x8 - 60s')[0].descansoSegundos).toBe(60);
    expect(unico('3x8 - 2 min')[0].descansoSegundos).toBe(120);
    expect(unico('3x8 - 1,5 min')[0].descansoSegundos).toBe(90);
    expect(unico('3x8 - 90 seg')[0].descansoSegundos).toBe(90);
    expect(unico('3x8')[0].descansoSegundos).toBeNull();
    // O tempo de uma linha "Descanso" depois dos exercícios vale para as séries que não têm o seu.
    const l = ler('Agachamento livre\n3x8 - WS - 60s\nDescanso: 2 min\nPuxada frontal aberta\n3x8\nDescanso: 90s');
    expect(l.sessoes[0].exercicios[0].series[0].descansoSegundos).toBe(60);
    expect(l.sessoes[0].exercicios[1].series[0].descansoSegundos).toBe(90);
  });

  test('o descanso do fim da linha com vários blocos vale para os que não escreveram o seu', () => {
    const s = unico('2x4 a 6 FS + 2x6 a 8 WS - 90s');
    expect(s.map((x) => x.descansoSegundos)).toEqual([90, 90, 90, 90]);
  });

  test('RIR escrito vale; RPE também; sem nada, o esforço padrão do tipo', () => {
    expect(unico('1x8 WS RIR 2')[0].esforco).toEqual({ rir: 2, rpe: null });
    expect(unico('1x8 WS RPE 8,5')[0].esforco).toEqual({ rir: null, rpe: 8.5 });
    expect(unico('1x8 WS')[0].esforco).toEqual({ rir: 0, rpe: null });
    expect(unico('1x8 FS')[0].esforco).toBeNull();
  });

  test('pausa de técnica não é descanso: "rest pause 15s"', () => {
    const [s] = unico('1x10 WS - Rest pause 15s');
    expect(s.tecnica).toMatchObject({ tipo: 'REST_PAUSE', pausaSegundos: 15 });
    expect(s.descansoSegundos).toBeNull();
  });

  test('cluster entra com o padrão e avisa que faltam os blocos', () => {
    const l = ler('Agachamento livre\n2x9 WS Cluster');
    expect(l.sessoes[0].exercicios[0].series[0].tecnica).toMatchObject({ tipo: 'CLUSTER', pausaSegundos: 15, blocos: null });
    expect(l.avisos).toEqual(['Cluster: defina os blocos de repetições no editor (o texto não traz o padrão).']);
  });

  test('tipo que a metodologia não tem: usa a série de trabalho e avisa (nada de chute)', () => {
    const semTopSet = { ...CONFIGURACAO_PADRAO, tipos: CONFIGURACAO_PADRAO.tipos.filter((t) => t.codigo !== 'TOP_SET') };
    const l = lerTreinoDeTexto('Agachamento livre\n1x5 - Top set', semTopSet, BIBLIOTECA);
    expect(l.sessoes[0].exercicios[0].series[0].tipo).toBe('WORKING');
    expect(l.avisos).toHaveLength(1);
  });

  test('tipo renomeado pelo treinador na metodologia é reconhecido pelo nome dele', () => {
    const renomeada = { ...CONFIGURACAO_PADRAO, tipos: CONFIGURACAO_PADRAO.tipos.map((t) => (t.codigo === 'WORKING' ? { ...t, nome: 'Série válida' } : t)) };
    const l = lerTreinoDeTexto('Agachamento livre\n2x8 Série válida', renomeada, BIBLIOTECA);
    expect(tipos(l.sessoes[0].exercicios[0].series)).toEqual(['WORKING', 'WORKING']);
  });

  test('sem metodologia usa a padrão', () => {
    const l = lerTreinoDeTexto('Agachamento livre\n1x8 WS', null, BIBLIOTECA);
    expect(l.sessoes[0].exercicios[0].series[0].tipo).toBe('WORKING');
  });

  test('mais de 30 séries no exercício: corta e avisa', () => {
    const l = ler('Agachamento livre\n20x8 WS\n20x8 WS');
    expect(l.sessoes[0].exercicios[0].series).toHaveLength(30);
    expect(l.avisos).toEqual(['“Agachamento livre” passou de 30 séries: o resto ficou de fora.']);
  });

  test('a divisão, o exercício e cada série nascem com uid (o do aparelho, nunca o do texto)', () => {
    const l = ler(FORMATO_1);
    const uids = l.sessoes.flatMap((s) => [s.uid, ...s.exercicios.flatMap((e) => [e.uid, ...e.series.map((x) => x.uid)])]);
    expect(uids).toHaveLength(1 + 3 + 14);
    expect(uids.every((u) => typeof u === 'string' && u.length > 0)).toBe(true);
    expect(new Set(uids).size).toBe(uids.length);
  });
});

describe('cardio', () => {
  test.each([
    ['Cardio: Esteira 20 min moderado', 'Esteira', 20, null, 'moderado'],
    ['Bicicleta 30 min', 'Bicicleta', 30, null, null],
    ['Escada 15 min', 'Escada', 15, null, null],
    ['Cardio 40 minutos', 'Cardio', 40, null, null],
    ['Corrida 5 km', 'Corrida', null, 5, null],
    ['- Cardio: Caminhada 30 min leve', 'Caminhada', 30, null, 'leve'],
  ])('"%s"', (linha, nome, minutos, km, ritmo) => {
    const l = ler(`Treino A\n${linha}`);
    const e = l.sessoes[0].exercicios[0];
    expect(e).toMatchObject({ nome: nome === 'Esteira' ? 'Esteira' : nome, modalidade: 'CARDIO', unidade: 'nenhuma' });
    expect(e.series[0].cardio).toMatchObject({ duracaoMin: minutos, distanciaKm: km, ritmo });
  });

  test('exercício de força com "min" no nome não vira cardio sem sinal de cardio', () => {
    const l = ler('Prancha 60 min\n');
    expect(l.sessoes[0].exercicios[0].modalidade).toBeNull();
  });
});

describe('linhas que não viram nada e observações', () => {
  test('cabeçalho do documento e da tabela são ignorados; série sem exercício também', () => {
    const l = ler('Plano de treino: Fulano\nExercício Séries\n3x8 - WS\nAgachamento livre\n3x8');
    expect(l.sessoes[0].exercicios).toHaveLength(1);
    expect(l.ignoradas).toEqual(['Plano de treino: Fulano', '3x8 - WS']);
  });

  test('observação vai para o exercício anterior', () => {
    const l = ler('Agachamento livre\n3x8\nObs: descer devagar\nPuxada frontal aberta\n3x8');
    expect(l.sessoes[0].exercicios[0].observacao).toBe('descer devagar');
    expect(l.sessoes[0].exercicios[1].observacao).toBeNull();
  });

  test('exercício sem série fica com zero série e entra na contagem', () => {
    const l = ler('Agachamento livre\nPuxada frontal aberta\n3x8');
    expect(l.resumo).toMatchObject({ exercicios: 2, series: 3, semSeries: 1 });
  });

  test('texto vazio, CRLF e linhas em branco', () => {
    expect(ler('').resumo).toEqual({ divisoes: 0, exercicios: 0, series: 0, semBiblioteca: 0, semSeries: 0 });
    expect(ler('  \r\n\r\n').sessoes).toEqual([]);
    expect(ler('Agachamento livre\r\n3x8 - WS\r\n').resumo).toMatchObject({ exercicios: 1, series: 3 });
  });
});

describe('trazer para o editor', () => {
  const lidas = ler(FORMATO_1).sessoes;
  const vazio: ConteudoTreino = { objetivo: 'Meu objetivo', orientacoes: null, sessoes: [] };
  const comSessaoVazia: ConteudoTreino = { ...vazio, sessoes: [{ ...lidas[0], exercicios: [], grupos: [] }] };
  const comExercicio: ConteudoTreino = { ...vazio, sessoes: [lidas[0]] };

  test('plano sem exercício: substitui (e o objetivo fica)', () => {
    expect(modoDeTrazer(vazio)).toBe('SUBSTITUIR');
    expect(modoDeTrazer(comSessaoVazia)).toBe('SUBSTITUIR');
    expect(rotuloDeTrazer(vazio)).toBe('Trazer para o editor');
    const novo = trazerParaOEditor(comSessaoVazia, lidas);
    expect(novo.sessoes).toEqual(lidas);
    expect(novo.objetivo).toBe('Meu objetivo');
  });

  test('plano com exercício: acrescenta ao fim', () => {
    expect(modoDeTrazer(comExercicio)).toBe('ADICIONAR');
    expect(rotuloDeTrazer(comExercicio)).toBe('Adicionar ao plano');
    const novo = trazerParaOEditor(comExercicio, lidas);
    expect(novo.sessoes).toHaveLength(2);
    expect(novo.sessoes[0]).toBe(comExercicio.sessoes[0]);
  });

  test('textos da prévia', () => {
    expect(textoDoResumo({ divisoes: 1, exercicios: 1, series: 1, semBiblioteca: 0, semSeries: 0 })).toBe('1 divisão · 1 exercício · 1 série pronta');
    expect(textoDoResumo(ler(FORMATO_2).resumo)).toBe('1 divisão · 5 exercícios · 15 séries prontas');
    const supino = lidas[0].exercicios[0].series;
    expect(descreverSeries(supino, CONFIGURACAO_PADRAO)).toBe('2× FS 3 a 5 · 1× WS 8 (RIR 0) · 1× Top set 6 a 8 (RIR 0) · 1× Back off 8 a 12 (RIR 0)');
    expect(descreverSeries([], CONFIGURACAO_PADRAO)).toBe('sem séries');
  });
});

// ---- Tabela de PDF colada (Plano 15.2): texto FICTÍCIO, no mesmo jeito de quebrar linha e com as mesmas palavras de cabeçalho ----

/** Um exercício como o PDF o cola: nome quebrado, tipo da 1ª série na linha de baixo e a coluna de observação misturada. */
const exercicioColado = (nome: string, pedaco: string, percentual: string) => [
  `${nome} 1x10 a 15 - Back off - Faça com Vídeo`,
  `${pedaco} Aquecimento ${percentual} da carga realizada`,
  '3x3 - FS na WS',
  '1x3 a 6 - WS',
  '2x6 a 8 - Back off',
].join('\n');

const PLANO_COLADO = [
  'CONSULTORIA FICTÍCIA',
  'Aluno Fictício da Silva',
  'Segunda Terça Quarta Quinta Sexta Sábado Domingo',
  'Costas Peito + Pernas Off ativo Upper Pernas Off ativo',
  'Nota: Faça todos os treinos sem errar e avise se sentir dificuldade',
  'Objetivo: Teste de leitura do texto fictício',
  'FS - Respeite a faixa de repetições sem falhar',
  'WS - Só suba a carga depois de passar as repetições propostas e quando a carga',
  'estiver consolidada (todas as repetições iguais)',
  'Segunda - Costas',
  'EXERCÍCIO SÉRIES x REPS OBS LINKS',
  exercicioColado('Remada fictícia na polia', 'unilateral', '85%'),
  'Faça igual o vídeo ao lado, com o tronco',
  'levemente inclinado',
  'Puxada fictícia 3x3 - FS Back off - Faça com Vídeo',
  '1x3 a 6 - WS 85% da carga realizada',
  '2x6 a 8 - Back off na WS',
  'Remada fictícia na máquina com 2x3 - FS Back off - Faça com Vídeo',
  'pegada neutra (unilateral) 1x3 a 6 - WS 85% da carga realizada',
  '2x6 a 8 - Back off na WS',
  'Pull fictício com 2x3 - FS',
  'halteres 3x6 a 8 - WS',
  'Elevação fictícia na polia 1x3 a 5 - FS Mantenha os braços Vídeo',
  '3x6 a 8 - WS',
  'Terça - Peito + Ombros',
  '1',
  'CONSULTORIA FICTÍCIA',
  'EXERCÍCIO SÉRIES x REPS OBS LINKS',
  exercicioColado('Supino fictício na máquina', '(sentado)', '85%'),
  'Crucifixo fictício 2x3 a 5 - FS Back off - Faça com Vídeo',
  '1x3 a 6 - WS 85% da carga realizada',
  '2x6 a 8 - Back off na WS',
  'Desenvolvimento fictício na 3x3 - FS Back off - Faça com Vídeo',
  'máquina articulada 1x3 a 6 - WS 85% da carga realizada',
  '2x6 a 8 - Back off na WS',
  'Prefira escolher com',
  'pegada neutra',
  'Tríceps fictício na polia 2x3 - FS Vídeo',
  '2x6 a 8 - WS',
  'Quarta - Pernas',
  'EXERCÍCIO SÉRIES x REPS OBS LINKS',
  exercicioColado('Mesa fictícia', 'articulada', '90%'),
  'Cadeira fictícia A 3x3 - FS Back off - Faça com Vídeo',
  '1x3 a 6 - WS 90% da carga realizada',
  '1x6 a 8 - Back off na WS',
  'Cadeira fictícia B 3x3 - FS Back off - Faça com Vídeo',
  '1x3 a 6 - WS 85% da carga realizada',
  '2x6 a 8 - Back off na WS',
  'Elevação fictícia na 2x3 a 5 - FS Back off - Faça com Vídeo',
  'máquina ou livre com 1x3 a 6 - WS 90% da carga realizada',
  'barra 1x6 a 8 - Back off na WS',
  'Quinta - Off ativo',
  'EXERCÍCIO SÉRIES x REPS OBS',
  'Cardio 50 min ou HIIT de 25 min',
  'Sexta - Upper',
  '2',
  'CONSULTORIA FICTÍCIA',
  'EXERCÍCIO SÉRIES x REPS OBS',
  exercicioColado('Remada fictícia articulada com', 'pegada pronada', '85%'),
  'Supino fictício no smith 3x3 - FS Back off - Faça com Vídeo',
  '1x3 a 6 - WS 85% da carga realizada',
  '2x6 a 8 - Back off na WS',
  'Remada alta (unilateral) 2x3 - FS',
  '1x3 a 6 - WS',
  'Caso a pegada seja ruim,',
  'use o pegador do cabo',
  'Tríceps fictício corda 2x3 - FS Back off - Faça com Vídeo',
  '1x3 a 6 - WS 85% da carga realizada',
  '2x6 a 8 - Back off na WS',
  'Abdominal fictício 2x6 a 8 - WS',
  'Sábado - Pernas',
  'EXERCÍCIO SÉRIES x REPS OBS LINKS',
  'Stiff fictício com barra 3x3 - FS Back off - Faça com Vídeo',
  '1x3 a 6 - WS 80% da carga realizada na WS',
  '2x6 a 8 - Back off',
  'Faça o movimento controlando a carga',
  'nas transições',
  'Extensora fictícia 2x3 - FS Back off - Faça com Vídeo',
  '1x3 a 6 - WS 80% da carga realizada na WS',
  '2x6 a 8 - Back off',
  'Abdutora fictícia 2x3 - FS',
  '2x6 a 8 - WS',
  'Glúteo fictício 3x3 - FS',
  '1x3 a 6 - WS',
  'Domingo - Off ativo',
  'EXERCÍCIO SÉRIES x REPS OBS',
  'Cardio 50 min ou HIIT de 25 min',
  'Cardio:',
  'Dia de pernas: 50 min livre (caminhada rápida, natação ou outra atividade cardio',
  'respiratória) ou HIIT de 25 min (corra ou pedale rápido por 1 min + 1 min andando',
  'Dias sem treino: 50 min livre (caminhada rápida, natação ou outra atividade cardio',
  'BPM: 140 a 150',
  'Acessórios (2x na semana) - no final do treino',
  'Abdominal solo 2x6 a 8: faça em alguma máquina de sua preferência.',
  'CONSULTORIA FICTÍCIA',
  'Instruções',
  'Rest Pause: Faça até a falha, descanse 20 a 30 segundos e repita a série até falhar',
  'Feeder Set (FS): Série de reconhecimento. Se forem 3FS no exercício',
  '1º FS - 50%',
  '2º FS - 70%',
  'Top set: Quando estiver escrito "top set" na última série do seu treino, significa que',
  'a carga dessa série deve ser maior que a série anterior.',
  'Back off: Pegue o maior peso feito no exercício e multiplique pela porcentagem informada.',
  '0 RIR - Alta intensidade, sem reps na reserva',
].join('\n');

describe('tabela de PDF colada: o plano fictício todo', () => {
  const leitura = ler(PLANO_COLADO);
  const nomes = (dia: number) => leitura.sessoes[dia].exercicios.map((e) => e.nome);

  test('cai em 7 divisões e 24 exercícios, não em centenas', () => {
    expect(leitura.sessoes.map((s) => s.nome)).toEqual([
      'Segunda - Costas', 'Terça - Peito + Ombros', 'Quarta - Pernas', 'Quinta - Off ativo', 'Sexta - Upper', 'Sábado - Pernas', 'Domingo - Off ativo',
    ]);
    expect(leitura.resumo.divisoes).toBe(7);
    expect(leitura.resumo.exercicios).toBe(24);
    expect(leitura.resumo.semSeries).toBe(0);
    // Único aviso do texto real: o cardio com duas opções usou o primeiro tempo (o mesmo texto nos dois dias, um aviso só).
    expect(leitura.avisos).toEqual([expect.stringContaining('usei o primeiro tempo (50 min)')]);
  });

  test('1. nome quebrado em várias linhas vira um exercício só, com as séries', () => {
    expect(nomes(0)).toEqual([
      'Remada fictícia na polia unilateral', 'Puxada fictícia', 'Remada fictícia na máquina com pegada neutra (unilateral)', 'Pull fictício com halteres', 'Elevação fictícia na polia',
    ]);
    expect(nomes(1)).toContain('Desenvolvimento fictício na máquina articulada');
    expect(nomes(2)).toContain('Elevação fictícia na máquina ou livre com barra');
    expect(nomes(4)[0]).toBe('Remada fictícia articulada com pegada pronada');
  });

  test('2. o tipo na linha de baixo é série do mesmo exercício (Aquecimento, FS, WS, Back off)', () => {
    const remada = leitura.sessoes[0].exercicios[0].series;
    expect(tipos(remada)).toEqual(['WARM_UP', 'FEEDER', 'FEEDER', 'FEEDER', 'WORKING', 'BACK_OFF', 'BACK_OFF']);
    expect(remada.map((s) => [s.repsMin, s.repsMax])).toEqual([[10, 15], [3, 3], [3, 3], [3, 3], [3, 6], [6, 8], [6, 8]]);
    expect(remada[0].carga).toBeNull();
    expect(leitura.sessoes[2].exercicios[0].series.map((s) => s.tipo)[0]).toBe('WARM_UP');
  });

  test('3. a frase de percentual vai para o Back off do exercício (e só ele); sem a frase vale o padrão', () => {
    const backOff = (dia: number, i: number) => faixas(leitura.sessoes[dia].exercicios[i].series.filter((s) => s.tipo === 'BACK_OFF'));
    expect(backOff(2, 0)).toEqual([[90, null], [90, null]]);
    expect(backOff(2, 2)).toEqual([[85, null], [85, null]]);
    expect(backOff(5, 0)).toEqual([[80, null], [80, null]]);
    // O WS e o FS não herdam o percentual da frase.
    expect(faixas(leitura.sessoes[2].exercicios[0].series.filter((s) => s.tipo === 'WORKING'))).toEqual(['CARGA_TRABALHO']);
  });

  test('4. observação solta entra no exercício; "Vídeo", cabeçalhos e instruções ficam de fora', () => {
    const obs = (dia: number, i: number) => leitura.sessoes[dia].exercicios[i].observacao;
    expect(obs(0, 0)).toBe('Faça igual o vídeo ao lado, com o tronco levemente inclinado');
    expect(obs(0, 4)).toBe('Mantenha os braços');
    expect(obs(1, 2)).toBe('Prefira escolher com pegada neutra');
    expect(obs(4, 2)).toBe('Caso a pegada seja ruim, use o pegador do cabo');
    expect(obs(5, 0)).toBe('Faça o movimento controlando a carga nas transições');
    const todas = leitura.sessoes.flatMap((s) => s.exercicios.map((e) => e.observacao ?? ''));
    expect(todas.some((o) => /v[ií]deo$/i.test(o) && !/igual o v/.test(o))).toBe(false);
    const nomesTodos = leitura.sessoes.flatMap((s) => s.exercicios.map((e) => e.nome));
    expect(nomesTodos.some((n) => /CONSULTORIA|Aluno|Instru|Nota|Objetivo|Rest Pause|Feeder|Top set|Dias? |BPM|Acess/i.test(n))).toBe(false);
  });

  test('5. "Cardio 50 min ou HIIT de 25 min" usa o primeiro tempo (50 min), guarda a frase inteira e avisa', () => {
    for (const dia of [3, 6]) {
      const [cardio] = leitura.sessoes[dia].exercicios;
      expect(cardio).toMatchObject({ nome: 'Cardio', modalidade: 'CARDIO', observacao: 'Cardio 50 min ou HIIT de 25 min' });
      expect(cardio.series[0].cardio).toMatchObject({ duracaoMin: 50, distanciaKm: null });
    }
    expect(leitura.avisos.filter((a) => a.includes('usei o primeiro tempo (50 min)'))).toHaveLength(1);
    // As páginas de cardio explicado e de instruções do fim não viram exercício.
    expect(leitura.sessoes[6].exercicios).toHaveLength(1);
  });
});

describe('tabela de PDF colada: casos isolados', () => {
  test('nome quebrado numa linha só para o nome, outra para o resto, e a série na terceira', () => {
    const l = ler('Remada baixa fictícia na\npolia\nunilateral\n1x10 a 15 -\nAquecimento\n3x3 - FS\nPuxada fictícia\n2x8 - WS');
    expect(l.sessoes[0].exercicios.map((e) => e.nome)).toEqual(['Remada baixa fictícia na polia unilateral', 'Puxada fictícia']);
    expect(tipos(l.sessoes[0].exercicios[0].series)).toEqual(['WARM_UP', 'FEEDER', 'FEEDER', 'FEEDER']);
  });

  test.each([['FS', 'FEEDER'], ['WS', 'WORKING'], ['Back off', 'BACK_OFF'], ['Aquecimento', 'WARM_UP']])('"1x8 -" com "%s" na linha de baixo é série, não exercício', (rotulo, codigo) => {
    const l = ler(`Agachamento livre\n1x8 -\n${rotulo}\nPuxada frontal aberta\n1x8 -\n${rotulo} - Faça com cuidado`);
    expect(l.resumo).toMatchObject({ exercicios: 2, series: 2 });
    expect(tipos(l.sessoes[0].exercicios[0].series)).toEqual([codigo]);
    expect(tipos(l.sessoes[0].exercicios[1].series)).toEqual([codigo]);
  });

  test('lista de percentuais do back off vira faixa e avisa na prévia', () => {
    const l = ler('Agachamento livre\n1x3 a 6 - WS\n2x6 a 8 - Back off\nBack off - Faça com 80%, 85% ou 90% da carga realizada na WS');
    const backOff = l.sessoes[0].exercicios[0].series.filter((s) => s.tipo === 'BACK_OFF');
    expect(backOff).toHaveLength(2);
    expect(backOff.map((s) => s.carga)).toEqual([
      { modo: 'PERCENTUAL_WS', percentualMin: 80, percentualMax: 90 }, { modo: 'PERCENTUAL_WS', percentualMin: 80, percentualMax: 90 },
    ]);
    expect(l.avisos).toEqual(['“Agachamento livre”: o texto traz vários percentuais de back off (80%, 85% ou 90%). Gravei a faixa de 80% a 90%; confira.']);
  });

  test('um percentual só grava o valor, sem faixa e sem aviso; a frase antes do back off também vale', () => {
    const l = ler('Agachamento livre\nFaça com 90% da carga realizada na WS\n1x3 a 6 - WS\n1x6 a 8 - Back off');
    expect(faixas(l.sessoes[0].exercicios[0].series)).toEqual(['CARGA_TRABALHO', [90, null]]);
    expect(l.avisos).toEqual([]);
  });

  test('frase de percentual num exercício sem back off não inventa série: avisa que foi ignorada', () => {
    const l = ler('Agachamento livre\n1x3 a 6 - WS\nFaça com 90% da carga realizada na WS');
    expect(faixas(l.sessoes[0].exercicios[0].series)).toEqual(['CARGA_TRABALHO']);
    expect(l.avisos).toEqual(['“Agachamento livre”: a frase de percentual do back off não achou série de back off e foi ignorada.']);
  });

  test('observação solta em linhas seguidas junta numa só; o nome do exercício seguinte não é engolido', () => {
    const l = ler('Agachamento livre\n3x8 - WS\nFaça igual o vídeo,\ncom o tronco reto\nPuxada frontal aberta\n3x8 - WS\nPegada neutra');
    const [agacho, puxada] = l.sessoes[0].exercicios;
    expect(agacho.observacao).toBe('Faça igual o vídeo, com o tronco reto');
    expect(puxada.observacao).toBe('Pegada neutra');
    expect(l.resumo.exercicios).toBe(2);
  });

  test('observação entra direto, sem ficar em linhas ignoradas', () => {
    const l = ler('Agachamento livre\n3x8 - WS\nMantenha o quadril firme');
    expect(l.sessoes[0].exercicios[0].observacao).toBe('Mantenha o quadril firme');
    expect(l.ignoradas).toEqual([]);
  });

  test('cabeçalho de documento (Aluno, Nome...) e páginas de instrução continuam de fora', () => {
    const l = ler('Aluno: Fulano de Tal\nNome: Fulano\nTreino A\nAgachamento livre\n3x8 - WS\nInstruções\nRest pause: faça até a falha e descanse 20 segundos\nTop set: a carga deve ser maior que a anterior\nSupino reto 3x10\nTreino B\nPuxada frontal aberta\n3x10');
    expect(l.sessoes.map((s) => s.nome)).toEqual(['Treino A', 'Treino B']);
    expect(l.sessoes[0].exercicios.map((e) => e.nome)).toEqual(['Agachamento livre']);
    expect(l.sessoes[1].exercicios.map((e) => e.nome)).toEqual(['Puxada frontal aberta']);
  });

  test('cardio com duas opções usa a primeira medida, guarda a frase e avisa; uma opção só continua como era', () => {
    const duasTexto = ler('Treino A\nCardio 40 min ou 5 km');
    const duas = duasTexto.sessoes[0].exercicios[0];
    expect(duas.observacao).toBe('Cardio 40 min ou 5 km');
    expect(duas.series[0].cardio).toMatchObject({ duracaoMin: 40, distanciaKm: null });
    expect(duasTexto.avisos.some((a) => a.includes('usei o primeiro tempo (40 min)'))).toBe(true);
    const duasKmTexto = ler('Treino A\nCardio 5 km ou 40 min');
    const duasKm = duasKmTexto.sessoes[0].exercicios[0];
    expect(duasKm.observacao).toBe('Cardio 5 km ou 40 min');
    expect(duasKm.series[0].cardio).toMatchObject({ duracaoMin: null, distanciaKm: 5 });
    expect(duasKmTexto.avisos.some((a) => a.includes('usei a primeira distância (5 km)'))).toBe(true);
    const umaTexto = ler('Treino A\nCardio 40 min');
    const uma = umaTexto.sessoes[0].exercicios[0];
    expect(uma.series[0].cardio).toMatchObject({ duracaoMin: 40 });
    expect(uma.observacao).toBeNull();
    expect(umaTexto.avisos.some((a) => a.includes('primeiro tempo') || a.includes('primeira distância'))).toBe(false);
  });
});
