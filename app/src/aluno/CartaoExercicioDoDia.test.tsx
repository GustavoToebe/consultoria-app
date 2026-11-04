import { contagemDoExercicio } from '../dominio/semana';
import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import { exercicio, serie } from '../dominio/exemplosDeTreino.apoioTeste';
import { CartaoExercicioDoDia } from './CartaoExercicioDoDia';

/**
 * O cartão da lista do dia conta como o título do exercício, a faixa e o "Bom trabalho" (`contagemDoExercicio`, D6):
 * aquecimento marcado não entra no "N/M séries" nem no total.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
// O Jest não transforma o JSX dos primitivos (`Selo` usa o badge); só precisam repassar os filhos.
jest.mock('@rn-primitives/slot', () => jest.requireActual('./primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../tema/TemaProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

const textos = (r: import('react-test-renderer').ReactTestRenderer) =>
  r.root.findAll((n) => typeof n.props.children === 'string' || Array.isArray(n.props.children))
    .map((n) => [n.props.children].flat().join(''));

describe('CartaoExercicioDoDia: a mesma contagem do título', () => {
  const e = exercicio('ex', {
    series: [serie('w1', { tipo: 'WARM_UP' }), serie('w2', { tipo: 'WARM_UP' }), serie('t1', { tipo: 'WORKING' }), serie('t2', { tipo: 'WORKING' })],
  });

  it('com o aquecimento marcado, o cartão diz "1/2 séries", como o título', () => {
    const feitas = new Set(['w1', 'w2', 't1']);
    const contagem = contagemDoExercicio(e, (uid) => feitas.has(uid), CONFIGURACAO_PADRAO);
    expect(contagem).toEqual({ total: 2, feitas: 1 });
    let r!: import('react-test-renderer').ReactTestRenderer;
    Renderer.act(() => {
      r = Renderer.create(
        <CartaoExercicioDoDia exercicio={e} posicao={0} contagem={contagem} cargaDoDia={null} ultima={null} tipoTrabalho="WS" metodologia={CONFIGURACAO_PADRAO} aoAbrir={() => undefined} />,
      );
    });
    const tudo = textos(r);
    expect(tudo).toContain('1/2 séries');
    expect(tudo.some((t) => t.includes('/4'))).toBe(false);
    expect(r.root.findAll((n) => String(n.props.accessibilityLabel ?? '').endsWith(', 1 de 2 séries feitas')).length).toBeGreaterThan(0);
  });
});
