import type { Configuracao } from '../api/tipos';
import { agrupar } from './agrupamento';
import { exercicio, serie, sessao, tecnica } from './exemplosDeTreino.apoioTeste';
import { grupoComSerie, linhaDoExercicio, proximaSelecao, resumoDaSessaoPorContagem, serieDoProblema, uidDaAbaAposMudar } from './inspetorDoTreino';
import { CONFIGURACAO_PADRAO } from './metodologiaPadrao';
import { novaSerieDeCardio } from './editorTreino';

const trabalho = (uid: string, extra = {}) => serie(uid, extra);
const backOff = (uid: string) => serie(uid, { tipo: 'BACK_OFF', repsMin: 8, repsMax: 8 });
const aquecimento = (uid: string) => serie(uid, { tipo: 'WARM_UP' });
const cardio = (uid: string) => ({ ...novaSerieDeCardio({ duracaoMin: 30, distanciaKm: null, ritmo: null, zona: null, intervalos: null }), uid });

describe('linhaDoExercicio', () => {
  it('conta as séries por grupo, com o nome do tipo, e junta o descanso', () => {
    const ex = exercicio('e', { series: [trabalho('a', { descansoSegundos: 120 }), backOff('b'), { ...backOff('c'), descansoSegundos: 120 }] });
    expect(linhaDoExercicio(ex, null)).toBe('3 séries: 1 WS, 2 Back off · Descanso 120 s');
  });

  it('sem descanso nem técnica, só as quantidades; uma série no singular', () => {
    expect(linhaDoExercicio(exercicio('e', { series: [trabalho('a'), trabalho('b')] }), CONFIGURACAO_PADRAO)).toBe('2 séries: 2 WS');
    expect(linhaDoExercicio(exercicio('e', { series: [trabalho('a')] }), null)).toBe('1 série: 1 WS');
  });

  it('a técnica entra com a série em que está', () => {
    const ex = exercicio('e', { series: [trabalho('a'), trabalho('b', { tecnica: tecnica('CLUSTER'), descansoSegundos: 90 })] });
    expect(linhaDoExercicio(ex, null)).toBe('2 séries: 2 WS · Cluster na série 2 · descanso 90 s');
  });

  it('descansos diferentes viram faixa', () => {
    const ex = exercicio('e', { series: [trabalho('a', { descansoSegundos: 60 }), trabalho('b', { descansoSegundos: 120 })] });
    expect(linhaDoExercicio(ex, null)).toBe('2 séries: 2 WS · Descanso 60 a 120 s');
  });

  it('tipo fora da metodologia aparece pelo código; série sem tipo, "sem tipo"', () => {
    expect(linhaDoExercicio(exercicio('e', { series: [serie('a', { tipo: 'XYZ' })] }), null)).toBe('1 série: 1 XYZ');
    expect(linhaDoExercicio(exercicio('e', { series: [serie('a', { tipo: null })] }), null)).toBe('1 série: 1 sem tipo');
  });

  it('sem séries', () => {
    expect(linhaDoExercicio(exercicio('e'), null)).toBe('Sem séries');
    expect(linhaDoExercicio(exercicio('e', { modalidade: 'CARDIO' }), null)).toBe('Sem prescrição');
  });

  it('cardio com prescrição usa o texto do cardio, um grupo por linha juntas com " · "', () => {
    const ex = exercicio('e', { modalidade: 'CARDIO', series: [cardio('a')] });
    expect(linhaDoExercicio(ex, null)).toBe('1x 30 min');
  });
});

