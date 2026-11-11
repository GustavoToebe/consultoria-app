/* eslint-disable @typescript-eslint/no-require-imports */
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { CLARO } from '../tema/tokens';
import { LinhaDaLista, ListaDeLinhas } from './LinhaDaLista';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() }, usePathname: () => '/' }));
jest.mock('./GuardaDeSaida', () => ({ useSaidaGuardada: () => ({ confirmar: (f: () => void) => f() }) }));
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO }) }));
jest.mock('./Selo', () => ({ Selo: () => null }));
jest.mock('./Texto',() => ({ Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children) }));

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

/** O contêiner da linha: o primeiro `View` com a borda de 1 px. */
const contornos = (r: ReactTestRenderer) =>
  r.root.findAll((n) => String(n.type) === 'View' && StyleSheet.flatten(n.props.style)?.borderWidth === 1);
const estilo = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style);

it('padrão: cada linha na caixa (fundo `superficie2`, contorno `divisor`), sem realce nem divisória da lista', () => {
  let r!: ReactTestRenderer;
  act(() => { r = create(<ListaDeLinhas><LinhaDaLista titulo="A" acoes="x" /><LinhaDaLista titulo="B" acoes="x" /></ListaDeLinhas>); });
  const [a] = contornos(r);
  expect(estilo(a)).toMatchObject({ backgroundColor: CLARO.superficie2, borderColor: CLARO.divisor, borderRadius: expect.any(Number) });
  expect(a.props.onFocus).toBeUndefined();
  expect(a.props.onPointerEnter).toBeUndefined();
  expect(r.root.findAll((n) => String(n.type) === 'View' && estilo(n)?.height === 1)).toHaveLength(0);
});

it('divisorias: sem caixa, uma divisória entre as linhas e realce `superficie3` no foco, no hover e aberta', () => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <ListaDeLinhas divisorias>
        <LinhaDaLista titulo="A" acoes="x" />
        <LinhaDaLista titulo="B" acoes="x" />
        <LinhaDaLista titulo="C" acoes="x">{null}</LinhaDaLista>
        <LinhaDaLista titulo="D" acoes="x">aberta</LinhaDaLista>
        <LinhaDaLista titulo="E" acoes="x" marcado />
      </ListaDeLinhas>,
    );
  });
  const [a, b, c, d, e] = contornos(r);
  expect(estilo(a)).toMatchObject({ backgroundColor: 'transparent', borderColor: 'transparent', borderRadius: 0 });
  const divisorias = r.root.findAll((n) => String(n.type) === 'View' && estilo(n)?.height === 1);
  expect(divisorias).toHaveLength(4);
  expect(estilo(divisorias[0]).backgroundColor).toBe(CLARO.divisor);

  act(() => { a.props.onFocus(); });
  expect(estilo(contornos(r)[0]).backgroundColor).toBe(CLARO.superficie3);
  // O dedo não acende (tocar no lápis não pode parecer tocar na linha); o mouse acende.
  act(() => { a.props.onBlur(); b.props.onPointerEnter({ nativeEvent: { pointerType: 'touch' } }); });
  expect(estilo(contornos(r)[0]).backgroundColor).toBe('transparent');
  expect(estilo(contornos(r)[1]).backgroundColor).toBe('transparent');
  act(() => { b.props.onPointerEnter({ nativeEvent: { pointerType: 'mouse' } }); });
  expect(estilo(contornos(r)[1]).backgroundColor).toBe(CLARO.superficie3);
  act(() => { b.props.onPointerLeave(); });
  expect(estilo(contornos(r)[1]).backgroundColor).toBe('transparent');
  // Sem conteúdo embaixo (`null`) não é aberta; com conteúdo, é.
  expect(estilo(c).backgroundColor).toBe('transparent');
  expect(estilo(d).backgroundColor).toBe(CLARO.superficie3);
  // Escolhida: a seleção neutra de sempre, contorno forte e `superficie3`.
  expect(estilo(e)).toMatchObject({ backgroundColor: CLARO.superficie3, borderColor: CLARO.bordaCampo });
});
