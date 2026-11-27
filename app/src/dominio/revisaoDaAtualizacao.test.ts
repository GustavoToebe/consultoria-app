import { arranjoPrincipalComApoio } from './arranjoPrincipalComApoio';
import { abaDaRevisao, apoioDaRevisao, tetoDaRevisao } from './revisaoDaAtualizacao';

describe('revisão da atualização: medidas', () => {
  it('apoio pela faixa da tela e teto = 880 + 32 + apoio', () => {
    expect(['compacta', 'normal', 'larga', 'ultralarga'].map((f) => apoioDaRevisao(f as never))).toEqual([360, 360, 400, 440]);
    expect(tetoDaRevisao('normal')).toBe(1272);
    expect(tetoDaRevisao('larga')).toBe(1312);
    expect(tetoDaRevisao('ultralarga')).toBe(1352);
  });
  it('1280 com o menu aberto (área ~970 dentro da folga) já abre lado a lado; 390 empilha', () => {
    expect(arranjoPrincipalComApoio(968, true, apoioDaRevisao('compacta'))).toBe('lado');
    expect(arranjoPrincipalComApoio(358, true, apoioDaRevisao('compacta'))).toBe('empilhado');
    // No teto de cada faixa a principal ao lado do apoio fica com os 880.
    for (const f of ['normal', 'larga', 'ultralarga'] as const) expect(tetoDaRevisao(f) - 32 - apoioDaRevisao(f)).toBe(880);
  });
  it('aba da URL: Evolução só se a pessoa vê algum cartão dela', () => {
    expect(abaDaRevisao('evolucao', true)).toEqual({ ativa: 'evolucao', abas: ['respostas', 'evolucao'] });
    expect(abaDaRevisao('evolucao', false)).toEqual({ ativa: 'respostas', abas: ['respostas'] });
    expect(abaDaRevisao(['qualquer'], true).ativa).toBe('respostas');
    expect(abaDaRevisao(undefined, true).ativa).toBe('respostas');
  });
});
