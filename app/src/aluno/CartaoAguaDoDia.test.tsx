/* eslint-disable @typescript-eslint/no-require-imports */
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { contraste, corDaAgua, ESCURO } from '../tema/tokens';
import { CartaoAguaDoDia } from './CartaoAguaDoDia';

/** Pedido 20 (27/11): o ícone do − e do + segue a cor da água (como a gota e a barra); desabilitado, o cinza do botão. */
jest.mock('lucide-react-native', () =>
  new Proxy({}, { get: (_alvo, nome) => (nome === '__esModule' ? true : (props: object) => require('react').createElement('Icone', { nome, ...props })) }));
jest.mock('@rn-primitives/slot', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../ui/useMovimentoReduzido', () => ({ useMovimentoReduzido: () => true }));
jest.mock('../ui/Texto', () => ({ Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('../ui/Cartao', () => ({ Cartao: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').View, null, children) }));
jest.mock('../ui/BarraProgresso', () => ({ BarraProgresso: () => null }));
jest.mock('./DatasDaMobilidade', () => ({ DatasDaMobilidade: () => null }));
jest.mock('../tema/TemaProvider', () => {
  const t = require('../tema/tokens');
  return { useTema: () => ({ cores: t.ESCURO, identificacao: { AGUA: t.corDaAgua(t.ESCURO, 'escuro') }, fatorTexto: 1 }) };
});
let mockAgua = new Map<string, number>();
jest.mock('../offline/AlunoProvider', () => ({ useAluno: () => ({ aguaPorDia: mockAgua, marcarAgua: () => Promise.resolve() }) }));

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

const agua = corDaAgua(ESCURO, 'escuro').cor;

function montar(ml?: number) {
  const { hojeDoCiclo } = require('../dominio/cicloMenstrual') as typeof import('../dominio/cicloMenstrual');
  mockAgua = ml === undefined ? new Map() : new Map([[hojeDoCiclo(), ml]]);
  let r!: ReactTestRenderer;
  act(() => { r = create(<CartaoAguaDoDia metaLitros={3} compacto />); });
  return r;
}
const botao = (r: ReactTestRenderer, rotulo: string) =>
  r.root.find((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === rotulo);
const corDoIcone = (b: ReactTestInstance) => b.find((n) => (n.type as unknown) === 'Icone').props.color as string;

it('com copos marcados, o ícone do − e do + é a cor da água e passa 4,5:1 sobre o fundo do botão', () => {
  const r = montar(500);
  for (const rotulo of ['Tirar um copo', 'Mais um copo']) {
    const b = botao(r, rotulo);
    expect(corDoIcone(b)).toBe(agua);
    const fundo = (StyleSheet.flatten(b.props.style) as { backgroundColor: string }).backgroundColor;
    expect(contraste(agua, fundo)).toBeGreaterThanOrEqual(4.5);
  }
});

it('sem copo, o − desabilitado volta ao ícone cinza do botão; o + segue na cor da água', () => {
  const r = montar();
  expect(corDoIcone(botao(r, 'Tirar um copo'))).not.toBe(agua);
  expect(corDoIcone(botao(r, 'Mais um copo'))).toBe(agua);
});
