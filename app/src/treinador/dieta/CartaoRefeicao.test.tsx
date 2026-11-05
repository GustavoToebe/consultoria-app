import type { ItemDieta, Refeicao } from '../../api/tipos';
import { CartaoRefeicao } from './CartaoRefeicao';

/**
 * Refeição aberta (04/11): "Observação" e "Modo de preparo" vazios ficam num link "+ Observação ou modo de preparo
 * (opcional)" e abrem no toque; com texto gravado, já abrem. A unidade do alimento é uma lista suspensa ("Unidade"), não
 * mais os chips. As peças com primitivos nativos viram falsas que só repassam rótulo e toque. Dados fictícios.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/portal', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../tema/TemaProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));
jest.mock('../../ui/Botao', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Botao: ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) => require('react').createElement(require('react-native').Pressable, { accessibilityLabel: rotulo, onPress: aoTocar }),
}));
const campoFalso = ({ rotulo }: { rotulo: string }) =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react').createElement(require('react-native').View, { accessibilityLabel: `campo ${rotulo}` });
jest.mock('../../ui/Campo', () => ({ Campo: campoFalso }));
jest.mock('../../ui/Campos', () => ({ CampoNumerico: campoFalso }));
jest.mock('../../ui/EscolhaSuspensa', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  EscolhaSuspensa: ({ rotulo, valor }: { rotulo: string; valor: string }) => require('react').createElement(require('react-native').View, { accessibilityLabel: `suspensa ${rotulo}: ${valor}` }),
}));
jest.mock('../../ui/Escolha', () => ({ Escolha: () => { throw new Error('a unidade não usa mais os chips'); } }));
jest.mock('../biblioteca/AbaAlimentos', () => ({ UNIDADES: [{ valor: 'g', rotulo: 'g' }, { valor: 'ml', rotulo: 'ml' }, { valor: 'un', rotulo: 'un' }] }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;

const EXTRAS = 'Observação ou modo de preparo (opcional)';

const item = (uid: string, nome: string): ItemDieta => ({ uid, alimentoId: null, nome, quantidade: 100, unidade: 'ml', kcal: 50, proteina: 1, carboidrato: 10, gordura: 0, manual: true });

function refeicao(extra: Partial<Refeicao> = {}): Refeicao {
  return {
    uid: 'r1', nome: 'Lanche fictício', horario: '15:00', observacao: null, modoDePreparo: null,
    opcoes: [{ uid: 'a', rotulo: 'A', itens: [item('i1', 'Suco fictício')] }, { uid: 'b', rotulo: 'B', itens: [item('i2', 'Leite fictício')] }],
    ...extra,
  };
}

function montar(r: Refeicao): Arvore {
  let arvore: Arvore | undefined;
  Renderer.act(() => {
    arvore = Renderer.create(
      <CartaoRefeicao refeicao={r} posicao={0} total={1} aberta comProblema={new Set()} alimentos={new Map()}
        aoMudar={() => undefined} aoMover={() => undefined} aoRemover={() => undefined} aoEscolherAlimento={() => undefined} />,
    );
  });
  return arvore as Arvore;
}
const comRotulo = (a: Arvore, rotulo: string) => a.root.findAll((n) => n.props.accessibilityLabel === rotulo && typeof n.type === 'string');
const temCampo = (a: Arvore, rotulo: string) => comRotulo(a, `campo ${rotulo}`).length > 0;
const botaoDosExtras = (a: Arvore) => a.root.findAll((n) => n.props.accessibilityLabel === EXTRAS && typeof n.props.onPress === 'function');

describe('CartaoRefeicao: observação e modo de preparo', () => {
  it('vazios ficam recolhidos no link, abaixo de Nome e Horário', () => {
    const a = montar(refeicao());
    expect(temCampo(a, 'Nome')).toBe(true);
    expect(temCampo(a, 'Horário')).toBe(true);
    expect(botaoDosExtras(a)).toHaveLength(1);
    expect(temCampo(a, 'Observação (opcional)')).toBe(false);
    expect(temCampo(a, 'Modo de preparo (opcional)')).toBe(false);
  });

  it('o toque no link abre os dois campos e o link some', () => {
    const a = montar(refeicao());
    Renderer.act(() => botaoDosExtras(a)[0].props.onPress());
    expect(temCampo(a, 'Observação (opcional)')).toBe(true);
    expect(temCampo(a, 'Modo de preparo (opcional)')).toBe(true);
    expect(botaoDosExtras(a)).toHaveLength(0);
  });

  it('com modo de preparo gravado, os campos já abrem', () => {
    const a = montar(refeicao({ modoDePreparo: 'Bata tudo no liquidificador.' }));
    expect(temCampo(a, 'Modo de preparo (opcional)')).toBe(true);
    expect(botaoDosExtras(a)).toHaveLength(0);
  });

  it('com só a observação gravada, os campos também abrem', () => {
    const a = montar(refeicao({ observacao: 'Pode trocar a fruta.' }));
    expect(temCampo(a, 'Observação (opcional)')).toBe(true);
    expect(temCampo(a, 'Modo de preparo (opcional)')).toBe(true);
  });
});

describe('CartaoRefeicao: unidade do alimento', () => {
  it('cada alimento tem a quantidade e a unidade atual numa escolha suspensa, nas duas opções', () => {
    const a = montar(refeicao());
    expect(comRotulo(a, 'campo Quantidade')).toHaveLength(2);
    expect(comRotulo(a, 'suspensa Unidade: ml')).toHaveLength(2);
  });
});
