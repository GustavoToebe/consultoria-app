import type { ExercicioPlano } from '../../api/tipos';
import { exercicio, serie } from '../../dominio/exemplosDeTreino.apoioTeste';
import { CartaoExercicio } from './CartaoExercicio';

/**
 * Corpo do exercício (04/11): sem Modalidade, "Carga do exercício" nem "Progressão de carga"; "Instruções, vídeo e
 * cadência (opcional)" nasce fechado (mesmo com conteúdo), abre com nome vazio, alterna no toque e fica aberto com erro dentro.
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
  Botao: ({ rotuloAcessivel, rotulo, tipo, aoTocar }: { rotuloAcessivel?: string; rotulo: string; tipo?: string; aoTocar: () => void }) => require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: aoTocar, testID: `botao-${tipo ?? 'primario'}` }),
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
jest.mock('../FolhaDeAcoes', () => {
  const { Pressable } = jest.requireActual('react-native');
  // O menu ⋯ sem a Folha: cada ação vira um botão com o nome acessível do item da folha ("rótulo, detalhe").
  return { FolhaDeAcoes: ({ acoes }: { acoes: { rotulo: string; detalhe?: string; aoTocar: () => void }[] }) =>
    acoes.map((a) => <Pressable key={a.rotulo} accessibilityLabel={`${a.rotulo}, ${a.detalhe}`} onPress={a.aoTocar} />) };
});
jest.mock('./EditorSeries', () => ({ EditorSeries: () => null, BotaoDeMover: () => null }));
jest.mock('./EditorDoCardio', () => ({ EditorDoCardio: () => null }));

// PC: o "Trocar exercício" é botão com texto (abaixo de 768 px vira só o ícone).
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.spyOn(require('react-native'), 'useWindowDimensions').mockImplementation(() => ({ width: 1280, height: 900, scale: 1, fontScale: 1 }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;

const EXTRAS = 'Nome de exibição e instruções';

function montar(e: ExercicioPlano, extra: { total?: number; grupoMuscular?: string; aoAbrir?: () => void } = {}): Arvore {
  let arvore: Arvore | undefined;
  Renderer.act(() => {
    arvore = Renderer.create(
      <CartaoExercicio exercicio={e} posicao={0} total={extra.total ?? 1} aberto comProblema={false} config={null}
        grupoMuscular={extra.grupoMuscular} aoAbrir={extra.aoAbrir}
        aoMudar={() => undefined} aoMover={() => undefined} aoRemover={() => undefined}
        aoEscolherDaBiblioteca={() => undefined} aoUsarReceita={() => undefined} aoSalvarReceita={() => undefined} />,
    );
  });
  return arvore as Arvore;
}
const botaoDosExtras = (a: Arvore) => a.root.findAll((n) => String(n.props.accessibilityLabel ?? '').startsWith(EXTRAS) && typeof n.props.onPress === 'function')[0];
const aberto = (a: Arvore) => botaoDosExtras(a).props.accessibilityState?.expanded as boolean;
const temCampo = (a: Arvore, rotulo: string) => a.root.findAll((n) => n.props.accessibilityLabel === `campo ${rotulo}`).length > 0;
const textos = (a: Arvore) => JSON.stringify(a.toJSON());

const base = exercicio('ex', { nome: 'Supino de teste', modalidade: 'LIVRE', series: [serie('s1')] });

describe('CartaoExercicio: botão Trocar exercício (19/11)', () => {
  it('o nome acessível começa por "Trocar exercício" e leva o nome; o nome antigo não existe', () => {
    const a = montar(base);
    const toque = (rotulo: string) => a.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.props.onPress === 'function');
    expect(toque('Trocar exercício: Supino de teste').length).toBeGreaterThan(0);
    expect(toque('Trocar Supino de teste')).toHaveLength(0);
    expect(toque('Trocar exercício: o exercício')).toHaveLength(0);
    expect(montar({ ...base, nome: '' }).root.findAll((n) => n.props.accessibilityLabel === 'Trocar exercício: o exercício').length).toBeGreaterThan(0);
  });
});

describe('CartaoExercicio: cabeçalho do editor do exercício (27/11)', () => {
  const textosSoltos = (a: Arvore) => a.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
  const tipoDoTrocar = (a: Arvore) => a.root.findAll((n) => String(n.props.accessibilityLabel ?? '').startsWith('Trocar exercício:') && typeof n.props.testID === 'string')[0]?.props.testID;

  it('posição, grupo e a modalidade por extenso em cima; o nome embaixo', () => {
    const a = montar({ ...base, nome: 'Agachamento livre' }, { total: 7, grupoMuscular: 'Quadríceps' });
    const t = textosSoltos(a);
    expect(t).toContain('Exercício 1 de 7 · Quadríceps · Peso livre');
    expect(t).toContain('Agachamento livre');
    // Sem grupo nem modalidade conhecida, só a posição.
    expect(textosSoltos(montar({ ...base, modalidade: null }))).toContain('Exercício 1 de 1');
    // Cardio da biblioteca com o grupo "Cardio": a palavra uma vez só.
    expect(textosSoltos(montar({ ...base, modalidade: 'CARDIO' }, { grupoMuscular: 'Cardio' }))).toContain('Exercício 1 de 1 · Cardio');
  });

  it('"Trocar exercício" é acao no painel (uma vez na área) e secundario no cartão empilhado (um por cartão)', () => {
    expect(tipoDoTrocar(montar(base))).toBe('botao-acao');
    expect(tipoDoTrocar(montar(base, { aoAbrir: () => undefined }))).toBe('botao-secundario');
  });

  it('⋯ (com mais de um exercício) e "Excluir exercício" em perigo ao lado', () => {
    const a = montar(base, { total: 2 });
    expect(a.root.findAll((n) => n.props.accessibilityLabel === `Mais ações de ${base.nome}` && typeof n.props.onPress === 'function').length).toBeGreaterThan(0);
    const excluir = a.root.findAll((n) => n.props.accessibilityLabel === `Excluir exercício: ${base.nome}` && typeof n.props.testID === 'string');
    expect(excluir[0]?.props.testID).toBe('botao-perigo');
  });
});

describe('CartaoExercicio: nome de exibição e instruções', () => {
  it('só com o nome começa fechado, sem marcador; sem nome abre no campo', () => {
    const a = montar(base);
    expect(aberto(a)).toBe(false);
    expect(botaoDosExtras(a).props.accessibilityLabel).toBe(EXTRAS);
    expect(temCampo(a, 'Nome de exibição')).toBe(false);
    expect(temCampo(a, 'Observação para o aluno')).toBe(false);
    const semNome = montar({ ...base, nome: '' });
    expect(aberto(semNome)).toBe(true);
    expect(temCampo(semNome, 'Nome de exibição')).toBe(true);
  });

  // 27/11: seção recolhível de verdade; fechada, o resumo em texto secundário embaixo do título diz o que há dentro.
  it('fechado, o resumo diz o que já tem dentro', () => {
    const a = montar({ ...base, observacao: 'Desça devagar.', cadencia: '3-1-1-0' });
    expect(botaoDosExtras(a).props.accessibilityLabel).toBe(EXTRAS);
    const textos = a.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    expect(textos).toContain(`${base.nome} · sem vídeo · cadência 3-1-1-0 · com observação`);
  });

  it('fechado e sem nada, o resumo diz o que falta ("sem vídeo · sem cadência")', () => {
    const textos = montar(base).root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    expect(textos).toContain(`${base.nome} · sem vídeo · sem cadência`);
  });

  it('com observação, vídeo, cadência ou isometria também começa fechado (18/11)', () => {
    for (const extra of [{ observacao: 'Desça devagar.' }, { videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }, { cadencia: '3-1-1-0' }, { isometriaSegundos: 10 }]) {
      const a = montar({ ...base, ...extra });
      expect(aberto(a)).toBe(false);
      expect(temCampo(a, 'Observação para o aluno')).toBe(false);
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

  it('não tem campo de modalidade, carga do exercício nem progressão de carga', () => {
    const t = textos(montar(base));
    expect(t).not.toMatch(/Modalidade/);
    expect(t).not.toMatch(/Carga do exercício/);
    expect(t).not.toMatch(/Progressão de carga/);
  });
});
