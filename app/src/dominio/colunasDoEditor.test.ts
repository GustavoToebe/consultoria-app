import { LARGURA_EDITOR, LARGURA_EDITOR_DE_CAMPOS, LARGURA_EDITOR_DUAS_COLUNAS, type FaixaDeLargura } from '../tema/tokens';
import {
  colunasComPrevia,
  duasColunas,
  larguraDoEditor,
  LARGURA_DA_LISTA_DO_TREINO,
  LARGURA_DO_INDICE_DO_EDITOR,
  LARGURA_DO_RESUMO_DO_TREINO,
  PREVIA_MAXIMA,
  PREVIA_MINIMA,
  tresColunas,
  VAO_ENTRE_COLUNAS,
} from './colunasDoEditor';
import type { LarguraConteudo } from './preferencias';

describe('três colunas do editor', () => {
  const faixas: FaixaDeLargura[] = ['compacta', 'normal', 'larga', 'ultralarga'];
  const preferencias: LarguraConteudo[] = ['AUTOMATICA', 'LIMITADA'];
  const esperado = (faixa: FaixaDeLargura, desde: 'larga' | 'ultralarga', preferencia: LarguraConteudo) =>
    desde === 'larga' ? faixa === 'larga' || faixa === 'ultralarga' : faixa === 'ultralarga' && preferencia === 'AUTOMATICA';

  for (const desde of ['larga', 'ultralarga'] as const) {
    for (const faixa of faixas) {
      for (const preferencia of preferencias) {
        it(`desde ${desde}, faixa ${faixa}, ${preferencia}`, () => {
          expect(tresColunas(faixa, desde, preferencia, true)).toBe(esperado(faixa, desde, preferencia));
          expect(tresColunas(faixa, desde, preferencia, false)).toBe(false);
        });
      }
    }
  }

  it('o treino (desde larga) ignora a preferência; dieta e mobilidade não', () => {
    expect(tresColunas('larga', 'larga', 'LIMITADA', true)).toBe(true);
    expect(tresColunas('ultralarga', 'larga', 'LIMITADA', true)).toBe(true);
    expect(tresColunas('ultralarga', 'ultralarga', 'LIMITADA', true)).toBe(false);
    expect(tresColunas('larga', 'ultralarga', 'AUTOMATICA', true)).toBe(false);
  });

  it('larguras das colunas do treino', () => {
    expect(LARGURA_DA_LISTA_DO_TREINO).toBe(300);
    expect(LARGURA_DO_RESUMO_DO_TREINO).toBe(320);
  });
});

describe('colunas do editor de treino', () => {
  it('duas colunas a partir de 960 de conteúdo', () => {
    expect(duasColunas(959)).toBe(false);
    expect(duasColunas(960)).toBe(true);
    expect(duasColunas(1008)).toBe(true);
    expect(duasColunas(1168)).toBe(true);
  });

  it('sem medida, uma coluna', () => {
    expect(duasColunas(0)).toBe(false);
    expect(duasColunas(null)).toBe(false);
    expect(duasColunas(undefined)).toBe(false);
    expect(duasColunas(Number.NaN)).toBe(false);
  });

  it('a largura do editor acompanha as colunas', () => {
    expect(larguraDoEditor(true)).toBe(LARGURA_EDITOR_DUAS_COLUNAS);
    expect(larguraDoEditor(false)).toBe(LARGURA_EDITOR);
  });
});

describe('colunas com prévia (índice + editor + prévia, 28/11)', () => {
  const larguras = [1200, 1440, 1600, 1917.5, 2148, 2149, 2428, 2429, 2560, 3104, 3440];
  for (let l = 1200; l <= 3440; l += 40) larguras.push(l);

  for (const l of larguras) {
    it(`${l} px: soma exata, vão fixo de 24 e crescimento na ordem`, () => {
      const c = colunasComPrevia(l);
      expect(c.indice + c.editor + c.previa + 2 * c.vao + c.sobra).toBeCloseTo(l, 6);
      expect(c.vao).toBe(VAO_ENTRE_COLUNAS);
      expect(c.indice).toBe(LARGURA_DO_INDICE_DO_EDITOR);
      expect(c.sobra).toBeGreaterThanOrEqual(0);
      expect(c.editor).toBeLessThanOrEqual(LARGURA_EDITOR_DE_CAMPOS);
      expect(c.previa).toBeGreaterThanOrEqual(PREVIA_MINIMA);
      expect(c.previa).toBeLessThanOrEqual(PREVIA_MAXIMA);
      if (c.previa > PREVIA_MINIMA) expect(c.editor).toBe(LARGURA_EDITOR_DE_CAMPOS);
      if (c.sobra >= 1) expect(c.previa).toBe(PREVIA_MAXIMA);
      expect(Number.isInteger(c.editor) && Number.isInteger(c.previa)).toBe(true);
    });
  }

  it('pontos de quebra: editor chega a 1400 em 2148 e a prévia a 720 em 2428; depois, a sobra vai para o fim', () => {
    expect(colunasComPrevia(2000)).toEqual({ indice: 260, editor: 1252, previa: 440, vao: 24, sobra: 0 });
    expect(colunasComPrevia(2148)).toMatchObject({ editor: 1400, previa: 440, sobra: 0 });
    expect(colunasComPrevia(2300)).toMatchObject({ editor: 1400, previa: 592, sobra: 0 });
    expect(colunasComPrevia(2428)).toMatchObject({ editor: 1400, previa: 720, sobra: 0 });
    expect(colunasComPrevia(3440)).toMatchObject({ editor: 1400, previa: 720, sobra: 1012 });
  });

  it('cresce sem voltar: editor e prévia nunca diminuem com a linha maior', () => {
    let antes = colunasComPrevia(1200);
    for (let l = 1201; l <= 3440; l++) {
      const c = colunasComPrevia(l);
      expect(c.editor).toBeGreaterThanOrEqual(antes.editor);
      expect(c.previa).toBeGreaterThanOrEqual(antes.previa);
      antes = c;
    }
  });

  it('índice próprio (a lista da mobilidade, 280) e sem prévia (índice + editor, um vão só)', () => {
    expect(colunasComPrevia(1920, 280)).toEqual({ indice: 280, editor: 1152, previa: 440, vao: 24, sobra: 0 });
    expect(colunasComPrevia(1200, 260, false)).toEqual({ indice: 260, editor: 916, previa: 0, vao: 24, sobra: 0 });
    expect(colunasComPrevia(3000, 260, false)).toMatchObject({ editor: 1400, previa: 0, sobra: 1316 });
  });

  it('largura que não cabe nem o mínimo: nada negativo', () => {
    const c = colunasComPrevia(600);
    expect(c.editor).toBeGreaterThanOrEqual(0);
    expect(c.previa).toBeGreaterThanOrEqual(0);
  });
});
