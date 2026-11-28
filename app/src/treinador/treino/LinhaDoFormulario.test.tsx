/* eslint-disable @typescript-eslint/no-require-imports */
import { StyleSheet, type ViewStyle } from 'react-native';

import { ALTURA_DO_CONTROLE, CampoDaSerie, deveEmpilhar, LARGURA_DO_NOME_DA_LINHA, LinhaDoFormulario } from './LinhaDoFormulario';

// O tamanho do texto muda por teste (o `mock` no nome deixa o jest ler a variável dentro da fábrica).
let mockFatorTexto = 1;
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, fatorTexto: mockFatorTexto }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@rn-primitives/switch', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../ui/Calendario', () => ({ BotaoCalendario: () => null, Calendario: () => null }));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const RN = require('react-native') as typeof import('react-native');

type Raiz = import('react-test-renderer').ReactTestRenderer;
const textos = (raiz: Raiz) => raiz.root.findAll((x) => typeof x.type === 'string' && typeof x.props.children === 'string').map((x) => x.props.children as string);

function montarLinha(props: Partial<Parameters<typeof LinhaDoFormulario>[0]> = {}) {
  let raiz!: Raiz;
  Renderer.act(() => {
    raiz = Renderer.create(
      <LinhaDoFormulario nome="Repetições" {...props}>
        <RN.Text>controle</RN.Text>
      </LinhaDoFormulario>,
    );
  });
  const linha = () => raiz.root.find((x) => x.props.role === 'group' && typeof x.props.onLayout === 'function');
  const estilo = () => StyleSheet.flatten(linha().props.style) as ViewStyle;
  const medir = (width: number) => Renderer.act(() => linha().props.onLayout({ nativeEvent: { layout: { width, height: 70, x: 0, y: 0 } } }));
  return { raiz, linha, estilo, medir };
}

describe('deveEmpilhar', () => {
  it('empilha abaixo de 520 px medidos na linha', () => {
    expect(deveEmpilhar(519, 1920)).toBe(true);
    expect(deveEmpilhar(520, 390)).toBe(false);
    expect(deveEmpilhar(900, 390)).toBe(false);
  });

  it('sem medida ainda, vale a largura da janela (celular nasce empilhado)', () => {
    expect(deveEmpilhar(0, 390)).toBe(true);
    expect(deveEmpilhar(0, 1280)).toBe(false);
  });
});

describe('LinhaDoFormulario', () => {
  it('mostra o nome, os controles, o ⓘ e a dica, num grupo nomeado', () => {
    const { raiz, linha } = montarLinha({ info: <RN.Text>info</RN.Text>, dica: 'Sem repetições: o aluno lê a série por tempo' });
    expect(textos(raiz)).toEqual(['Repetições', 'controle', 'info', 'Sem repetições: o aluno lê a série por tempo']);
    // Nomeado pelo texto visível (`aria-labelledby`), sem `accessibilityLabel`: o leitor de tela não lê o nome duas vezes.
    expect(linha().props.accessibilityLabel).toBeUndefined();
    const nome = raiz.root.find((x) => x.props.nativeID === linha().props['aria-labelledby']);
    expect(nome.props.children).toBe('Repetições');
    expect(linha().props['aria-describedby']).toBeDefined();
  });

  it('aceita a dica como componente e some sem dica', () => {
    const comNo = montarLinha({ dica: <RN.Text>≈ 45 a 54 kg</RN.Text> });
    expect(textos(comNo.raiz)).toContain('≈ 45 a 54 kg');
    const sem = montarLinha();
    expect(textos(sem.raiz)).toEqual(['Repetições', 'controle']);
    expect(sem.linha().props['aria-describedby']).toBeUndefined();
  });

  it('lado a lado na largura do PC (nome na coluna de 124) e empilhada quando a linha é estreita', () => {
    const { raiz, estilo, medir } = montarLinha();
    medir(900);
    expect(estilo().flexDirection).toBe('row');
    const nome = raiz.root.findAll((x) => x.type === RN.View && StyleSheet.flatten(x.props.style)?.width === LARGURA_DO_NOME_DA_LINHA);
    expect(nome).toHaveLength(1);
    medir(400);
    expect(estilo().flexDirection).toBeUndefined();
  });

  it('tem a divisória embaixo, menos na última linha', () => {
    expect(montarLinha().estilo().borderBottomWidth).toBe(1);
    expect(montarLinha({ ultima: true }).estilo().borderBottomWidth).toBeUndefined();
  });
});

describe('CampoDaSerie', () => {
  function montarCampo(aoMudar: (v: number | null) => void, unidade?: string) {
    let raiz!: Raiz;
    Renderer.act(() => {
      raiz = Renderer.create(<CampoDaSerie rotulo="Série 1 · Reps mín." valor={10} aoMudar={aoMudar} inteiro unidade={unidade} />);
    });
    const campo = () => raiz.root.findByType(RN.TextInput);
    return { raiz, campo };
  }

  it('mostra a unidade ao lado e o valor no campo, com o nome para o leitor de tela', () => {
    const { raiz, campo } = montarCampo(() => undefined, 'reps');
    expect(textos(raiz)).toContain('reps');
    expect(campo().props.value).toBe('10');
    expect(campo().props.accessibilityLabel).toBe('Série 1 · Reps mín.');
    const estilo = StyleSheet.flatten(campo().props.style) as { height?: number; textAlign?: string };
    expect(estilo.height).toBe(ALTURA_DO_CONTROLE);
    expect(estilo.textAlign).toBe('center');
  });

  it('a altura cresce com o texto, como a largura; no tamanho normal continua 46', () => {
    const altura = () => (StyleSheet.flatten(montarCampo(() => undefined).campo().props.style) as { height?: number }).height;
    expect(altura()).toBe(ALTURA_DO_CONTROLE);
    mockFatorTexto = 1.5;
    try {
      expect(altura()).toBe(69);
    } finally {
      mockFatorTexto = 1;
    }
  });

  it('repassa o número digitado e não repassa texto que não é número', () => {
    const aoMudar = jest.fn();
    const { campo } = montarCampo(aoMudar);
    Renderer.act(() => campo().props.onChangeText('12'));
    expect(aoMudar).toHaveBeenLastCalledWith(12);
    Renderer.act(() => campo().props.onChangeText('1,5'));
    expect(aoMudar).toHaveBeenCalledTimes(1);
  });

  it('sem unidade não sobra texto ao lado', () => {
    const { raiz } = montarCampo(() => undefined);
    expect(textos(raiz)).toEqual([]);
  });
});

