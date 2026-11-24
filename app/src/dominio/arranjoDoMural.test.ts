import type { ConquistaDoAluno } from '../api/comunidadeTipos';
import {
  AREA_PARA_A_LATERAL, arranjoDoMural, conquistasRecentes, existemNumeros, LARGURA_DA_LATERAL, LARGURA_DO_FEED, textoDaFaixaDosNumeros,
  VAO_DA_LATERAL,
} from './arranjoDoMural';

describe('arranjoDoMural', () => {
  it('sem medida ainda, espera (a coluna não nasce no topo para pular para o lado)', () => {
    expect(arranjoDoMural(null, true)).toBe('medindo');
    expect(arranjoDoMural(0, true)).toBe('medindo');
  });

  it('abaixo de 1280 de área, no topo do feed; a partir de 1280, ao lado', () => {
    expect(arranjoDoMural(358, true)).toBe('topo');
    expect(arranjoDoMural(AREA_PARA_A_LATERAL - 1, true)).toBe('topo');
    expect(arranjoDoMural(AREA_PARA_A_LATERAL, true)).toBe('lado');
    expect(arranjoDoMural(3100, true)).toBe('lado');
  });

  it('coluna vazia não ocupa lugar, em qualquer largura e também antes da medida', () => {
    expect(arranjoDoMural(null, false)).toBe('sem');
    expect(arranjoDoMural(390, false)).toBe('sem');
    expect(arranjoDoMural(2000, false)).toBe('sem');
  });

  it('ainda sem saber se há conteúdo: abaixo de 1280 reserva o topo (o feed espera); ao lado, nada até o conteúdo chegar', () => {
    expect(arranjoDoMural(null, null)).toBe('medindo');
    expect(arranjoDoMural(390, null)).toBe('reservando');
    expect(arranjoDoMural(AREA_PARA_A_LATERAL - 1, null)).toBe('reservando');
    expect(arranjoDoMural(AREA_PARA_A_LATERAL, null)).toBe('sem');
  });

  it('o feed, o vão e a coluna cabem na área em que a coluna abre', () => {
    expect(LARGURA_DO_FEED + VAO_DA_LATERAL + LARGURA_DA_LATERAL).toBeLessThanOrEqual(AREA_PARA_A_LATERAL);
  });
});

describe('existemNumeros', () => {
  const RANKING = { posicao: 2, participantes: 12 };
  it('verdadeiro assim que a posição ou uma conquista chega, mesmo com a outra fonte carregando', () => {
    expect(existemNumeros({ dados: RANKING }, {})).toBe(true);
    expect(existemNumeros({}, { dados: [{}] })).toBe(true);
    expect(existemNumeros({ erro: new Error('x') }, { dados: [{}] })).toBe(true);
  });
  it('nulo enquanto alguma fonte carrega sem nada ainda', () => {
    expect(existemNumeros({}, {})).toBeNull();
    expect(existemNumeros({ erro: new Error('x') }, {})).toBeNull();
    expect(existemNumeros({}, { dados: [] })).toBeNull();
  });
  it('falso quando as duas responderam sem nada (vazio ou erro)', () => {
    expect(existemNumeros({ erro: new Error('x') }, { dados: [] })).toBe(false);
    expect(existemNumeros({ erro: new Error('x') }, { erro: new Error('y') })).toBe(false);
  });
});

describe('textoDaFaixaDosNumeros', () => {
  it('só o que existe, separado por ponto médio', () => {
    expect(textoDaFaixaDosNumeros({ posicao: 2, participantes: 12 }, 4)).toBe('2º de 12 · 4 conquistas');
    expect(textoDaFaixaDosNumeros({ posicao: 1, participantes: 1 }, 0)).toBe('1º de 1');
    expect(textoDaFaixaDosNumeros(undefined, 1)).toBe('1 conquista');
  });
});

describe('conquistasRecentes', () => {
  const c = (id: string, data: string): ConquistaDoAluno => ({ id, tipo: id, titulo: id, descricao: '', icone: 'award', conquistadaEm: data });

  it('as mais recentes primeiro, até o limite, e conta as que ficaram de fora', () => {
    const lista = [c('a', '2026-10-01T10:00:00-03:00'), c('b', '2026-11-20T10:00:00-03:00'), c('c', '2026-10-15T10:00:00-03:00'), c('d', '2026-09-01T10:00:00-03:00')];
    const { itens, aMais } = conquistasRecentes(lista, 3);
    expect(itens.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(aMais).toBe(1);
  });

  it('com menos que o limite, todas e nenhuma a mais; vazia continua vazia', () => {
    expect(conquistasRecentes([c('a', '2026-10-01T10:00:00-03:00')])).toEqual({ itens: [c('a', '2026-10-01T10:00:00-03:00')], aMais: 0 });
    expect(conquistasRecentes([])).toEqual({ itens: [], aMais: 0 });
  });
});
