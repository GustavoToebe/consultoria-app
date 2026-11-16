import { BadgeNivel, PilulaStatus } from './BadgeNivel';

jest.mock('@rn-primitives/slot', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());

jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cores: require('../tema/tokens').ESCURO,
    modo: 'ESCURO',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    stndrd: require('../tema/tokens').TOKENS_STNDRD_ESCURO,
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

describe('BadgeNivel e PilulaStatus', () => {
  it('renderiza Beginner, Intermediate e Advanced com textos corretos', () => {
    expect(renderizar(<BadgeNivel nivel="INICIANTE" />)).toContain('Beginner');
    expect(renderizar(<BadgeNivel nivel="INTERMEDIARIO" />)).toContain('Intermediate');
    expect(renderizar(<BadgeNivel nivel="AVANCADO" />)).toContain('Advanced');
  });

  it('renderiza pílulas semânticas Live, Invite & earn e NEW PR', () => {
    expect(renderizar(<PilulaStatus tipo="LIVE" />)).toContain('Live');
    expect(renderizar(<PilulaStatus tipo="INVITE_EARN" />)).toContain('Invite & earn');
    expect(renderizar(<PilulaStatus tipo="NEW_PR" />)).toContain('NEW PR');
  });
});
