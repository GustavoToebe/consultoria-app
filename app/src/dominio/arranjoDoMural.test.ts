import type { ConquistaDoAluno } from '../api/comunidadeTipos';
import {
  AREA_PARA_A_LATERAL, arranjoDoMural, conquistasRecentes, existemNumeros, faixaDosNumeros, LARGURA_DA_LATERAL, LARGURA_DO_FEED,
  textoDaFaixaDosNumeros, TEXTO_NUMEROS_INDISPONIVEIS, TEXTO_SEM_NUMEROS, VAO_DA_LATERAL,
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

  it('coluna vazia não ocupa lugar, em qualquer largura', () => {
    expect(arranjoDoMural(390, false)).toBe('sem');
    expect(arranjoDoMural(2000, false)).toBe('sem');
  });

  it('topo sempre (aluno): abaixo de 1280 a faixa existe mesmo sem conteúdo; ao lado, nada até o conteúdo chegar', () => {
    expect(arranjoDoMural(390, false, true)).toBe('topo');
    expect(arranjoDoMural(AREA_PARA_A_LATERAL - 1, false, true)).toBe('topo');
    expect(arranjoDoMural(AREA_PARA_A_LATERAL, false, true)).toBe('sem');
    expect(arranjoDoMural(AREA_PARA_A_LATERAL, true, true)).toBe('lado');
  });

  it('o feed, o vão e a coluna cabem na área em que a coluna abre', () => {
    expect(LARGURA_DO_FEED + VAO_DA_LATERAL + LARGURA_DA_LATERAL).toBeLessThanOrEqual(AREA_PARA_A_LATERAL);
  });
});

describe('existemNumeros', () => {
  it('verdadeiro só quando a posição ou alguma conquista chegou', () => {
    expect(existemNumeros({ dados: { posicao: 2, participantes: 12 } }, {})).toBe(true);
    expect(existemNumeros({ erro: new Error('x') }, { dados: [{}] })).toBe(true);
    expect(existemNumeros({}, {})).toBe(false);
    expect(existemNumeros({ erro: new Error('x') }, { dados: [] })).toBe(false);
  });
});

describe('faixaDosNumeros', () => {
  const RANKING = { posicao: 2, participantes: 12, treinosConcluidos: 8 };
  const SEM_TREINO = { posicao: 1, participantes: 1, treinosConcluidos: 0 };
  const erro = new Error('rede');
  const pronta = (texto: string) => ({ carregando: false, texto });

  it('com dado, só o que existe, mesmo com a outra leitura carregando', () => {
    expect(faixaDosNumeros({ dados: RANKING }, { dados: [{}, {}, {}, {}] })).toEqual(pronta('2º de 12 · 4 conquistas'));
    expect(faixaDosNumeros({ dados: RANKING }, {})).toEqual(pronta('2º de 12'));
    expect(faixaDosNumeros({ erro }, { dados: [{}, {}, {}, {}] })).toEqual(pronta('4 conquistas'));
  });
  it('carregando enquanto alguma leitura não respondeu e nada chegou', () => {
    expect(faixaDosNumeros({}, {})).toEqual({ carregando: true });
    expect(faixaDosNumeros({ dados: SEM_TREINO }, {})).toEqual({ carregando: true });
    expect(faixaDosNumeros({ erro }, {})).toEqual({ carregando: true });
  });
  it('sem treino e sem conquista: o convite neutro (a posição sem treino não conta)', () => {
    expect(faixaDosNumeros({ dados: SEM_TREINO }, { dados: [] })).toEqual(pronta(TEXTO_SEM_NUMEROS));
  });
  it('falha de leitura ou sem rede: o texto verdadeiro, nunca o convite a treinar', () => {
    expect(faixaDosNumeros({ erro }, { dados: [] })).toEqual(pronta(TEXTO_NUMEROS_INDISPONIVEIS));
    expect(faixaDosNumeros({ erro }, { erro })).toEqual(pronta(TEXTO_NUMEROS_INDISPONIVEIS));
    expect(faixaDosNumeros({ dados: SEM_TREINO }, { erro })).toEqual(pronta(TEXTO_NUMEROS_INDISPONIVEIS));
    expect(faixaDosNumeros({}, {}, false)).toEqual(pronta(TEXTO_NUMEROS_INDISPONIVEIS));
    expect(faixaDosNumeros({ dados: RANKING }, {}, false)).toEqual(pronta('2º de 12'));
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
