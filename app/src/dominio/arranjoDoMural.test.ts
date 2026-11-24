import type { ConquistaDoAluno } from '../api/comunidadeTipos';
import {
  ALTURA_BASE_DA_FAIXA, alturaDaFaixa, AREA_PARA_A_LATERAL, arranjoDoMural, conquistasRecentes, estadoDosNumeros, LARGURA_DA_LATERAL,
  LARGURA_DO_FEED, rotuloNaFaixa, textoDaFaixaDosNumeros, TEXTO_NUMEROS_INDISPONIVEIS, TEXTO_SEM_NUMEROS, VAO_DA_LATERAL,
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

  it('coluna vazia não ocupa lugar, em qualquer largura e antes da medida', () => {
    expect(arranjoDoMural(null, false)).toBe('sem');
    expect(arranjoDoMural(390, false)).toBe('sem');
    expect(arranjoDoMural(2000, false)).toBe('sem');
  });

  it('o feed, o vão e a coluna cabem na área em que a coluna abre', () => {
    expect(LARGURA_DO_FEED + VAO_DA_LATERAL + LARGURA_DA_LATERAL).toBeLessThanOrEqual(AREA_PARA_A_LATERAL);
  });
});

describe('estadoDosNumeros (a faixa e a coluna)', () => {
  const RANKING = { posicao: 2, participantes: 12, treinosConcluidos: 8 };
  const SEM_TREINO = { posicao: 1, participantes: 1, treinosConcluidos: 0 };
  const QUATRO = [{}, {}, {}, {}];
  const erro = new Error('rede');
  const sem = (texto: string) => ({ tipo: 'sem', texto });

  it('sem treino e sem conquista: o convite neutro, nunca "1º de 1"', () => {
    expect(estadoDosNumeros({ dados: SEM_TREINO }, { dados: [] })).toEqual(sem(TEXTO_SEM_NUMEROS));
  });
  it('só a posição com treino', () => {
    expect(estadoDosNumeros({ dados: RANKING }, { dados: [] })).toEqual({ tipo: 'com', posicao: RANKING, texto: '2º de 12' });
    expect(estadoDosNumeros({ dados: RANKING }, {})).toEqual({ tipo: 'com', posicao: RANKING, texto: '2º de 12' });
  });
  it('só as conquistas: a posição sem treino não entra', () => {
    expect(estadoDosNumeros({ dados: SEM_TREINO }, { dados: QUATRO })).toEqual({ tipo: 'com', posicao: undefined, texto: '4 conquistas' });
    expect(estadoDosNumeros({ erro }, { dados: QUATRO })).toEqual({ tipo: 'com', posicao: undefined, texto: '4 conquistas' });
  });
  it('os dois', () => {
    expect(estadoDosNumeros({ dados: RANKING }, { dados: QUATRO })).toEqual({ tipo: 'com', posicao: RANKING, texto: '2º de 12 · 4 conquistas' });
  });
  it('falha de leitura ou sem rede: o texto verdadeiro, nunca o convite a treinar', () => {
    expect(estadoDosNumeros({ erro }, { dados: [] })).toEqual(sem(TEXTO_NUMEROS_INDISPONIVEIS));
    expect(estadoDosNumeros({ erro }, { erro })).toEqual(sem(TEXTO_NUMEROS_INDISPONIVEIS));
    expect(estadoDosNumeros({ dados: SEM_TREINO }, { erro })).toEqual(sem(TEXTO_NUMEROS_INDISPONIVEIS));
    expect(estadoDosNumeros({}, {}, false)).toEqual(sem(TEXTO_NUMEROS_INDISPONIVEIS));
    expect(estadoDosNumeros({ dados: RANKING }, {}, false)).toEqual({ tipo: 'com', posicao: RANKING, texto: '2º de 12' });
  });
  it('carregando enquanto alguma leitura não respondeu e nada chegou', () => {
    expect(estadoDosNumeros({}, {})).toEqual({ tipo: 'carregando' });
    expect(estadoDosNumeros({ dados: SEM_TREINO }, {})).toEqual({ tipo: 'carregando' });
    expect(estadoDosNumeros({ erro }, {})).toEqual({ tipo: 'carregando' });
  });
});

describe('alturaDaFaixa', () => {
  it('56 × escala, arredondado', () => {
    expect(alturaDaFaixa(1)).toBe(56);
    expect(alturaDaFaixa(1.15)).toBe(64); // 64,4
    expect(alturaDaFaixa(1.3)).toBe(73); // 72,8
    expect(alturaDaFaixa(1.4)).toBe(78); // Extra: 78,4
    expect(alturaDaFaixa(1.4 * 1.5)).toBe(118); // Extra com a fonte do sistema no teto do `Texto`: 117,6
  });
  it('cabe sempre as duas linhas do texto (altura de linha 21, arredondada como no `Texto`) e a borda', () => {
    for (const escala of [1, 1.12, 1.15, 1.25, 1.3, 1.4, 1.5, 1.4 * 1.5]) {
      expect(alturaDaFaixa(escala)).toBeGreaterThanOrEqual(2 * Math.round(21 * escala) + 2);
    }
    expect(ALTURA_BASE_DA_FAIXA).toBe(56);
  });
});

describe('rotuloNaFaixa', () => {
  it('"Ver conquistas" escrito só quando a faixa é larga para a escala', () => {
    expect(rotuloNaFaixa(358, 1)).toBe(true); // 390 px, padrão
    expect(rotuloNaFaixa(358, 1.4)).toBe(false); // 390 px, Extra: só a seta
    expect(rotuloNaFaixa(720, 1.4)).toBe(true); // feed de 720, Extra
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
