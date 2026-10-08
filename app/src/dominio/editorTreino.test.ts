import type { Configuracao, Serie } from '../api/tipos';
import { agrupar, descreverGrupo, descreverSeries } from './agrupamento';
import { localizar, uidsComProblema } from './caminhos';
import {
  alterarGrupo,
  aplicarReceitaDePlano,
  mover,
  mudarQuantidade,
  normalizarTreino,
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
