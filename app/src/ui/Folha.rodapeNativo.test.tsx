/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform, Pressable, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AvisoProvider, useAviso } from './Aviso';
import { Folha } from './Folha';
import { portalDaFolhaDoTopo } from './historicoDasFolhas';
import { distanciaDoRodapeDaFolha, limparRegistroDoRodape } from './rodapeFixoDaPagina';
import { espaco } from '../tema/tokens';

/**
 * Celular nativo: a Folha com rodapé registra o topo dele (medido dentro do `Modal`, contra o pé do portal) e o toast sobe
 * `rodape + 8 px` acima, sem cobrir as ações. Fechada, a Folha sai do registro.
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/portal', () => ({ PortalHost: () => null, Portal: ({ children }: { children: unknown }) => children }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }) }));
jest.mock('./useMovimentoReduzido', () => ({ useMovimentoReduzido: () => false }));
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native') as typeof import('react-native');
  const gesto: object = new Proxy(() => gesto, { get: () => () => gesto });
  return { GestureHandlerRootView: View, GestureDetector: ({ children }: { children?: unknown }) => children, Gesture: { Pan: () => gesto } };
});
jest.mock('./Texto', () => ({ Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children) }));
jest.mock('./IconeBotao', () => ({ IconeBotao: () => null }));
jest.mock('./RolagemComTopo', () => ({ RolagemComTopo: () => null }));
jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, variante: 'escuro', bordas: { bloco: 2, item: 2 }, marca: '#E11D48', sobreMarca: '#FFFFFF', fatorTexto: 1, preferencias: { animacoes: false } }),
}));

type Medida = (cb: (x: number, y: number, largura: number, altura: number) => void) => void;
type Medidor = { measureInWindow: Medida };

/** O `Modal` do Android tem origem própria: o host do portal vai de 30 a 874 e o rodapé da folha tem o topo em 774. */
const HOST = { y: 30, altura: 844 };
const RODAPE = { y: 774, altura: 100 };
const DISTANCIA = HOST.y + HOST.altura - RODAPE.y; // 100 px do topo do rodapé ao pé do portal

let arvore: ReactTestRenderer | undefined;

function Avisar() {
  const { avisar } = useAviso();
  return <Pressable testID="avisar" onPress={() => avisar('Salvo.', 'sucesso')}><Text>Avisar</Text></Pressable>;
}

function Tela({ visivel, rodape = <Text>Salvar</Text> }: { visivel: boolean; rodape?: React.ReactNode }) {
  return (
    <AvisoProvider>
      <Avisar />
      <Folha visivel={visivel} titulo="T" aoFechar={() => undefined} rodape={rodape}>{null}</Folha>
    </AvisoProvider>
  );
}

/** Nós da Folha que se medem: o rodapé (marcado por `dataSet`) e o host do portal (`box-none`, preenche a janela). */
function medidores(a: ReactTestRenderer) {
  const nos = a.root.findAll((n) => typeof n.props.onLayout === 'function' && typeof (n.instance as Partial<Medidor> | null)?.measureInWindow === 'function');
  const rodape = nos.find((n) => n.props.dataSet?.rodapeDaFolha === 'sim');
  const host = nos.find((n) => n.props.pointerEvents === 'box-none' && !n.props.dataSet);
  if (!rodape || !host) throw new Error('rodapé ou host do portal não encontrados');
  return { rodape, host };
}

/** O layout chega: cada nó responde com a sua medida na janela do `Modal` e dispara o `onLayout`. */
function layout(a: ReactTestRenderer, quando: (n: ReturnType<typeof medidores>) => void = () => undefined) {
  const { rodape, host } = medidores(a);
  (rodape.instance as Medidor).measureInWindow = (cb) => cb(0, RODAPE.y, 390, RODAPE.altura);
  (host.instance as Medidor).measureInWindow = (cb) => cb(0, HOST.y, 390, HOST.altura);
  quando({ rodape, host });
  act(() => { rodape.props.onLayout({ nativeEvent: { layout: {} } }); });
}