describe('resumoDaSessaoPorContagem', () => {
  const grupos: Record<string, string | null> = { supino: 'Peito', remada: 'Costas', crucifixo: 'peito ', sem: null, vazio: '  ' };
  const grupoDe = (e: { uid: string }) => grupos[e.uid] ?? null;

  it('conta exercícios, séries, séries de trabalho e por tipo (ordem da primeira aparição, com o nome)', () => {
    const s = sessao('s', [
      exercicio('supino', { series: [aquecimento('a'), trabalho('b'), trabalho('c'), backOff('d')] }),
      exercicio('remada', { series: [trabalho('e'), backOff('f')] }),
    ]);
    const r = resumoDaSessaoPorContagem(s, null, grupoDe);
    expect(r.exercicios).toBe(2);
    expect(r.series).toBe(6);
    expect(r.seriesDeTrabalho).toBe(3);
    expect(r.porTipo).toEqual([
      { codigo: 'WARM_UP', nome: 'Aquecimento', quantidade: 1 },
      { codigo: 'WORKING', nome: 'WS', quantidade: 3 },
      { codigo: 'BACK_OFF', nome: 'Back off', quantidade: 2 },
    ]);
    expect(r.porGrupoMuscular).toEqual([
      { grupo: 'Costas', seriesDeTrabalho: 1 },
      { grupo: 'Peito', seriesDeTrabalho: 2 },
    ]);
  });

  it('grupo sem texto ou nulo vira "—" e fica por último; os demais em ordem alfabética do português', () => {
    const s = sessao('s', [
      exercicio('sem', { series: [trabalho('a')] }),
      exercicio('vazio', { series: [trabalho('b')] }),
      exercicio('remada', { series: [trabalho('c')] }),
      exercicio('outro', { series: [trabalho('d')] }),
    ]);
    const r = resumoDaSessaoPorContagem(s, null, (e) => (e.uid === 'outro' ? 'Ábdomen' : grupoDe(e)));
    expect(r.porGrupoMuscular).toEqual([
      { grupo: 'Ábdomen', seriesDeTrabalho: 1 },
      { grupo: 'Costas', seriesDeTrabalho: 1 },
      { grupo: '—', seriesDeTrabalho: 2 },
    ]);
  });

  it('exercício sem série de trabalho não cria grupo, nem "—"', () => {
    const s = sessao('s', [exercicio('sem', { series: [aquecimento('a')] }), exercicio('supino', { series: [aquecimento('b')] })]);
    const r = resumoDaSessaoPorContagem(s, null, grupoDe);
    expect(r.porGrupoMuscular).toEqual([]);
    expect(r.series).toBe(2);
    expect(r.seriesDeTrabalho).toBe(0);
  });

  it('cardio conta em séries, mas não em trabalho nem por tipo', () => {
    const s = sessao('s', [exercicio('supino', { modalidade: 'CARDIO', series: [cardio('a'), cardio('b')] })]);
    const r = resumoDaSessaoPorContagem(s, null, grupoDe);
    expect(r).toEqual({ exercicios: 1, series: 2, seriesDeTrabalho: 0, porTipo: [], porGrupoMuscular: [] });
  });

  it('sessão vazia', () => {
    expect(resumoDaSessaoPorContagem(sessao('s'), null, grupoDe)).toEqual({ exercicios: 0, series: 0, seriesDeTrabalho: 0, porTipo: [], porGrupoMuscular: [] });
  });

  it('a metodologia da consultoria decide o que é trabalho e o nome do tipo', () => {
    const config: Configuracao = {
      ...CONFIGURACAO_PADRAO,
      tipos: CONFIGURACAO_PADRAO.tipos.map((t) => (t.codigo === 'BACK_OFF' ? { ...t, papel: 'TRABALHO' as const, nome: 'Volume' } : t)),
    };
    const s = sessao('s', [exercicio('supino', { series: [trabalho('a'), backOff('b')] })]);
    const r = resumoDaSessaoPorContagem(s, config, grupoDe);
    expect(r.seriesDeTrabalho).toBe(2);
    expect(r.porTipo.map((t) => t.nome)).toEqual(['WS', 'Volume']);
  });

  it('tipo fora da metodologia usa o código e não é de trabalho', () => {
    const s = sessao('s', [exercicio('supino', { series: [serie('a', { tipo: 'XYZ' })] })]);
    const r = resumoDaSessaoPorContagem(s, null, grupoDe);
    expect(r.porTipo).toEqual([{ codigo: 'XYZ', nome: 'XYZ', quantidade: 1 }]);
    expect(r.seriesDeTrabalho).toBe(0);
  });
});

describe('serieDoProblema', () => {
  const ex = exercicio('e', { series: [trabalho('a'), trabalho('b'), backOff('c')] });

  it('caminho completo e relativo ao exercício', () => {
    expect(serieDoProblema(ex, 'sessoes[0].exercicios[1].series[2].carga.percentualMin')).toBe('c');
    expect(serieDoProblema(ex, 'series[1].tipo')).toBe('b');
    expect(serieDoProblema(ex, 'series[0]')).toBe('a');
  });

  it('nulo quando não aponta para uma série ou o índice não existe', () => {
    expect(serieDoProblema(ex, 'series')).toBeNull();
    expect(serieDoProblema(ex, 'sessoes[0].exercicios[1].nome')).toBeNull();
    expect(serieDoProblema(ex, 'series[3].tipo')).toBeNull();
    expect(serieDoProblema(ex, 'exercicios[2].series')).toBeNull();
    expect(serieDoProblema(ex, 'outras_series[0].tipo')).toBeNull();
    expect(serieDoProblema(ex, '')).toBeNull();
    expect(serieDoProblema(exercicio('vazio'), 'series[0].tipo')).toBeNull();
  });
});

