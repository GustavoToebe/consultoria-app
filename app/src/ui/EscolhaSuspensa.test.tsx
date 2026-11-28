/* eslint-disable @typescript-eslint/no-require-imports */
import type { OpcaoSuspensa } from '../dominio/escolhaSuspensa';
import { EscolhaSuspensa } from './EscolhaSuspensa';

jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('./Campo', () => ({ Campo: () => null }));
jest.mock('./Folha', () => ({ Folha: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').View, null, children) }));
jest.mock('./Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const RN = require('react-native') as typeof import('react-native');

const AZUL = '#2563eb';
const OPCOES: OpcaoSuspensa<string>[] = [{ valor: 'WS', rotulo: 'WS', cor: AZUL }, { valor: 'AQ', rotulo: 'Aquecimento' }];

function montar(props: Partial<Parameters<typeof EscolhaSuspensa<string | null>>[0]> = {}) {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(<EscolhaSuspensa<string | null> rotulo="Tipo" valor="WS" opcoes={OPCOES} aoMudar={() => undefined} semBusca {...props} />);
  });
  const botao = () => raiz.root.find((x) => x.props.accessibilityRole === 'button' && typeof x.props.onPress === 'function');
  const bolinhas = () => raiz.root.findAll((x) => x.props.testID === 'bolinha-da-opcao' && typeof x.type === 'string');
  return { raiz, botao, bolinhas };
}

describe('EscolhaSuspensa', () => {
  it('sem rotuloAcessivel o nome do botão é o rótulo visível com o valor (como antes)', () => {
    expect(montar().botao().props.accessibilityLabel).toBe('Tipo: WS. Escolher.');
  });

  it('rotuloAcessivel troca só o nome acessível; o rótulo visível continua curto', () => {
    const { raiz, botao } = montar({ rotulo: 'RIR', rotuloAcessivel: 'Série 1 · RIR', valor: '2', opcoes: [{ valor: '2', rotulo: '2' }] });
    expect(botao().props.accessibilityLabel).toBe('Série 1 · RIR: 2. Escolher.');
    expect(raiz.root.findAllByType(RN.Text).some((t) => t.props.children === 'RIR')).toBe(true);
  });

  it('a bolinha da cor aparece no botão fechado quando a escolhida tem cor, e em cada opção com cor na lista', () => {
    const { botao, bolinhas } = montar();
    expect(bolinhas()).toHaveLength(1);
    expect(RN.StyleSheet.flatten(bolinhas()[0].props.style).backgroundColor).toBe(AZUL);
    Renderer.act(() => botao().props.onPress());
    // Botão + a opção WS; "Aquecimento" não tem cor.
    expect(bolinhas()).toHaveLength(2);
  });

  it('sem cor nenhuma não desenha bolinha', () => {
    const { botao, bolinhas } = montar({ valor: 'AQ', opcoes: [{ valor: 'AQ', rotulo: 'Aquecimento' }] });
    expect(bolinhas()).toHaveLength(0);
    Renderer.act(() => botao().props.onPress());
    expect(bolinhas()).toHaveLength(0);
  });

  it('o minHeight de quem chama vale sobre a altura padrão do botão', () => {
    const { botao } = montar({ style: { minHeight: 46 } });
    const estilo = RN.StyleSheet.flatten(botao().props.style({ pressed: false, hovered: false }));
    expect(estilo.minHeight).toBe(46);
  });

  it('desabilitado: não abre, diz o motivo e fica no cinza único (superficie3 + borda)', () => {
    const cores = require('../tema/tokens').ESCURO;
    const { botao, bolinhas } = montar({ desabilitado: true, motivo: 'Ligue os lembretes.' });
    expect(botao().props.disabled).toBe(true);
    expect(botao().props.accessibilityState).toMatchObject({ disabled: true });
    expect(botao().props.accessibilityHint).toBe('Ligue os lembretes.');
    const estilo = RN.StyleSheet.flatten(botao().props.style({ pressed: false, hovered: false }));
    expect(estilo).toMatchObject({ backgroundColor: cores.superficie3, borderColor: cores.borda });
    expect(bolinhas()).toHaveLength(1);
  });

  it('sem desabilitado, nada muda (sem dica e com o fundo do campo)', () => {
    const cores = require('../tema/tokens').ESCURO;
    const { botao } = montar();
    expect(botao().props.accessibilityHint).toBeUndefined();
    expect(RN.StyleSheet.flatten(botao().props.style({ pressed: false, hovered: false })).backgroundColor).toBe(cores.campo);
  });
});
