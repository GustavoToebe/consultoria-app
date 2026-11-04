import { useEffect } from 'react';

import { chaveDasPreferencias, PREFERENCIAS_PADRAO } from '../dominio/preferencias';
import { AREIA, CLARO, ESCURO } from './tokens';
import { TemaProvider, useTema } from './TemaProvider';

const mockGetItem = jest.fn<Promise<string | null>, [string]>();
const mockSetItem = jest.fn<Promise<void>, [string, string]>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (chave: string) => mockGetItem(chave),
    setItem: (chave: string, valor: string) => mockSetItem(chave, valor),
  },
}));

jest.mock('uniwind', () => ({
  Uniwind: {
    setTheme: jest.fn(),
    updateCSSVariables: jest.fn(),
  },
}));

jest.mock('../ui/vibrar', () => ({
  definirVibracaoLigada: jest.fn(),
}));

let mockUsuario: { id: string } | null = null;
jest.mock('../sessao/SessaoProvider', () => ({
  useSessao: () => ({
    usuario: mockUsuario,
    marca: null,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

type Retorno = ReturnType<typeof useTema>;
const montados: import('react-test-renderer').ReactTestRenderer[] = [];

afterEach(async () => {
  await Renderer.act(async () => {
    montados.splice(0).forEach((m) => m.unmount());
  });
});

async function montar(): Promise<{ atual: () => Retorno }> {
  const guardado: { valor?: Retorno } = {};
  function Sonda() {
    const valor = useTema();
    useEffect(() => {
      guardado.valor = valor;
    });
    return null;
  }
  await Renderer.act(async () => {
    const r = Renderer.create(
      <TemaProvider>
        <Sonda />
      </TemaProvider>,
    );
    montados.push(r);
  });
  return { atual: () => guardado.valor as Retorno };
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockUsuario = null;
  mockGetItem.mockResolvedValue(null);
  mockSetItem.mockResolvedValue(undefined);
});

describe('TemaProvider', () => {
  it('sem usuário: escolher um tema muda o tema na tela em memória e não grava no AsyncStorage nem no localStorage', async () => {
    const { atual } = await montar();
    expect(atual().preferenciasLidas).toBe(true);

    await Renderer.act(async () => {
      atual().escolherPreferencia({ tema: 'ESCURO' });
    });
    expect(atual().preferencias.tema).toBe('ESCURO');
    expect(atual().modo).toBe('ESCURO');
    expect(atual().cores.fundo).toBe(ESCURO.fundo);

    await Renderer.act(async () => {
      atual().escolherPreferencia({ tema: 'AREIA' });
    });
    expect(atual().preferencias.tema).toBe('AREIA');
    expect(atual().modo).toBe('CLARO');
    expect(atual().cores.fundo).toBe(AREIA.fundo);

    await Renderer.act(async () => {
      atual().escolherPreferencia({ tema: 'CLARO' });
    });
    expect(atual().preferencias.tema).toBe('CLARO');
    expect(atual().modo).toBe('CLARO');
    expect(atual().cores.fundo).toBe(CLARO.fundo);

    expect(mockGetItem).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('com usuário: lê as preferências salvas e grava no AsyncStorage ao escolher um tema', async () => {
    mockUsuario = { id: 'u-42' };
    mockGetItem.mockResolvedValue(JSON.stringify({ ...PREFERENCIAS_PADRAO, tema: 'CLARO' }));

    const { atual } = await montar();
    expect(mockGetItem).toHaveBeenCalledWith(chaveDasPreferencias('u-42'));
    expect(atual().preferenciasLidas).toBe(true);
    expect(atual().preferencias.tema).toBe('CLARO');
    expect(atual().modo).toBe('CLARO');

    await Renderer.act(async () => {
      atual().escolherPreferencia({ tema: 'ESCURO' });
    });
    expect(atual().preferencias.tema).toBe('ESCURO');
    expect(atual().modo).toBe('ESCURO');
    expect(mockSetItem).toHaveBeenCalledWith(
      chaveDasPreferencias('u-42'),
      JSON.stringify({ ...PREFERENCIAS_PADRAO, tema: 'ESCURO' }),
    );
  });
});
