/* eslint-disable @typescript-eslint/no-require-imports */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { CabecalhoDeGrupo } from './CabecalhoDeGrupo';

jest.mock('./Selo', () => ({ Selo: () => null }));
jest.mock('./Texto', () => ({ Texto: () => null }));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ cores: require('../tema/tokens').CLARO }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const botao = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];

it('recolhível: o botão diz aberto/recolhido na web (aria-expanded) e no nativo (accessibilityState)', () => {
  let r!: ReactTestRenderer;
  act(() => { r = create(<CabecalhoDeGrupo titulo="Segunda" aoAlternar={() => undefined} aberto />); });
  expect(botao(r).props['aria-expanded']).toBe(true);
  expect(botao(r).props.accessibilityState).toEqual({ expanded: true });
  act(() => r.update(<CabecalhoDeGrupo titulo="Segunda" aoAlternar={() => undefined} aberto={false} />));
  expect(botao(r).props['aria-expanded']).toBe(false);
  expect(botao(r).props.accessibilityState).toEqual({ expanded: false });
});

it('sem `aoAlternar` não há botão (nada de aria-expanded num título fixo)', () => {
  let r!: ReactTestRenderer;
  act(() => { r = create(<CabecalhoDeGrupo titulo="Segunda" />); });
  expect(botao(r)).toBeUndefined();
});
