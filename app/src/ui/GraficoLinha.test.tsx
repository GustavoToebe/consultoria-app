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
  it('sem `cor`, a série fica na cor do texto; com ela, só curva, área e pontos mudam (eixo e datas seguem suaves)', () => {
    const { ESCURO } = require('../tema/tokens') as typeof import('../tema/tokens');
    const corDaSerie = (raiz: import('react-test-renderer').ReactTestRenderer) => ({
      curva: raiz.root.findAll((x) => x.props.strokeWidth === 2.5 && typeof x.props.d === 'string').map((x) => x.props.stroke)[0],
      area: raiz.root.findAll((x) => x.props.fillOpacity === 0.08).map((x) => x.props.fill)[0],
      pontos: [...new Set(raiz.root.findAll((x) => x.props.r === 4 && typeof x.props.fill === 'string').map((x) => x.props.fill))],
      rotulos: [...new Set(raiz.root.findAll((x) => x.props.textAnchor === 'middle' && x.props.fontSize).map((x) => x.props.fill))],
    });
    expect(corDaSerie(montar())).toEqual({ curva: ESCURO.texto, area: ESCURO.texto, pontos: [ESCURO.texto], rotulos: [ESCURO.textoSuave] });

    let raiz!: import('react-test-renderer').ReactTestRenderer;
    Renderer.act(() => {
      raiz = Renderer.create(
        <GraficoLinha pontos={PONTOS_DE_TESTE} unidade="kg" descricao="Gráfico de teste de peso" cor="#123456" larguraInicial={500} />,
      );
    });
    expect(corDaSerie(raiz)).toEqual({ curva: '#123456', area: '#123456', pontos: ['#123456'], rotulos: [ESCURO.textoSuave] });
    expect(obterBotoes(raiz)).toHaveLength(3);
  });

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

type Raiz = import('react-test-renderer').ReactTestRenderer;
type Props = Parameters<typeof GraficoLinha>[0];

function montarCom(extra: Partial<Props>, pontos = PONTOS_DE_TESTE) {
  let raiz!: Raiz;
  Renderer.act(() => {
    raiz = Renderer.create(<GraficoLinha pontos={pontos} unidade="kg" descricao="Gráfico de teste" larguraInicial={500} {...extra} />);
  });
  return raiz;
}

const Svg = require('react-native-svg') as typeof import('react-native-svg');
const caminhos = (raiz: Raiz) => raiz.root.findAllByType(Svg.Path);
const linhas = (raiz: Raiz) => caminhos(raiz).filter((x) => x.props.fill === 'none');
const areas = (raiz: Raiz) => caminhos(raiz).filter((x) => x.props.fillOpacity === 0.08);
const rotulosDoEixo = (raiz: Raiz) =>
  raiz.root.findAll((x) => x.props.textAnchor === 'end' && x.props.fontSize).map((x) => [x.props.children].flat()[0] as string);
const temTexto = (raiz: Raiz, texto: string) => raiz.root.findAll((x) => x.props.children === texto).length > 0;
const regiaoViva = (raiz: Raiz) => raiz.root.find((x) => x.props.accessibilityLiveRegion === 'polite' && typeof x.type !== 'string');
const linhasDaDica = (raiz: Raiz) => {
  const filhos = obterDica(raiz)?.props.children;
  return [filhos].flat().map((t: { props: { children: string } }) => t.props.children);
};

