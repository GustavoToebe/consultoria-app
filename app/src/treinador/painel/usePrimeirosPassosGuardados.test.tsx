import { useEffect } from 'react';

import { conferir, ESTADO_INICIAL, serializarEstado } from '../../dominio/primeirosPassos';
import { usePrimeirosPassosGuardados } from './usePrimeirosPassosGuardados';

const mockGetItem = jest.fn<Promise<string | null>, [string]>();
const mockSetItem = jest.fn<Promise<void>, [string, string]>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (chave: string) => mockGetItem(chave),
    setItem: (chave: string, valor: string) => mockSetItem(chave, valor),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

type Retorno = ReturnType<typeof usePrimeirosPassosGuardados>;

test('a releitura que começou antes de um toque e responde depois não desfaz o toque', async () => {
  mockSetItem.mockResolvedValue(undefined);
  mockGetItem.mockResolvedValueOnce(serializarEstado(ESTADO_INICIAL));
  const guardado: { valor?: Retorno } = {};
  function Sonda() {
    const valor = usePrimeirosPassosGuardados('usuario-ficticio');
    useEffect(() => {
      guardado.valor = valor;
    });
    return null;
  }
  let montado: import('react-test-renderer').ReactTestRenderer | undefined;
  await Renderer.act(async () => {
    montado = Renderer.create(<Sonda />);
  });
  expect(guardado.valor?.estado?.conferidos).toEqual([]);

  // Volta à tela: a releitura fica pendente, com o valor de antes do toque.
  let responder: (valor: string | null) => void = () => undefined;
  mockGetItem.mockImplementationOnce(() => new Promise((r) => { responder = r; }));
  await Renderer.act(async () => guardado.valor?.releer());
  // O toque acontece enquanto a leitura está em voo.
  await Renderer.act(async () => guardado.valor?.gravar((e) => conferir(e, 'metodologia')));
  expect(guardado.valor?.estado?.conferidos).toEqual(['metodologia']);
  // A leitura velha chega depois e é descartada.
  await Renderer.act(async () => responder(serializarEstado(ESTADO_INICIAL)));
  expect(guardado.valor?.estado?.conferidos).toEqual(['metodologia']);

  await Renderer.act(async () => montado?.unmount());
});
