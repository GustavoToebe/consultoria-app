import { BadgeNivel } from './BadgeNivel';

jest.mock('@rn-primitives/slot', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());

jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cores: require('../tema/tokens').ESCURO,
    modo: 'ESCURO',
    fatorTexto: 1,
    preferencias: { animacoes: false },
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

function renderizar(el: import('react').ReactElement) {
  let r!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    r = Renderer.create(el);
  });
  return r.root
    .findAll((n) => typeof n.props.children === 'string' || Array.isArray(n.props.children))
    .map((n) => [n.props.children].flat().join(''));
}

describe('BadgeNivel', () => {
  it('escreve o nível em português (D10)', () => {
    expect(renderizar(<BadgeNivel nivel="INICIANTE" />)).toContain('Iniciante');
    expect(renderizar(<BadgeNivel nivel="INTERMEDIARIO" />)).toContain('Intermediário');
    expect(renderizar(<BadgeNivel nivel="AVANCADO" />)).toContain('Avançado');
  });
});
