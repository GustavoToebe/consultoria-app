/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { MostrarMais, useMostrarMais } from './MostrarMais';

/** O gancho e o botão juntos: 200 itens fictícios, 80 → 160 → 200, e a busca nova volta a 80. */
jest.mock('./Botao', () => {
  const { View: V } = require('react-native') as typeof import('react-native');
  return { Botao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) => <V testID="botao" accessibilityLabel={rotulo} onTouchEnd={aoTocar} /> };
});
jest.mock('./Texto', () => {
  const { Text: T } = require('react-native') as typeof import('react-native');
  return { Texto: ({ children }: { children?: ReactNode }) => <T testID="texto">{children}</T> };
});
jest.mock('./LinhaDeAcoes', () => ({ LinhaDeAcoes: ({ children }: { children?: ReactNode }) => children }));

const ITENS = Array.from({ length: 200 }, (_, i) => `Item ${i + 1}`);

function Lista({ busca }: { busca: string }) {
  const { limite, mostrarMais } = useMostrarMais(busca);
  return (
    <>
      {ITENS.slice(0, limite).map((n) => <View key={n} testID="item" />)}
      <MostrarMais limite={limite} total={ITENS.length} aoMostrarMais={mostrarMais} />
    </>
  );
}

const hosts = (r: ReactTestRenderer, id: string) => r.root.findAll((no) => typeof no.type === 'string' && no.props.testID === id);
const itens = (r: ReactTestRenderer) => hosts(r, 'item').length;
const botoes = (r: ReactTestRenderer) => hosts(r, 'botao');
const texto = (r: ReactTestRenderer) => hosts(r, 'texto').map((t) => t.props.children).join('');

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

it('cresce 80, 160, 200 (sem botão no fim) e volta a 80 quando a busca muda', async () => {
  let r!: ReactTestRenderer;
  await act(async () => { r = create(<Lista busca="" />); });
  expect(itens(r)).toBe(80);
  expect(texto(r)).toBe('Mostrando 80 de 200.');
  expect(botoes(r)[0].props.accessibilityLabel).toBe('Mostrar mais');

  await act(async () => { botoes(r)[0].props.onTouchEnd(); });
  expect(itens(r)).toBe(160);
  expect(texto(r)).toBe('Mostrando 160 de 200.');

  await act(async () => { botoes(r)[0].props.onTouchEnd(); });
  expect(itens(r)).toBe(200);
  expect(botoes(r)).toHaveLength(0);
  expect(texto(r)).toBe('');

  await act(async () => { r.update(<Lista busca="arroz" />); });
  expect(itens(r)).toBe(80);
  expect(texto(r)).toBe('Mostrando 80 de 200.');
});
