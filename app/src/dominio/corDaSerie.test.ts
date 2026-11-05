import { CHAVES_DE_IDENTIFICACAO } from '../tema/tokens';
import { corDaDivisao, corDaRefeicao, corDoTipoDeSerie } from './corDaSerie';

describe('corDoTipoDeSerie', () => {
  it('dá a cor própria dos quatro tipos padrão, mesmo com outro papel', () => {
    expect(corDoTipoDeSerie('WARM_UP', 'AQUECIMENTO')).toBe('CIANO');
    expect(corDoTipoDeSerie('FEEDER', 'PREPARACAO')).toBe('AZUL');
    expect(corDoTipoDeSerie('WORKING', 'TRABALHO')).toBe('INDIGO');
    expect(corDoTipoDeSerie('BACK_OFF', 'POS_TRABALHO')).toBe('MAGENTA');
    expect(corDoTipoDeSerie('WORKING', null)).toBe('INDIGO');
  });

  it('tipo criado pelo treinador usa a cor do papel; "Outro" fica sem cor', () => {
    expect(corDoTipoDeSerie('MEU_AQUECIMENTO', 'AQUECIMENTO')).toBe('CIANO');
    expect(corDoTipoDeSerie('PREPARO', 'PREPARACAO')).toBe('AZUL');
    expect(corDoTipoDeSerie('PESADA', 'TRABALHO')).toBe('INDIGO');
    expect(corDoTipoDeSerie('DESCARGA', 'POS_TRABALHO')).toBe('MAGENTA');
    expect(corDoTipoDeSerie('ALONGAR', 'OUTRO')).toBeNull();
  });

  it('sem código conhecido e sem papel não tem cor', () => {
    expect(corDoTipoDeSerie(null, null)).toBeNull();
    expect(corDoTipoDeSerie(undefined, undefined)).toBeNull();
    expect(corDoTipoDeSerie('DESCONHECIDO', undefined)).toBeNull();
    expect(corDoTipoDeSerie('constructor', undefined)).toBeNull();
  });
});

describe('corDaDivisao', () => {
  it('A azul, B magenta, C ciano e depois violeta e índigo, em ciclo', () => {
    expect([0, 1, 2, 3, 4].map(corDaDivisao)).toEqual(['AZUL', 'MAGENTA', 'CIANO', 'VIOLETA', 'INDIGO']);
    expect(corDaDivisao(5)).toBe('AZUL');
    expect(corDaDivisao(7)).toBe('CIANO');
  });

  it('índice inválido conta como A', () => {
    expect(corDaDivisao(-1)).toBe('AZUL');
    expect(corDaDivisao(1.5)).toBe('AZUL');
    expect(corDaDivisao(Number.NaN)).toBe('AZUL');
  });

  it('as cinco primeiras usam as cinco cores da paleta, sem repetir', () => {
    expect(new Set([0, 1, 2, 3, 4].map(corDaDivisao))).toEqual(new Set(CHAVES_DE_IDENTIFICACAO));
  });
});

describe('corDaRefeicao', () => {
  it('segue a ordem do dia, em ciclo', () => {
    expect([0, 1, 2, 3, 4, 5].map(corDaRefeicao)).toEqual(['CIANO', 'AZUL', 'VIOLETA', 'MAGENTA', 'INDIGO', 'CIANO']);
    expect(corDaRefeicao(-3)).toBe('CIANO');
  });
});
