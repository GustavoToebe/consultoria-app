import { Text, View } from 'react-native';

import { LARGURA_MAXIMA } from '../../tema/tokens';
import { distanciaDoRodapeRegistrado, limparRegistroDoRodape, registrarPeDaCamada } from '../../ui/rodapeFixoDaPagina';
import { ComColunas, useDuasColunas, useTresColunas } from './ColunasDoEditor';
import { cabecalhoUnico, TelaDoEditor } from './TelaDoEditor';

let mockLarguraConteudo: 'AUTOMATICA' | 'LIMITADA' = 'AUTOMATICA';
let mockLarguraJanela = 1280;

jest.mock('react-native-safe-area-context', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SafeAreaView: ({ children, ...props }: { children: unknown }) => require('react').createElement(require('react-native').View, props, children),
}));

jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cores: require('../../tema/tokens').ESCURO,
    preferencias: { larguraConteudo: mockLarguraConteudo },
  }),
}));

jest.mock('../../ui/fundoDaArea', () => ({ useFundoDaArea: () => '#070707' }));
jest.mock('../../ui/RolagemComTopo', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RolagemComTopo: ({ children, contentContainerStyle }: { children: unknown; contentContainerStyle?: unknown }) => require('react').createElement(require('react-native').View, { testID: 'rolagem', style: contentContainerStyle }, children),
}));
jest.mock('../../ui/Vidro', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Vidro: ({ children }: { children: unknown }) => require('react').createElement(require('react-native').View, null, children),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RN = require('react-native');
jest.spyOn(RN, 'useWindowDimensions').mockImplementation(() => ({ width: mockLarguraJanela, height: 1080, scale: 1, fontScale: 1 }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Arvore = import('react-test-renderer').ReactTestRenderer;

function Sonda() {
  const duas = useDuasColunas();
  const tres = useTresColunas();
  return (
    <ComColunas>
      {(d, t) => <Text testID="sonda">{`${duas}:${tres}|${d}:${t}`}</Text>}
    </ComColunas>
  );
}

function montar(colunas = true, larguraMedida?: number, tresDesde?: 'larga' | 'ultralarga'): Arvore {
  let arvore: Arvore | undefined;
  Renderer.act(() => {
    arvore = Renderer.create(
      <TelaDoEditor colunas={colunas} cabecalho={<View />} barra={<View />} tresDesde={tresDesde}>
        <Sonda />
      </TelaDoEditor>,
    );
  });
  if (larguraMedida !== undefined) {
    const raiz = (arvore as Arvore).root.findAll((n) => typeof n.props.onLayout === 'function')[0];
    Renderer.act(() => {
      raiz.props.onLayout({ nativeEvent: { layout: { width: larguraMedida, height: 1080 } } });
    });
  }
  return arvore as Arvore;
}

describe('TelaDoEditor: duas e três colunas (ultralarga)', () => {
  beforeEach(() => {
    mockLarguraConteudo = 'AUTOMATICA';
    mockLarguraJanela = 1280;
  });

  it('em largura >= 2400 (ultralarga) com preferência AUTOMATICA ativa três colunas', () => {
    mockLarguraJanela = 2800;
    const a = montar(true, 2400);
    expect(a.root.findByProps({ testID: 'sonda' }).props.children).toBe('true:true|true:true');
  });

  it('em largura >= 2400 com preferência LIMITADA mantém duas colunas e limita a 1800 px', () => {
    mockLarguraConteudo = 'LIMITADA';
    mockLarguraJanela = 2800;
    const a = montar(true, 2500);
    expect(a.root.findByProps({ testID: 'sonda' }).props.children).toBe('true:false|true:false');
    const conteudo = a.root.findAll((n) => Array.isArray(n.props.style) && n.props.style.some((s: { maxWidth?: number } | null) => s?.maxWidth === LARGURA_MAXIMA));
    expect(conteudo.length).toBeGreaterThan(0);
  });

  it('em largura < 2400 (larga) mantém duas colunas mesmo com preferência AUTOMATICA', () => {
    mockLarguraJanela = 1920;
    const a = montar(true, 1680);
    expect(a.root.findByProps({ testID: 'sonda' }).props.children).toBe('true:false|true:false');
  });

  it('no celular, o rodapé fora da rolagem entra no registro do aviso (toast) e sai quando some', () => {
    limparRegistroDoRodape();
    registrarPeDaCamada(844);
    let arvore: Arvore | undefined;
    Renderer.act(() => {
      arvore = Renderer.create(
        <TelaDoEditor cabecalho={<View />} barra={<View />} rodape={<View />}><View /></TelaDoEditor>,
      );
    });
    const a = arvore as Arvore;
    // Só o rodapé é medido na janela: topo a 147 px do pé (64 do rodapé + 83 da barra de abas). A `View` simulada do jest
    // tem `measureInWindow` vazio; o rodapé é a única com `ref` e `onLayout` fora a raiz e a do `KeyboardAvoidingView`.
    const rodape = a.root.findAll((n) => typeof n.props.onLayout === 'function' && Array.isArray(n.props.style)
      && n.props.style.some((s: { borderTopWidth?: number } | null) => s?.borderTopWidth === 1) && n.instance !== null);
    expect(rodape.length).toBe(1);
    Renderer.act(() => {
      (rodape[0].instance as { measureInWindow: (cb: (x: number, y: number, l: number, h: number) => void) => void }).measureInWindow = (cb) => cb(0, 697, 390, 64);
      rodape[0].props.onLayout({ nativeEvent: { layout: { width: 390, height: 64 } } });
    });
    expect(distanciaDoRodapeRegistrado()).toBe(147);
    // O rodapé some com a tela ainda montada: sai do registro junto com a `View` dele.
    Renderer.act(() => a.update(<TelaDoEditor cabecalho={<View />} barra={<View />}><View /></TelaDoEditor>));
    expect(distanciaDoRodapeRegistrado()).toBeNull();
    Renderer.act(() => a.unmount());
    expect(distanciaDoRodapeRegistrado()).toBeNull();
  });

  it('sem a prop colunas, não ativa duas nem três colunas mesmo em ultralarga', () => {
    mockLarguraJanela = 2800;
    const a = montar(false, 2500);
    expect(a.root.findByProps({ testID: 'sonda' }).props.children).toBe('false:false|false:false');
  });
});

describe('TelaDoEditor: três colunas a partir da larga (treino)', () => {
  beforeEach(() => {
    mockLarguraConteudo = 'AUTOMATICA';
    mockLarguraJanela = 1920;
  });

  it('o padrão (dieta, mobilidade e questionário) segue com duas colunas na faixa larga', () => {
    const a = montar(true, 1680, 'ultralarga');
    expect(a.root.findByProps({ testID: 'sonda' }).props.children).toBe('true:false|true:false');
  });

  it("'larga' liga a terceira coluna a partir de 1600 px de conteúdo", () => {
    const a = montar(true, 1680, 'larga');
    expect(a.root.findByProps({ testID: 'sonda' }).props.children).toBe('true:true|true:true');
  });

  it("'larga' ignora a preferência LIMITADA (decisão de 27/11)", () => {
    mockLarguraConteudo = 'LIMITADA';
    const a = montar(true, 1680, 'larga');
    expect(a.root.findByProps({ testID: 'sonda' }).props.children).toBe('true:true|true:true');
  });

  it("'larga' abaixo de 1600 px fica em duas colunas", () => {
    mockLarguraJanela = 1440;
    const a = montar(true, 1200, 'larga');
    expect(a.root.findByProps({ testID: 'sonda' }).props.children).toBe('true:false|true:false');
  });
});

describe('cabecalhoUnico', () => {
  it('só na web e a partir de 768 px', () => {
    expect(cabecalhoUnico(768, true)).toBe(true);
    expect(cabecalhoUnico(1920, true)).toBe(true);
    expect(cabecalhoUnico(767, true)).toBe(false);
    expect(cabecalhoUnico(390, true)).toBe(false);
    expect(cabecalhoUnico(1920, false)).toBe(false);
  });

  it('no nativo, cabecalhoGrudado não muda nada: o cabeçalho rola e a barra fica fora da rolagem', () => {
    let arvore: Arvore | undefined;
    Renderer.act(() => {
      arvore = Renderer.create(<TelaDoEditor cabecalhoGrudado cabecalho={<Text testID="cabecalho" />} barra={<Text testID="barra" />}><View /></TelaDoEditor>);
    });
    const a = arvore as Arvore;
    expect(a.root.findAllByProps({ testID: 'cabecalho' }).filter((n) => typeof n.type !== 'string')).toHaveLength(1);
    expect(a.root.findAllByProps({ testID: 'barra' }).filter((n) => typeof n.type !== 'string')).toHaveLength(1);
  });
});
