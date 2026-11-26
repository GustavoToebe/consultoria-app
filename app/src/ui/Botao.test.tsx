/* eslint-disable @typescript-eslint/no-require-imports */
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ESCURO } from '../tema/tokens';
import { Botao } from './Botao';
import { coresDoBotaoDePerigo } from './botaoDePerigo';
import { coresDoDesabilitado } from './desabilitado';

/** Variantes de perigo (26/11): `perigo` e o nome antigo `perigoTexto` são tonais, com a caixa e a altura do secundário. */
jest.mock('@rn-primitives/slot', () => jest.requireActual('../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('./useMovimentoReduzido', () => ({ useMovimentoReduzido: () => true }));
jest.mock('./Texto', () => ({ Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').ESCURO, fatorTexto: 1 }) }));

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

type Tipo = 'perigo' | 'perigoTexto' | 'secundario' | 'fantasma';

function estiloDe(tipo: Tipo, extra: { desabilitado?: boolean } = {}) {
  let r!: ReactTestRenderer;
  act(() => { r = create(<Botao rotulo="Excluir" tipo={tipo} aoTocar={() => undefined} {...extra} />); });
  const no = r.root.find((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button');
  return StyleSheet.flatten(no.props.style) as { backgroundColor?: string; borderColor?: string; borderWidth?: number; minHeight?: number; paddingHorizontal?: number };
}

const perigo = coresDoBotaoDePerigo(ESCURO);

it.each(['perigo', 'perigoTexto'] as const)('%s: fundo tonal `perigoSuave`, contorno de perigo e a caixa do secundário', (tipo) => {
  const e = estiloDe(tipo);
  const secundario = estiloDe('secundario');
  expect(e).toMatchObject({ backgroundColor: ESCURO.perigoSuave, borderColor: perigo.borda, borderWidth: 1 });
  // Mesma altura e preenchimento do secundário: trocar a variante não mexe no layout.
  expect({ minHeight: e.minHeight, paddingHorizontal: e.paddingHorizontal }).toEqual({ minHeight: secundario.minHeight, paddingHorizontal: secundario.paddingHorizontal });
});

it('perigo desabilitado: o cinza único do desabilitado, sem vermelho', () => {
  const cinza = coresDoDesabilitado(ESCURO);
  expect(estiloDe('perigoTexto', { desabilitado: true })).toMatchObject({ backgroundColor: cinza.fundo, borderColor: cinza.borda });
});

it('fantasma continua só texto (sem fundo)', () => {
  expect(estiloDe('fantasma').backgroundColor).toBe('transparent');
});

it('cores do perigo: rótulo `perigo`, contorno entre o fundo e `perigo`, cheio ao passar o mouse', () => {
  expect(perigo).toMatchObject({ fundo: ESCURO.perigoSuave, texto: ESCURO.perigo, bordaAoPassar: ESCURO.perigo });
  expect(perigo.borda).not.toBe(perigo.fundo);
  expect(perigo.borda).not.toBe(perigo.texto);
});