function baseDoCartao(a: ReactTestRenderer): number {
  const camada = a.root.findAll((n) => typeof n.type === 'string' && Array.isArray(n.props.style) && n.props.style.some((s: { bottom?: number } | null) => typeof s?.bottom === 'number'));
  return (camada[0].props.style.find((s: { bottom?: number } | null) => typeof s?.bottom === 'number') as { bottom: number }).bottom;
}

async function montar(so: 'android' | 'ios', visivel = true, rodape?: React.ReactNode) {
  jest.replaceProperty(Platform, 'OS', so);
  await act(async () => { arvore = create(<Tela visivel={visivel} rodape={rodape} />); });
  return arvore as ReactTestRenderer;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  limparRegistroDoRodape();
});

afterEach(() => {
  act(() => { arvore?.unmount(); });
  arvore = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe.each(['android', 'ios'] as const)('Folha com rodapé no celular (%s)', (so) => {
  it('o toast sobe 8 px acima do topo do rodapé da folha, medido contra o pé do portal', async () => {
    const a = await montar(so);
    const nome = portalDaFolhaDoTopo()?.nome as string;
    expect(distanciaDoRodapeDaFolha(nome)).toBeNull(); // antes do layout não há medida
    layout(a);
    expect(distanciaDoRodapeDaFolha(nome)).toBe(DISTANCIA);
    act(() => { a.root.findByProps({ testID: 'avisar' }).props.onPress(); });
    expect(baseDoCartao(a)).toBe(DISTANCIA + espaco(1));
  });

  it('antes da medida o toast fica no padrão da folha (área segura + 80), sem tapar nada que ainda não se conhece', async () => {
    const a = await montar(so);
    act(() => { a.root.findByProps({ testID: 'avisar' }).props.onPress(); });
    expect(baseDoCartao(a)).toBe(24 + espaco(10));
  });

  it('fechar a folha tira do registro; a medida que chega depois do desmonte é descartada', async () => {
    const a = await montar(so);
    const nome = portalDaFolhaDoTopo()?.nome as string;
    const atrasadas: (() => void)[] = [];
    layout(a);
    expect(distanciaDoRodapeDaFolha(nome)).toBe(DISTANCIA);
    // Uma medida em voo: o rodapé responde, mas a do host só chega depois de a folha fechar.
    layout(a, ({ host }) => { (host.instance as Medidor).measureInWindow = (cb) => { atrasadas.push(() => cb(0, HOST.y, 390, HOST.altura)); }; });
    await act(async () => { a.update(<Tela visivel={false} />); });
    expect(distanciaDoRodapeDaFolha(nome)).toBeNull();
    act(() => { for (const chegou of atrasadas) chegou(); });
    expect(distanciaDoRodapeDaFolha(nome)).toBeNull();
    expect(portalDaFolhaDoTopo()).toBeUndefined();
  });

  it('o rodapé que some (sem ações nem status) sai do registro e o toast volta ao padrão', async () => {
    const a = await montar(so);
    const nome = portalDaFolhaDoTopo()?.nome as string;
    layout(a);
    expect(distanciaDoRodapeDaFolha(nome)).toBe(DISTANCIA);
    await act(async () => { a.update(<Tela visivel rodape={null} />); });
    expect(distanciaDoRodapeDaFolha(nome)).toBeNull();
    act(() => { a.root.findByProps({ testID: 'avisar' }).props.onPress(); });
    expect(baseDoCartao(a)).toBe(24 + espaco(10));
  });

  it('o teclado empurra o painel: o layout seguinte atualiza a distância', async () => {
    const a = await montar(so);
    const nome = portalDaFolhaDoTopo()?.nome as string;
    layout(a);
    const { rodape } = medidores(a);
    (rodape.instance as Medidor).measureInWindow = (cb) => cb(0, RODAPE.y - 300, 390, RODAPE.altura);
    act(() => { rodape.props.onLayout({ nativeEvent: { layout: {} } }); });
    expect(distanciaDoRodapeDaFolha(nome)).toBe(DISTANCIA + 300);
  });
});
