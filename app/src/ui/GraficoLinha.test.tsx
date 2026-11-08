/* eslint-disable @typescript-eslint/no-require-imports */
import { GraficoLinha, type PontoGrafico } from './GraficoLinha';

jest.mock('../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('./Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const React = require('react') as typeof import('react');

const PONTOS_DE_TESTE: PontoGrafico[] = [
  { rotulo: '10/10', valor: 80.5, data: '2026-10-10' },
  { rotulo: '15/10', valor: 95.0, data: '2026-10-15' }, // Ponto alto (topo)
  { rotulo: '20/10', valor: 78.2, data: '2026-10-20' }, // Ponto direito
];

function montar(pontos = PONTOS_DE_TESTE, largura = 500) {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  Renderer.act(() => {
    raiz = Renderer.create(
      <GraficoLinha
        pontos={pontos}
        unidade="kg"
        descricao="Gráfico de teste de peso"
        larguraInicial={largura}
      />,
    );
  });
  return raiz;
}

function obterBotoes(raiz: import('react-test-renderer').ReactTestRenderer) {
  return raiz.root.findAll((x) => typeof x.props.onHoverIn === 'function' && typeof x.props.onPress === 'function');
}

function obterDica(raiz: import('react-test-renderer').ReactTestRenderer) {
  const dicas = raiz.root.findAll((x) => x.props.accessibilityRole === 'summary');
  return dicas[0] ?? null;
}

describe('GraficoLinha', () => {
  it('renderiza os pontos interativos com área de toque e rótulo acessível', () => {
    const raiz = montar();
    const botoes = obterBotoes(raiz);
    expect(botoes).toHaveLength(3);
    expect(botoes[0].props.accessibilityLabel).toBe('10/10: 80,5 kg');
    expect(botoes[1].props.accessibilityLabel).toBe('15/10: 95 kg');
    expect(botoes[2].props.accessibilityLabel).toBe('20/10: 78,2 kg');
  });

  it('exibe balão com data e peso ao passar o mouse (onHoverIn) e esconde ao sair (onHoverOut)', () => {
    const raiz = montar();
    const botoes = obterBotoes(raiz);

    // Inicialmente sem dica aberta
    expect(obterDica(raiz)).toBeNull();

    // Passar o mouse sobre o primeiro ponto
    Renderer.act(() => {
      botoes[0].props.onHoverIn();
    });

    const dica = obterDica(raiz);
    expect(dica).toBeTruthy();
    expect(dica.props.children.props.children).toBe('10/10 · 80,5 kg');

    // Tirar o mouse
    Renderer.act(() => {
      botoes[0].props.onHoverOut();
    });
    expect(obterDica(raiz)).toBeNull();
  });

  it('permite alternar exibição ao tocar/clicar no ponto (onPress)', () => {
    const raiz = montar();
    const botoes = obterBotoes(raiz);

    // Tocar no ponto 2
    Renderer.act(() => {
      botoes[2].props.onPress();
    });

    let dica = obterDica(raiz);
    expect(dica).toBeTruthy();
    expect(dica.props.children.props.children).toBe('20/10 · 78,2 kg');

    // Tocar novamente no mesmo ponto para desmarcar
    Renderer.act(() => {
      botoes[2].props.onPress();
    });
    dica = obterDica(raiz);
    expect(dica).toBeNull();
  });

  it('exibe o balão no foco do teclado (onFocus) e esconde no blur (onBlur)', () => {
    const raiz = montar();
    const botoes = obterBotoes(raiz);

    Renderer.act(() => {
      botoes[1].props.onFocus();
    });
    const dica = obterDica(raiz);
    expect(dica).toBeTruthy();
    expect(dica.props.children.props.children).toBe('15/10 · 95 kg');

    Renderer.act(() => {
      botoes[1].props.onBlur();
    });
    expect(obterDica(raiz)).toBeNull();
  });

  it('mede largura via onLayout quando não há largura inicial', () => {
    let raiz!: import('react-test-renderer').ReactTestRenderer;
    Renderer.act(() => {
      raiz = Renderer.create(
        <GraficoLinha
          pontos={PONTOS_DE_TESTE}
          unidade="kg"
          descricao="Gráfico de teste de peso"
        />,
      );
    });

    // Antes da medição, não renderizou os botões
    expect(obterBotoes(raiz)).toHaveLength(0);

    // Simula evento onLayout
    const viewComLayout = raiz.root.find((x) => typeof x.props.onLayout === 'function');
    Renderer.act(() => {
      viewComLayout.props.onLayout({ nativeEvent: { layout: { width: 480, height: 240 } } });
    });

    expect(obterBotoes(raiz)).toHaveLength(3);
  });

  it('não corta o balão no topo quando o ponto for o mais alto (inverte para baixo)', () => {
    const raiz = montar();
    const botoes = obterBotoes(raiz);

    // Ponto 1 é o valor máximo (95 kg, no topo do gráfico)
    Renderer.act(() => {
      botoes[1].props.onHoverIn();
    });

    const dica = obterDica(raiz);
    const estiloDica = [dica.props.style].flat(Infinity);
    const top = estiloDica.find((s: Record<string, unknown>) => s && s.top !== undefined)?.top;

    // Deve estar posicionado abaixo do ponto (top positivo e seguro)
    expect(top).toBeGreaterThanOrEqual(4);
  });

  it('não corta o balão nas bordas esquerda e direita', () => {
    const largura = 400;
    const raiz = montar(PONTOS_DE_TESTE, largura);
    const botoes = obterBotoes(raiz);

    // Ponto 0 (extrema esquerda)
    Renderer.act(() => {
      botoes[0].props.onHoverIn();
    });
    let dica = obterDica(raiz);
    let left = [dica.props.style].flat(Infinity).find((s: Record<string, unknown>) => s && s.left !== undefined)?.left;
    expect(left).toBeGreaterThanOrEqual(4);

    // Ponto 2 (extrema direita)
    Renderer.act(() => {
      botoes[2].props.onHoverIn();
    });
    dica = obterDica(raiz);
    left = [dica.props.style].flat(Infinity).find((s: Record<string, unknown>) => s && s.left !== undefined)?.left;
    expect(left).toBeGreaterThanOrEqual(4);
    // left + largura da dica (120) não pode exceder largura - 4
    expect(left + 120).toBeLessThanOrEqual(largura);
  });
});
