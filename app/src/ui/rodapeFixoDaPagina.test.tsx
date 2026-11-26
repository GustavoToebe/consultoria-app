import { Pressable, Text, View } from 'react-native';

import { espaco } from '../tema/tokens';
import { AvisoProvider, useAviso } from './Aviso';
import { baseDoAviso, distanciaDoRodapeRegistrado, limparRegistroDoRodape, registrarPeDaCamada, useRegistroDoRodapeFixo } from './rodapeFixoDaPagina';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../tema/TemaProvider', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, variante: 'escuro', fatorTexto: 1 }),
}));
jest.mock('./Texto', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/portal', () => ({ Portal: ({ children }: { children: unknown }) => children }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;

/** Janela de 844 px (iPhone): a camada do aviso vai até o pé; o rodapé da importação tem o topo em `topoDoRodape`. */
const PE_DA_JANELA = 844;
let topoDoRodape = 700;
let alturaDoRodape = 64;

type Medida = (cb: (x: number, y: number, largura: number, altura: number) => void) => void;

/**
 * O layout chega: a `View` simulada do jest tem `measureInWindow` vazio, então cada uma medida ganha a dela (a camada do
 * aviso ocupa a janela toda; o resto é o rodapé) antes do `onLayout`.
 */
function medirTudo(a: Arvore) {
  const nos = a.root.findAll((n) => typeof n.props.onLayout === 'function' && typeof (n.instance as { measureInWindow?: unknown } | null)?.measureInWindow === 'function');
  Renderer.act(() => {
    for (const n of nos) {
      const camada = n.props.pointerEvents === 'none';
      (n.instance as { measureInWindow: Medida }).measureInWindow = (cb) => (camada ? cb(0, 0, 390, PE_DA_JANELA) : cb(0, topoDoRodape, 390, alturaDoRodape));
      n.props.onLayout({ nativeEvent: { layout: {} } });
    }
  });
}

function Rodape() {
  const { ref, onLayout } = useRegistroDoRodapeFixo();
  return <View testID="rodape" ref={ref} onLayout={onLayout} />;
}

function Avisar({ tipo }: { tipo: 'perigo' | 'sucesso' }) {
  const { avisar } = useAviso();
  return <Pressable testID="avisar" onPress={() => avisar('Não foi possível validar a planilha.', tipo)}><Text>Avisar</Text></Pressable>;
}

function montar(comRodape: boolean, tipo: 'perigo' | 'sucesso' = 'perigo'): Arvore {
  let arvore: Arvore | undefined;
  Renderer.act(() => {
    arvore = Renderer.create(
      <AvisoProvider>
        <Avisar tipo={tipo} />
        {comRodape ? <Rodape /> : null}
      </AvisoProvider>,
    );
  });
  const a = arvore as Arvore;
  montadas.push(a);
  medirTudo(a);
  return a;
}

function baseDoCartao(a: Arvore): number {
  const camada = a.root.findAll((n) => typeof n.type === 'string' && Array.isArray(n.props.style) && n.props.style.some((s: { bottom?: number } | null) => typeof s?.bottom === 'number'));
  const estilo = camada[0].props.style.find((s: { bottom?: number } | null) => typeof s?.bottom === 'number') as { bottom: number };
  return estilo.bottom;
}

/** Desmontadas no fim de cada teste: o aviso visível confere a folha do topo num `setInterval` e o de sucesso some num `setTimeout`. */
const montadas: Arvore[] = [];
afterEach(() => {
  Renderer.act(() => {
    for (const a of montadas.splice(0)) a.unmount();
  });
  jest.useRealTimers();
});

beforeEach(() => {
  jest.useFakeTimers();
  limparRegistroDoRodape();
  topoDoRodape = 700;
  alturaDoRodape = 64;
});

describe('baseDoAviso: a regra da posição', () => {
  const margem = 34;
  const padrao = margem + espaco(10);

  it('sem rodapé que atrapalhe, fica no padrão (área segura + 80)', () => {
    expect(baseDoAviso(margem, null, false)).toBe(padrao);
    expect(baseDoAviso(margem, null, true)).toBe(padrao);
  });

  it('na Folha com rodapé, logo acima do rodapé dela (8 px), mesmo abaixo do padrão', () => {
    expect(baseDoAviso(margem, 72, true)).toBe(72 + espaco(1));
    expect(baseDoAviso(margem, 200, true)).toBe(200 + espaco(1));
  });

  it('na página, o rodapé fixo só sobe o aviso, nunca o desce abaixo do padrão', () => {
    expect(baseDoAviso(margem, 40, false)).toBe(padrao);
    expect(baseDoAviso(margem, 180, false)).toBe(180 + espaco(1));
  });
});

describe('registro do rodapé fixo (celular)', () => {
  it('sem o pé da camada ou sem rodapé, não há distância', () => {
    expect(distanciaDoRodapeRegistrado()).toBeNull();
    registrarPeDaCamada(PE_DA_JANELA);
    expect(distanciaDoRodapeRegistrado()).toBeNull();
  });

  it('a distância é do topo do rodapé ao pé da camada, não a altura dele (a barra de abas fica embaixo)', () => {
    // Rodapé de 64 px acima da barra de abas de 83 px: o topo fica a 147 px do pé.
    topoDoRodape = PE_DA_JANELA - 83 - 64;
    const a = montar(true);
    expect(distanciaDoRodapeRegistrado()).toBe(147);
    montadas.splice(montadas.indexOf(a), 1);
    Renderer.act(() => a.unmount());
    expect(distanciaDoRodapeRegistrado()).toBeNull();
  });

  it('rodapé sem altura (escondido) sai do registro', () => {
    alturaDoRodape = 0;
    montar(true);
    expect(distanciaDoRodapeRegistrado()).toBeNull();
  });
});

describe('AvisoProvider no celular', () => {
  it('sem rodapé fixo, o aviso fica no padrão: área segura + 80', () => {
    const a = montar(false);
    Renderer.act(() => a.root.findByProps({ testID: 'avisar' }).props.onPress());
    expect(baseDoCartao(a)).toBe(34 + espaco(10));
  });

  it('com o rodapé da importação, o aviso de erro sobe acima dele e mantém o Fechar', () => {
    topoDoRodape = PE_DA_JANELA - 83 - 64;
    const a = montar(true);
    Renderer.act(() => a.root.findByProps({ testID: 'avisar' }).props.onPress());
    expect(baseDoCartao(a)).toBe(147 + espaco(1));
    expect(a.root.findAll((n) => n.props.accessibilityLabel === 'Fechar aviso' && typeof n.props.onPress === 'function').length).toBeGreaterThan(0);
  });

  it('rodapé baixo (sem barra de abas) não desce o aviso abaixo do padrão', () => {
    topoDoRodape = PE_DA_JANELA - 64;
    const a = montar(true, 'sucesso');
    Renderer.act(() => a.root.findByProps({ testID: 'avisar' }).props.onPress());
    expect(baseDoCartao(a)).toBe(34 + espaco(10));
  });

  it('a peça de medida não aparece para o leitor de tela nem recebe toque', () => {
    const a = montar(false);
    const medida = a.root.findAll((n) => typeof n.type === 'string' && n.props.pointerEvents === 'none');
    expect(medida.length).toBe(1);
    expect(medida[0].props.accessibilityElementsHidden).toBe(true);
    expect(medida[0].props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
