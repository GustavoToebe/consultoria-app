/* eslint-disable @typescript-eslint/no-require-imports */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tema } from '../api/tipos';
import { chaveDasPreferencias } from '../dominio/preferencias';
import { PALETAS, modoDaPaleta } from './tokens';

let mockMarca: { temaPadrao: Tema; corPrimaria: string } | null = null;
let mockUsuario: { id: string } | null = null;

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('uniwind', () => ({ Uniwind: { setTheme: jest.fn(), updateCSSVariables: jest.fn() } }));
jest.mock('../ui/vibrar', () => ({ definirVibracaoLigada: () => undefined }));
jest.mock('../sessao/SessaoProvider', () => ({ useSessao: () => ({ usuario: mockUsuario, marca: mockMarca }) }));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');
const { Uniwind } = require('uniwind') as { Uniwind: { setTheme: jest.Mock } };
const { TemaProvider, useTema } = require('./TemaProvider') as typeof import('./TemaProvider');

const lido: { tema?: ReturnType<typeof useTema> } = {};
function Espiao() {
  const tema = useTema();
  React.useEffect(() => {
    lido.tema = tema;
  }, [tema]);
  return null;
}

async function montar() {
  await Renderer.act(async () => {
    Renderer.create(
      <TemaProvider>
        <Espiao />
      </TemaProvider>,
    );
  });
}

beforeEach(async () => {
  mockMarca = null;
  mockUsuario = null;
  Uniwind.setTheme.mockClear();
  await AsyncStorage.clear();
});

describe('TemaProvider com a paleta da consultoria', () => {
  it('paleta escura (Ameixa): modo escuro, cores da paleta e esquema escuro do Uniwind', async () => {
    mockMarca = { temaPadrao: 'AMEIXA', corPrimaria: '#C62828' };
    await montar();
    expect(lido.tema!.modo).toBe('ESCURO');
    expect(lido.tema!.cores.fundo).toBe(PALETAS.AMEIXA.cores.fundo);
    expect(Uniwind.setTheme).toHaveBeenLastCalledWith('dark');
  });

  it('paleta clara (Lavanda): modo claro, cores da paleta e esquema claro do Uniwind', async () => {
    mockMarca = { temaPadrao: 'LAVANDA', corPrimaria: '#C62828' };
    await montar();
    expect(lido.tema!.modo).toBe('CLARO');
    expect(lido.tema!.cores.fundo).toBe(PALETAS.LAVANDA.cores.fundo);
    expect(lido.tema!.cores.superficie3).toBe(PALETAS.LAVANDA.cores.superficie3);
    expect(Uniwind.setTheme).toHaveBeenLastCalledWith('light');
  });

  it('a escolha da pessoa (Escuro) vence a paleta clara da consultoria', async () => {
    mockMarca = { temaPadrao: 'LAVANDA', corPrimaria: '#C62828' };
    mockUsuario = { id: 'u1' };
    await AsyncStorage.setItem(chaveDasPreferencias('u1'), JSON.stringify({ tema: 'ESCURO' }));
    await montar();
    await Renderer.act(async () => undefined);
    expect(lido.tema!.modo).toBe('ESCURO');
    expect(lido.tema!.cores.fundo).toBe(PALETAS.ESCURO.cores.fundo);
  });

  it('todo código de paleta tem modo e cores no mapa único', () => {
    for (const codigo of Object.keys(PALETAS) as Tema[]) {
      expect(['ESCURO', 'CLARO']).toContain(modoDaPaleta(codigo));
      expect(PALETAS[codigo].cores.fundo).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
