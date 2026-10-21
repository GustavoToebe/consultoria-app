import type { Configuracao, ExercicioPlano, Serie } from '../api/tipos';
import { agrupar, descreverGrupo, descreverSeries } from './agrupamento';
import { localizar, uidsComProblema } from './caminhos';
import {
  adicionarSerie,
  alterarGrupo,
  LIMITE_SERIES,
  modosDeIntensidade,
  moverGrupo,
  aplicarReceitaDePlano,
  mover,
  mudarQuantidade,
  moverExercicio,
  normalizarTreino,
  removerExercicio,
  tecnicaVazia,
  novaSerie,
  repeticoesDoTipo,
  seriesDaReceita,
  seriesParaReceita,
  resumoDaSessao,
  rotuloDaSessao,
  sessaoSelecionadaDepois,
} from './editorTreino';

let mockContador = 0;
jest.mock('./uid', () => ({ novoUid: () => `uid-${++mockContador}` }));

const CONFIG: Configuracao = {
  tiposSerie: ['Aquecimento', 'FS', 'WS', 'Back off'],
  tipoTrabalho: 'WS',
  tipoPreparacao: 'FS',
  regraPreparacao: { '1': [85], '2': [70, 85], '3': [50, 70, 85] },
  arredondamentoKg: 0.5,
  instrucoesTreino: null,
  rodapePdf: null,
};

function serie(uid: string, tipo: string, min: number | null, max: number | null, extra: Partial<Serie> = {}): Serie {
  return { uid, tipo, repsMin: min, repsMax: max, alvoTexto: null, intensidade: null, descansoSegundos: null, ...extra };
}

const fs = (uid: string, p: number) => serie(uid, 'FS', 3, 3, { intensidade: { modo: 'PERCENTUAL_WS', percentual: p } });
const ws = (uid: string) => serie(uid, 'WS', 3, 6, { intensidade: { modo: 'CARGA_TRABALHO' } });
const backOff = (uid: string) => serie(uid, 'Back off', 6, 8, { intensidade: { modo: 'PERCENTUAL_WS', percentual: 85 } });

describe('intensidade', () => {
  it('o % diz a base pelo nome da série de trabalho', () => {
    expect(modosDeIntensidade('WS').find((m) => m.valor === 'PERCENTUAL_WS')?.rotulo).toBe('% da WS');
    expect(modosDeIntensidade(null).find((m) => m.valor === 'PERCENTUAL_WS')?.rotulo).toBe('% da série de trabalho');
  });
});

describe('agrupamento', () => {
  it('junta séries consecutivas iguais como no PDF', () => {
    const series = [fs('a', 50), fs('b', 70), fs('c', 85), ws('d'), backOff('e'), backOff('f')];
    expect(descreverSeries(series)).toEqual(['3x3 - FS 50/70/85%', '1x3 a 6 - WS', '2x6 a 8 - Back off 85/85%']);
    expect(agrupar(series).map((g) => g.inicio)).toEqual([0, 3, 4]);
  });

  it('série por tempo mostra o alvo em vez da faixa', () => {
    const cardio = serie('x', 'Cardio', null, null, { alvoTexto: '50 min', intensidade: { modo: 'NENHUMA' } });
    expect(descreverGrupo(agrupar([cardio])[0])).toBe('1x - Cardio 50 min');
  });
});

