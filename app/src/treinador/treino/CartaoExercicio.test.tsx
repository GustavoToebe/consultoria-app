import type { ExercicioPlano } from '../../api/tipos';
import { exercicio, serie } from '../../dominio/exemplosDeTreino.apoioTeste';
import { CartaoExercicio } from './CartaoExercicio';

/**
 * Corpo do exercício (04/11): sem Modalidade, "Carga do exercício" nem "Progressão de carga"; "Instruções, vídeo e
 * cadência (opcional)" fecha quando vazio, abre quando já tem algo, alterna no toque e fica aberto com erro dentro.
 * As peças com primitivos nativos viram falsas que só repassam rótulo, estado e toque; as séries não entram aqui.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/portal', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../tema/TemaProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));
jest.mock('../../ui/unidadeDeCargaEmUso', () => ({ useUnidadeDeCarga: () => 'kg' }));
jest.mock('../../ui/Botao', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Botao: ({ rotuloAcessivel, rotulo, aoTocar }: { rotuloAcessivel?: string; rotulo: string; aoTocar: () => void }) => require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: aoTocar }),
}));
const campoFalso = ({ rotulo }: { rotulo: string }) =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react').createElement(require('react-native').View, { accessibilityLabel: `campo ${rotulo}` });
jest.mock('../../ui/Campo', () => ({ Campo: campoFalso }));
jest.mock('../../ui/Campos', () => ({ CampoNumerico: campoFalso }));
jest.mock('../../ui/Selo', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Selo: ({ texto }: { texto: string }) => require('react').createElement(require('react-native').Text, null, texto),
}));
jest.mock('../../ui/DemonstracaoDoExercicio', () => ({ DemonstracaoDoExercicio: () => null }));
jest.mock('./EditorSeries', () => ({ EditorSeries: () => null, BotaoDeMover: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;

const EXTRAS = 'Instruções, vídeo e cadência (opcional)';

function montar(e: ExercicioPlano): Arvore {
  let arvore: Arvore | undefined;
  Renderer.act(() => {
    arvore = Renderer.create(
      <CartaoExercicio exercicio={e} posicao={0} total={1} aberto comProblema={false} config={null}
        aoMudar={() => undefined} aoMover={() => undefined} aoRemover={() => undefined}
        aoEscolherDaBiblioteca={() => undefined} aoUsarReceita={() => undefined} aoSalvarReceita={() => undefined} />,
    );
  });
  return arvore as Arvore;
}
const botaoDosExtras = (a: Arvore) => a.root.findAll((n) => n.props.accessibilityLabel === EXTRAS && typeof n.props.onPress === 'function')[0];
const aberto = (a: Arvore) => botaoDosExtras(a).props.accessibilityState?.expanded as boolean;
const temCampo = (a: Arvore, rotulo: string) => a.root.findAll((n) => n.props.accessibilityLabel === `campo ${rotulo}`).length > 0;
const textos = (a: Arvore) => JSON.stringify(a.toJSON());

const base = exercicio('ex', { nome: 'Supino de teste', modalidade: 'LIVRE', series: [serie('s1')] });

describe('CartaoExercicio: instruções, vídeo e cadência', () => {
  it('vazio começa fechado, com o nome de exibição à vista', () => {
    const a = montar(base);
    expect(aberto(a)).toBe(false);
    expect(temCampo(a, 'Nome de exibição')).toBe(true);
    expect(temCampo(a, 'Observação para o aluno')).toBe(false);
  });

  it('com observação, vídeo, cadência ou isometria começa aberto', () => {
    for (const extra of [{ observacao: 'Desça devagar.' }, { videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }, { cadencia: '3-1-1-0' }, { isometriaSegundos: 10 }]) {
      const a = montar({ ...base, ...extra });
      expect(aberto(a)).toBe(true);
      expect(temCampo(a, 'Observação para o aluno')).toBe(true);
    }
  });

  it('o toque alterna, e um erro dentro mantém aberto', () => {
    const a = montar(base);
    Renderer.act(() => botaoDosExtras(a).props.onPress());
    expect(aberto(a)).toBe(true);
    Renderer.act(() => botaoDosExtras(a).props.onPress());
    expect(aberto(a)).toBe(false);
    const comErro = montar({ ...base, cadencia: '9-9' });
    expect(aberto(comErro)).toBe(true);
    Renderer.act(() => botaoDosExtras(comErro).props.onPress());
    expect(aberto(comErro)).toBe(true);
  });

  it('não mostra modalidade, carga do exercício nem progressão de carga', () => {
    const t = textos(montar(base));
    expect(t).not.toMatch(/Modalidade/);
    expect(t).not.toMatch(/Carga do exercício/);
    expect(t).not.toMatch(/Progressão de carga/);
  });
});