describe('grupoComSerie', () => {
  const series = [trabalho('a'), trabalho('b'), backOff('c')];

  it('o grupo que contém a série', () => {
    expect(grupoComSerie(series, 'c')?.inicio).toBe(2);
    expect(grupoComSerie(series, 'b')?.series.map((s) => s.uid)).toEqual(['a', 'b']);
  });

  it('uid nulo ou que não existe mais cai no primeiro grupo; sem séries, nulo', () => {
    expect(grupoComSerie(series, null)?.inicio).toBe(0);
    expect(grupoComSerie(series, 'sumiu')?.inicio).toBe(0);
    expect(grupoComSerie([], 'a')).toBeNull();
    expect(grupoComSerie([], null)).toBeNull();
  });

  it('trocar o tipo da série junta ou parte grupos e o uid segue achando o grupo novo', () => {
    const trocada = series.map((s) => (s.uid === 'c' ? { ...s, tipo: 'WORKING', repsMin: 6, repsMax: 6 } : s));
    expect(agrupar(trocada)).toHaveLength(1);
    expect(grupoComSerie(trocada, 'c')?.series).toHaveLength(3);
  });
});

describe('uidDaAbaAposMudar', () => {
  const antes = [trabalho('a'), trabalho('b'), backOff('c'), backOff('d'), aquecimento('e')];

  it('mantém o uid aberto quando ele ainda existe, mesmo que o agrupamento mude', () => {
    const trocada = antes.map((s) => (s.uid === 'c' ? { ...s, tipo: 'WORKING', repsMin: 6, repsMax: 6 } : s));
    expect(uidDaAbaAposMudar(antes, trocada, 'c')).toBe('c');
    expect(uidDaAbaAposMudar(antes, antes, 'd')).toBe('d');
  });

  it('apagou a série aberta mas o grupo continua: vale a primeira que ficou', () => {
    expect(uidDaAbaAposMudar(antes, antes.filter((s) => s.uid !== 'c'), 'c')).toBe('d');
    expect(uidDaAbaAposMudar(antes, antes.filter((s) => s.uid !== 'a'), 'a')).toBe('b');
  });

  it('apagou o grupo inteiro: passa ao vizinho de mesmo índice', () => {
    const semOMeio = antes.filter((s) => s.uid !== 'c' && s.uid !== 'd');
    expect(uidDaAbaAposMudar(antes, semOMeio, 'c')).toBe('e');
  });

  it('apagou o último grupo: limita ao último que sobrou', () => {
    expect(uidDaAbaAposMudar(antes, antes.filter((s) => s.uid !== 'e'), 'e')).toBe('c');
  });

  it('apagou o primeiro grupo: o seguinte assume o índice', () => {
    expect(uidDaAbaAposMudar(antes, antes.filter((s) => s.uid !== 'a' && s.uid !== 'b'), 'a')).toBe('c');
  });

  it('sem séries depois ou sem aba aberta, nulo', () => {
    expect(uidDaAbaAposMudar(antes, [], 'a')).toBeNull();
    expect(uidDaAbaAposMudar(antes, antes, null)).toBeNull();
  });

  it('uid desconhecido nas duas listas cai no primeiro grupo', () => {
    expect(uidDaAbaAposMudar(antes, antes, 'fantasma')).toBe('a');
  });
});

describe('proximaSelecao', () => {
  it('mantém o selecionado que ainda existe', () => {
    expect(proximaSelecao(['a', 'b', 'c'], ['a', 'b', 'c', 'd'], 'b')).toBe('b');
  });

  it('removido: o vizinho no mesmo índice, limitado ao último', () => {
    expect(proximaSelecao(['a', 'b', 'c'], ['a', 'c'], 'b')).toBe('c');
    expect(proximaSelecao(['a', 'b', 'c'], ['a', 'b'], 'c')).toBe('b');
    expect(proximaSelecao(['a', 'b', 'c'], ['b', 'c'], 'a')).toBe('b');
  });

  it('nulo ou desconhecido: o primeiro', () => {
    expect(proximaSelecao(['a', 'b'], ['x', 'y'], null)).toBe('x');
    expect(proximaSelecao(['a', 'b'], ['x', 'y'], 'fantasma')).toBe('x');
  });

  it('lista vazia, nulo', () => {
    expect(proximaSelecao(['a'], [], 'a')).toBeNull();
    expect(proximaSelecao([], [], null)).toBeNull();
  });
});