describe('GraficoLinha: opções do guia (todas opcionais)', () => {
  it('sem as props novas o desenho é o de sempre: curva suave, área, uma série, marcas redondas e sem legenda', () => {
    const { marcasDoEixo } = require('../dominio/grafico') as typeof import('../dominio/grafico');
    const raiz = montar();
    expect(linhas(raiz)).toHaveLength(1);
    expect(linhas(raiz)[0].props.d).toMatch(/C/);
    expect(linhas(raiz)[0].props.strokeDasharray).toBeUndefined();
    expect(areas(raiz)).toHaveLength(1);
    expect(obterBotoes(raiz)).toHaveLength(3);
    const folga = (95 - 78.2) * 0.15;
    expect(rotulosDoEixo(raiz)).toEqual(marcasDoEixo(78.2 - folga, 95 + folga).map((m) => String(m).replace('.', ',')));
    expect(temTexto(raiz, 'Direito')).toBe(false);
    expect(regiaoViva(raiz).props.children).toBe('');
  });

  it('segmentos retos ligam os pontos sem curva', () => {
    const d = linhas(montarCom({ segmentos: 'retos' }))[0].props.d as string;
    expect(d).not.toMatch(/C/);
    expect(d.match(/L/g)).toHaveLength(2);
  });

  it('semArea tira o preenchimento e deixa a linha', () => {
    const raiz = montarCom({ semArea: true });
    expect(areas(raiz)).toHaveLength(0);
    expect(linhas(raiz)).toHaveLength(1);
  });

  it('segunda série tracejada, no mesmo eixo de datas, com pontos reais e legenda em texto', () => {
    // Esquerdo sem a medida de 15/10: a data fica fora da série, sem ponto e sem valor inventado.
    const esquerdo: PontoGrafico[] = [
      { rotulo: '10/10', valor: 30, data: '2026-10-10' },
      { rotulo: '20/10', valor: 31, data: '2026-10-20' },
    ];
    const raiz = montarCom({ segmentos: 'retos', rotuloA: 'Direito', serieB: { pontos: esquerdo, cor: '#654321', rotulo: 'Esquerdo' } });
    const [a, b] = linhas(raiz);
    expect(a.props.strokeDasharray).toBeUndefined();
    expect(b.props.strokeDasharray).toBe('6 4');
    expect(b.props.stroke).toBe('#654321');
    expect((b.props.d as string).match(/L/g)).toHaveLength(1);
    expect(temTexto(raiz, 'Direito')).toBe(true);
    expect(temTexto(raiz, 'Esquerdo')).toBe(true);

    const botoes = obterBotoes(raiz);
    expect(botoes).toHaveLength(5);
    const rotulos = botoes.map((x) => x.props.accessibilityLabel);
    expect(rotulos).toContain('Esquerdo, 20/10: 31 kg');
    expect(rotulos).toContain('Direito, 15/10: 95 kg');
    // Mesmo X para a mesma data nas duas séries (a escala cobre 30 a 95 kg).
    const left = (rotulo: string) => [botoes.find((x) => x.props.accessibilityLabel === rotulo)!.props.style].flat()[0].left;
    expect(left('Esquerdo, 20/10: 31 kg')).toBe(left('Direito, 20/10: 78,2 kg'));
    expect(left('Esquerdo, 10/10: 30 kg')).toBe(left('Direito, 10/10: 80,5 kg'));

    // Sem texto da tela, a dica diz de qual série é.
    Renderer.act(() => botoes.find((x) => x.props.accessibilityLabel === 'Esquerdo, 20/10: 31 kg')!.props.onHoverIn());
    expect(linhasDaDica(raiz)).toEqual(['Esquerdo · 20/10 · 31 kg']);
  });

  it('ponto único: um alvo, um ponto e nenhum traço', () => {
    const raiz = montarCom({ segmentos: 'retos' }, [PONTOS_DE_TESTE[0]]);
    expect(obterBotoes(raiz)).toHaveLength(1);
    expect(linhas(raiz)[0].props.d).not.toMatch(/[LC]/);
  });

  it('teclado: o foco mostra a dica da tela, as setas andam, Enter só abre e Esc fecha; a mudança vai à região viva', () => {
    const textoDaDica = jest.fn((p: PontoGrafico, i: number) => [`${p.rotulo} · ${p.valor} kg`, i === 0 ? 'Primeira data' : `Desde 10/10`]);
    const raiz = montarCom({ textoDaDica });
    const botoes = () => obterBotoes(raiz);
    // Uma parada só do Tab não vale no Jest (só na web); os três alvos existem e respondem ao teclado.
    Renderer.act(() => botoes()[1].props.onFocus());
    expect(linhasDaDica(raiz)).toEqual(['15/10 · 95 kg', 'Desde 10/10']);
    expect(textoDaDica).toHaveBeenLastCalledWith(PONTOS_DE_TESTE[1], 1, 'A');
    expect(regiaoViva(raiz).props.children).toBe('15/10 · 95 kg. Desde 10/10');

    const tecla = (indice: number, key: string) => Renderer.act(() => botoes()[indice].props.onKeyDown({ key, preventDefault: () => undefined, stopPropagation: () => undefined }));
    tecla(1, 'ArrowRight');
    expect(linhasDaDica(raiz)[0]).toBe('20/10 · 78.2 kg');
    tecla(2, 'Home');
    expect(linhasDaDica(raiz)[0]).toBe('10/10 · 80.5 kg');
    tecla(0, 'Escape');
    expect(obterDica(raiz)).toBeNull();
    expect(regiaoViva(raiz).props.children).toBe('');

    // Enter/Espaço chegam ao onPress como clique sintético (detail 0) e como o evento de tecla: abrem e não alternam.
    Renderer.act(() => botoes()[0].props.onPress({ nativeEvent: { detail: 0 } }));
    Renderer.act(() => botoes()[0].props.onPress({ key: 'Enter' }));
    expect(linhasDaDica(raiz)[0]).toBe('10/10 · 80.5 kg');
    // O clique do mouse (detail 1) continua alternando.
    Renderer.act(() => botoes()[0].props.onPress({ nativeEvent: { detail: 1 } }));
    expect(obterDica(raiz)).toBeNull();
  });

  it('legenda da escala abaixo do gráfico e as duas pontas do eixo rotuladas', () => {
    const legenda = 'Escala vertical: 75 a 100 kg · pontos = registros';
    const raiz = montarCom({ legendaDaEscala: legenda, escala: { min: 75, max: 100 } });
    expect(temTexto(raiz, legenda)).toBe(true);
    const rotulos = rotulosDoEixo(raiz);
    expect(rotulos[0]).toBe('75');
    expect(rotulos[rotulos.length - 1]).toBe('100');

    // Sem escala, a legenda também liga as pontas: o mínimo e o máximo calculados aparecem.
    const folga = (95 - 78.2) * 0.15;
    const semEscala = rotulosDoEixo(montarCom({ legendaDaEscala: legenda }));
    expect(semEscala[0]).toBe(String(Math.round((78.2 - folga) * 10) / 10).replace('.', ','));
    expect(semEscala[semEscala.length - 1]).toBe(String(Math.round((95 + folga) * 10) / 10).replace('.', ','));
  });

  it('destacarUltimo aumenta só o último ponto, sem cor nova e sem círculo a mais', () => {
    const circulos = (raiz: Raiz) => raiz.root.findAllByType(Svg.Circle);
    const normal = circulos(montar());
    const destacado = circulos(montarCom({ destacarUltimo: true }));
    expect(destacado).toHaveLength(normal.length);
    expect(destacado.map((c) => c.props.r)).toEqual([4, 4, 5.5]);
    expect(new Set(destacado.map((c) => c.props.fill))).toEqual(new Set(normal.map((c) => c.props.fill)));
  });
});
