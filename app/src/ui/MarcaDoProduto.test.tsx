import React from 'react';

import { IconeBarrasDoProduto, IconeDoProduto, LogoDoProduto } from './MarcaDoProduto';

let mockModoAtual: 'CLARO' | 'ESCURO' = 'ESCURO';
jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ modo: mockModoAtual }),
}));

function elementos(raiz: React.ReactElement): React.ReactElement[] {
  const fila: unknown[] = [raiz];
  const achados: React.ReactElement[] = [];
  while (fila.length > 0) {
    const item = fila.shift();
    if (!item || typeof item !== 'object') continue;
    if (Array.isArray(item)) {
      fila.push(...item);
      continue;
    }
    if (React.isValidElement(item)) {
      achados.push(item);
      const props = item.props as { children?: unknown };
      if (props.children !== undefined) fila.push(props.children);
    }
  }
  return achados;
}

describe('MarcaDoProduto', () => {
  it('IconeDoProduto desenha o quadrado #0A0A0A e as três barras #F2050B sem papel próprio de imagem', () => {
    const arvore = IconeDoProduto({ tamanho: 36 });
    expect(arvore.props).toMatchObject({ width: 36, height: 36, viewBox: '0 0 512 512', accessible: false });
    const nos = elementos(arvore);
    const cores = nos.map((n) => (n.props as { fill?: string }).fill).filter(Boolean);
    expect(cores).toEqual(['#0A0A0A', '#F2050B', '#F2050B', '#F2050B']);
  });

  it('IconeBarrasDoProduto desenha apenas as três barras vermelhas sem fundo quadrado', () => {
    const arvore = IconeBarrasDoProduto({ tamanho: 28 });
    expect(arvore.props).toMatchObject({ width: 28, height: 28, viewBox: '0 0 512 512', accessible: false });
    const cores = elementos(arvore).map((n) => (n.props as { fill?: string }).fill).filter(Boolean);
    expect(cores).toEqual(['#F2050B', '#F2050B', '#F2050B']);
  });

  it('LogoDoProduto usa letras brancas no tema escuro, pretas no tema claro e respeita override de fundo', () => {
    mockModoAtual = 'ESCURO';
    const escura = LogoDoProduto({ altura: 24 });
    expect(escura.props).toMatchObject({ height: 24, width: 342, accessibilityLabel: 'Overtraining' });
    expect(elementos(escura).map((n) => (n.props as { fill?: string }).fill).filter(Boolean)).toEqual([
      '#FFFFFF', '#F2050B', '#F2050B', '#F2050B',
    ]);

    mockModoAtual = 'CLARO';
    const clara = LogoDoProduto({ altura: 24 });
    expect(elementos(clara).map((n) => (n.props as { fill?: string }).fill).filter(Boolean)).toEqual([
      '#0A0A0A', '#F2050B', '#F2050B', '#F2050B',
    ]);

    const forcadaEscura = LogoDoProduto({ altura: 24, fundo: 'escuro' });
    expect(elementos(forcadaEscura).map((n) => (n.props as { fill?: string }).fill).filter(Boolean)[0]).toBe('#FFFFFF');
  });
});