describe('editor de treino', () => {
  beforeEach(() => {
    mockContador = 0;
  });

  it('FS de 3 para 2 reaplica a regra da consultoria (70/85)', () => {
    const series = [fs('a', 50), fs('b', 70), fs('c', 85), ws('d')];
    const grupo = agrupar(series)[0];
    const novas = mudarQuantidade(series, grupo, 2, CONFIG);
    expect(novas.map((s) => s.intensidade?.percentual ?? null)).toEqual([70, 85, null]);
    expect(novas.map((s) => s.uid)).toEqual(['a', 'b', 'd']);
  });

  it('FS de 2 para 3 cria série com uid novo e aplica 50/70/85', () => {
    const series = [fs('a', 70), fs('b', 85), ws('d')];
    const novas = mudarQuantidade(series, agrupar(series)[0], 3, CONFIG);
    expect(novas.map((s) => s.intensidade?.percentual ?? null)).toEqual([50, 70, 85, null]);
    expect(novas[2].uid).toBe('uid-1');
  });

  it('aumentar um grupo que não é de preparação só copia a última série', () => {
    const series = [ws('d')];
    const novas = mudarQuantidade(series, agrupar(series)[0], 2, CONFIG);
    expect(novas).toHaveLength(2);
    expect(novas[1]).toEqual({ ...ws('d'), uid: 'uid-1' });
  });

  it('mudar a faixa altera o grupo todo e não inventa repetição', () => {
    const series = [backOff('e'), backOff('f')];
    const novas = alterarGrupo(series, agrupar(series)[0], { repsMin: 8, repsMax: 10 }, CONFIG);
    expect(novas.map((s) => [s.repsMin, s.repsMax])).toEqual([[8, 10], [8, 10]]);
    expect(novas.map((s) => s.uid)).toEqual(['e', 'f']);
  });

  it('trocar o tipo para o de preparação vira % com a regra', () => {
    const series = [ws('a'), ws('b')];
    const novas = alterarGrupo(series, agrupar(series)[0], { tipo: 'FS' }, CONFIG);
    expect(novas.map((s) => s.intensidade)).toEqual([
      { modo: 'PERCENTUAL_WS', percentual: 70 },
      { modo: 'PERCENTUAL_WS', percentual: 85 },
    ]);
  });

  it('com faixas na metodologia, trocar o tipo preenche as repetições do tipo novo', () => {
    const comFaixas: Configuracao = { ...CONFIG, repeticoes: { FS: { min: 3, max: 3 }, 'Back off': { min: 6, max: 8 } } };
    const series = [ws('a'), ws('b')];
    expect(alterarGrupo(series, agrupar(series)[0], { tipo: 'Back off' }, comFaixas).map((s) => [s.repsMin, s.repsMax])).toEqual([[6, 8], [6, 8]]);
    // Tipo sem faixa mantém as repetições que já estavam; sem metodologia de faixas também.
    expect(alterarGrupo(series, agrupar(series)[0], { tipo: 'Aquecimento' }, comFaixas).map((s) => [s.repsMin, s.repsMax])).toEqual([[3, 6], [3, 6]]);
    expect(alterarGrupo(series, agrupar(series)[0], { tipo: 'Back off' }, CONFIG).map((s) => [s.repsMin, s.repsMax])).toEqual([[3, 6], [3, 6]]);
  });

  it('série nova nasce com a faixa do tipo de trabalho, se a metodologia tiver', () => {
    expect(novaSerie({ ...CONFIG, repeticoes: { WS: { min: 3, max: 6 } } })).toMatchObject({ tipo: 'WS', repsMin: 3, repsMax: 6 });
    expect(novaSerie(CONFIG)).toMatchObject({ tipo: 'WS', repsMin: null, repsMax: null });
    expect(repeticoesDoTipo(null, 'WS')).toBeNull();
  });

  it('receita de séries ganha uids novos e volta sem uids ao salvar', () => {
    const series = seriesDaReceita({ series: [{ tipo: 'WS', repsMin: 3, repsMax: 6 }] });
    expect(series[0]).toMatchObject({ uid: 'uid-1', tipo: 'WS', repsMin: 3, repsMax: 6, intensidade: null });
    expect(seriesParaReceita(series).series[0]).not.toHaveProperty('uid');
  });

  it('receita de semana troca as sessões e mantém objetivo e orientações', () => {
    const atual = normalizarTreino({ objetivo: 'Secar', orientacoes: 'Notas', sessoes: [] });
    const receita = { sessoes: [{ nome: 'Treino A', diaSemana: 1, tipo: 'TREINO', exercicios: [] }] };
    const novo = aplicarReceitaDePlano(atual, receita);
    expect(novo.objetivo).toBe('Secar');
    expect(novo.sessoes.map((s) => s.nome)).toEqual(['Treino A']);
    expect(novo.sessoes[0].uid).toMatch(/^uid-/);
  });

  it('mover troca vizinhos e ignora os limites', () => {
    expect(mover([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(mover([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
});

describe('adicionar e reordenar séries (reunião de 17/10)', () => {
  beforeEach(() => {
    mockContador = 0;
  });

  it('FS adicionado depois da WS fica num grupo próprio, com a regra de 1 série, e sobe para antes dela', () => {
    const series = [ws('a')];
    const comFs = adicionarSerie(series, CONFIG, 'FS');
    expect(descreverSeries(comFs)).toEqual(['1x3 a 6 - WS', '1x - FS 85%']);
    const reordenado = moverGrupo(comFs, 1, -1);
    expect(descreverSeries(reordenado)).toEqual(['1x - FS 85%', '1x3 a 6 - WS']);
    expect(reordenado.map((s) => s.uid)).toEqual([comFs[1].uid, 'a']);
  });

  it('série igual ao último grupo soma a ele pelo mesmo caminho do "+", com a regra de preparação', () => {
    const series = [fs('a', 70), fs('b', 85)];
    const resultado = adicionarSerie(series, CONFIG, 'FS');
    expect(descreverSeries(resultado)).toEqual(['3x3 - FS 50/70/85%']);
    expect(resultado.slice(0, 2).map((s) => s.uid)).toEqual(['a', 'b']);
  });

  it('sem tipo, a série nova é a de trabalho', () => {
    expect(adicionarSerie([], CONFIG).map((s) => s.tipo)).toEqual(['WS']);
  });

  it('tipo fora de config.tiposSerie é aceito: a série nasce com ele', () => {
    const [serie] = adicionarSerie([], CONFIG, 'Pirâmide', null);
    expect(serie.tipo).toBe('Pirâmide');
  });

  it('o limite de séries vale para o exercício todo', () => {
    const muitas = Array.from({ length: LIMITE_SERIES - 1 }, (_, i) => ws(`w${i}`));
    const series = [fs('a', 85), ...muitas];
    expect(adicionarSerie(series, CONFIG, 'Back off')).toBe(series);
    expect(mudarQuantidade(series, agrupar(series)[0], 2, CONFIG)).toBe(series);
  });

  it('mover fora dos limites devolve a mesma lista', () => {
    const series = [fs('a', 85), ws('b')];
    expect(moverGrupo(series, 0, -1)).toBe(series);
    expect(moverGrupo(series, 1, 1)).toBe(series);
  });

  it('o descanso vale para todas as séries do grupo', () => {
    const series = [ws('a'), ws('b'), backOff('c')];
    const resultado = alterarGrupo(series, agrupar(series)[0], { descansoSegundos: 120 }, CONFIG);
    expect(resultado.map((s) => s.descansoSegundos)).toEqual([120, 120, null]);
  });
});

describe('composições da pesquisa de técnicas (19/10)', () => {
  beforeEach(() => {
    mockContador = 0;
  });
  const cluster = { tipo: 'CLUSTER' as const, blocos: 3, repsPorBloco: 4, pausaSegundos: 20, retomadas: null, repsPorRetomada: null };
  const comCluster = (series: Serie[]) => {
    const grupos = agrupar(series);
    return alterarGrupo(series, grupos[grupos.length - 1], { tecnica: cluster }, CONFIG);
  };
  const reabrir = (series: Serie[]) =>
    normalizarTreino(JSON.parse(JSON.stringify({ sessoes: [{ exercicios: [{ series }] }] }))).sessoes[0].exercicios[0].series;
  const pelaReceita = (series: Serie[]) => seriesDaReceita(JSON.parse(JSON.stringify(seriesParaReceita(series))));

  it('WS simples, WS + cluster e duas séries cluster continuam diferentes ao salvar, reabrir e virar receita', () => {
    const simples = adicionarSerie([], CONFIG, 'WS');
    const wsMaisCluster = comCluster(adicionarSerie(simples, CONFIG, 'WS', 'CLUSTER'));
    const doisCluster = adicionarSerie(comCluster(adicionarSerie([], CONFIG, 'WS', 'CLUSTER')), CONFIG, 'WS', 'CLUSTER');

    const esperado = {
      simples: ['1x - WS'],
      wsMaisCluster: ['1x - WS', '1x - WS · Cluster 3×4, 20 s'],
      doisCluster: ['2x - WS · Cluster 3×4, 20 s'],
    };
    for (const [nome, series] of Object.entries({ simples, wsMaisCluster, doisCluster })) {
      const quer = esperado[nome as keyof typeof esperado];
      expect(descreverSeries(series)).toEqual(quer);
      expect(descreverSeries(reabrir(series))).toEqual(quer);
      expect(descreverSeries(pelaReceita(series))).toEqual(quer);
    }
  });

  it('série simples depois do cluster nasce num grupo próprio, sem herdar a técnica', () => {
    const wsMaisCluster = comCluster(adicionarSerie(adicionarSerie([], CONFIG, 'WS'), CONFIG, 'WS', 'CLUSTER'));
    expect(descreverSeries(adicionarSerie(wsMaisCluster, CONFIG, 'WS'))).toEqual([
      '1x - WS',
      '1x - WS · Cluster 3×4, 20 s',
      '1x - WS',
    ]);
  });

  it('trocar de 3 para 4 blocos muda só a técnica, sem virar séries', () => {
    const doisCluster = adicionarSerie(comCluster(adicionarSerie([], CONFIG, 'WS', 'CLUSTER')), CONFIG, 'WS', 'CLUSTER');
    const grupo = agrupar(doisCluster)[0];
    const quatro = alterarGrupo(doisCluster, grupo, { tecnica: { ...cluster, blocos: 4 } }, CONFIG);
    expect(quatro).toHaveLength(2);
    expect(quatro.map((s) => s.uid)).toEqual(doisCluster.map((s) => s.uid));
    expect(descreverSeries(quatro)).toEqual(['2x - WS · Cluster 4×4, 20 s']);
  });

  it('receita aplicada é cópia: mudar a origem depois não muda o exercício', () => {
    const origem = comCluster(adicionarSerie([], CONFIG, 'WS', 'CLUSTER'));
    const receita = seriesParaReceita(origem);
    const aplicada = seriesDaReceita(JSON.parse(JSON.stringify(receita)));
    (receita.series[0].tecnica as { blocos: number }).blocos = 9;
    expect(descreverSeries(aplicada)).toEqual(['1x - WS · Cluster 3×4, 20 s']);
  });
});

describe('caminhos do validador', () => {
  const conteudo = normalizarTreino({
    sessoes: [
      {
        uid: 's1',
        nome: 'Segunda - Costas',
        exercicios: [{ uid: 'e1', nome: 'Remada baixa', series: [{ uid: 'x1' }, { uid: 'x2' }] }],
      },
    ],
  });

  it('vira texto legível e lista os uids no caminho', () => {
    expect(localizar(conteudo, 'sessoes[0].exercicios[0].series[1].repsMax')).toEqual({
      texto: 'Segunda - Costas › Remada baixa › série 2',
      uids: ['s1', 'e1', 'x2'],
    });
    expect(localizar(conteudo, 'sessoes').texto).toBe('Sessões');
    expect(uidsComProblema(conteudo, ['sessoes[0].nome'])).toEqual(new Set(['s1']));
  });
});

describe('sessão selecionada do editor', () => {
  const sessao = (uid: string, nome = '', diaSemana: number | null = null, uidsEx: string[] = []) => ({
    uid, nome, diaSemana, tipo: 'TREINO' as const, frequenciaSemanal: null, observacao: null, cardio: null,
    exercicios: uidsEx.map((u) => ({ uid: u }) as never),
  });
  const lista = [sessao('a'), sessao('b'), sessao('c')];

  it('ao remover a selecionada vai para a seguinte, ou para a anterior se era a última', () => {
    expect(sessaoSelecionadaDepois(lista, 'a', { tipo: 'remover', uid: 'a' })).toBe('b');
    expect(sessaoSelecionadaDepois(lista, 'b', { tipo: 'remover', uid: 'b' })).toBe('c');
    expect(sessaoSelecionadaDepois(lista, 'c', { tipo: 'remover', uid: 'c' })).toBe('b');
    expect(sessaoSelecionadaDepois([sessao('x')], 'x', { tipo: 'remover', uid: 'x' })).toBeNull();
  });

  it('remover outra sessão não muda a seleção', () => {
    expect(sessaoSelecionadaDepois(lista, 'b', { tipo: 'remover', uid: 'a' })).toBe('b');
  });

  it('ao desfazer mantém a seleção se o uid ainda existe, senão a primeira', () => {
    expect(sessaoSelecionadaDepois(lista, 'c', { tipo: 'conteudo' })).toBe('c');
    expect(sessaoSelecionadaDepois(lista, 'sumiu', { tipo: 'conteudo' })).toBe('a');
    expect(sessaoSelecionadaDepois([], 'a', { tipo: 'conteudo' })).toBeNull();
    expect(sessaoSelecionadaDepois(lista, null, { tipo: 'conteudo' })).toBe('a');
  });

  it('validar com erro abre a primeira sessão com problema, inclusive por exercício', () => {
    const com = [sessao('a'), sessao('b', '', null, ['e1']), sessao('c', '', null, ['e2'])];
    expect(sessaoSelecionadaDepois(com, 'a', { tipo: 'erros', uidsComErro: new Set(['e2', 'e1']) })).toBe('b');
    expect(sessaoSelecionadaDepois(com, 'a', { tipo: 'erros', uidsComErro: new Set(['c']) })).toBe('c');
    expect(sessaoSelecionadaDepois(com, 'c', { tipo: 'erros', uidsComErro: new Set() })).toBe('c');
  });

  it('rótulo do chip e resumo da sessão', () => {
    expect(rotuloDaSessao(sessao('a', 'Segunda - Costas', 1), 0)).toBe('Seg · Costas');
    expect(rotuloDaSessao(sessao('a', 'Terça', 2), 1)).toBe('Ter');
    expect(rotuloDaSessao(sessao('a', 'Pernas', null), 2)).toBe('Pernas');
    expect(rotuloDaSessao(sessao('a', '', null), 3)).toBe('Sessão 4');
    expect(resumoDaSessao({ ...sessao('a', '', 1, ['e1']) })).toBe('Segunda · Treino · 1 exercício');
    expect(resumoDaSessao(sessao('a'))).toBe('Sem dia fixo · Treino · 0 exercícios');
  });
});

describe('drop-set no editor (pesquisa de técnicas de 19/10)', () => {
  beforeEach(() => {
    mockContador = 0;
  });
  const drop = { ...tecnicaVazia('DROP_SET'), quedas: 2, reducaoPercentual: 20 };
  const comDrop = (series: Serie[]) => {
    const grupos = agrupar(series);
    return alterarGrupo(series, grupos[grupos.length - 1], { tecnica: drop }, CONFIG);
  };

  it('nasce sem números, como as outras técnicas', () => {
    const [s] = adicionarSerie([], CONFIG, 'WS', 'DROP_SET');
    expect(s.tecnica).toEqual(expect.objectContaining({ tipo: 'DROP_SET', quedas: null, reducaoPercentual: null, repsPorQueda: null }));
  });

  it('soma ao último grupo só com o mesmo tipo e o mesmo drop-set', () => {
    const wsMaisDrop = comDrop(adicionarSerie(adicionarSerie([], CONFIG, 'WS'), CONFIG, 'WS', 'DROP_SET'));
    expect(descreverSeries(wsMaisDrop)).toEqual(['1x - WS', '1x - WS · Drop-set 2× −20%']);
    expect(descreverSeries(adicionarSerie(wsMaisDrop, CONFIG, 'WS', 'DROP_SET'))).toEqual(['1x - WS', '2x - WS · Drop-set 2× −20%']);
    expect(descreverSeries(adicionarSerie(wsMaisDrop, CONFIG, 'WS', 'CLUSTER'))).toEqual([
      '1x - WS',
      '1x - WS · Drop-set 2× −20%',
      '1x - WS · Cluster ?×?, ? s',
    ]);
    expect(descreverSeries(adicionarSerie(wsMaisDrop, CONFIG, 'WS'))).toEqual(['1x - WS', '1x - WS · Drop-set 2× −20%', '1x - WS']);
  });

  it('continua igual ao reabrir e ao virar receita', () => {
    const series = comDrop(adicionarSerie([], CONFIG, 'WS', 'DROP_SET'));
    const reaberto = normalizarTreino(JSON.parse(JSON.stringify({ sessoes: [{ exercicios: [{ series }] }] }))).sessoes[0].exercicios[0].series;
    expect(descreverSeries(reaberto)).toEqual(['1x - WS · Drop-set 2× −20%']);
    expect(descreverSeries(seriesDaReceita(JSON.parse(JSON.stringify(seriesParaReceita(series)))))).toEqual(['1x - WS · Drop-set 2× −20%']);
  });
});

describe('exercícios feitos juntos ao mover e remover', () => {
  const ex = (uid: string, juntoComAnterior: boolean | null = null): ExercicioPlano => ({
    uid,
    exercicioId: null,
    nome: uid,
    modalidade: null,
    videoUrl: null,
    observacao: null,
    progressao: true,
    unidade: 'kg',
    series: [],
    juntoComAnterior,
  });

  it('a ligação acompanha o exercício e o primeiro da sessão perde a marca', () => {
    const lista = [ex('A'), ex('B', true), ex('C')];
    const subiu = moverExercicio(lista, 1, -1);
    expect(subiu.map((e) => [e.uid, !!e.juntoComAnterior])).toEqual([['B', false], ['A', false], ['C', false]]);
    const desceu = moverExercicio(lista, 1, 1);
    expect(desceu.map((e) => [e.uid, !!e.juntoComAnterior])).toEqual([['A', false], ['C', false], ['B', true]]);
    expect(moverExercicio(lista, 0, -1)).toBe(lista);
  });

  it('remover o primeiro solta o que estava ligado a ele', () => {
    expect(removerExercicio([ex('A'), ex('B', true), ex('C', true)], 0).map((e) => [e.uid, !!e.juntoComAnterior])).toEqual([
      ['B', false],
      ['C', true],
    ]);
  });

  it('normalizar mantém cadência, isometria e agrupamento', () => {
    const conteudo = normalizarTreino({
      sessoes: [{ exercicios: [{ nome: 'A', cadencia: '3-1-1-0', isometriaSegundos: 10, combinacao: 'SUPERSERIE' }, { nome: 'B', juntoComAnterior: true }] }],
    });
    const [a, b] = conteudo.sessoes[0].exercicios;
    expect([a.cadencia, a.isometriaSegundos, a.combinacao, b.juntoComAnterior]).toEqual(['3-1-1-0', 10, 'SUPERSERIE', true]);
  });
});
