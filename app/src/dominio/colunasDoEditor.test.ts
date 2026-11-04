import { LARGURA_EDITOR, LARGURA_EDITOR_DUAS_COLUNAS } from '../tema/tokens';
import { duasColunas, larguraDoEditor } from './colunasDoEditor';

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
