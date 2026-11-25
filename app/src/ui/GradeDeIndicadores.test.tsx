import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { Grade } from './Grade';
import { GradeDeIndicadores } from './GradeDeIndicadores';

jest.mock('../tema/TemaProvider', () => ({ useTema: () => ({ fatorTexto: 1 }) }));

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });

const VAO = 12;

/** Monta, mede a raiz com `largura` (o onLayout da web) e devolve a largura de cada célula, na ordem. */
function larguras(elemento: React.ReactElement, largura: number): number[] {
  let r!: ReactTestRenderer;
  act(() => { r = create(elemento); });
  const raiz = () => r.root.findAll((n) => String(n.type) === 'View' && typeof n.props.onLayout === 'function')[0];
  act(() => { raiz().props.onLayout({ nativeEvent: { layout: { width: largura, height: 0, x: 0, y: 0 } } }); });
  return raiz().children.map((c) => (typeof c === 'string' ? NaN : Number(StyleSheet.flatten(c.props.style)?.width)));
}

const cartoes = (n: number) => Array.from({ length: n }, (_, i) => <Text key={i}>{`Cartão ${i + 1}`}</Text>);

/** Agrupa as larguras em linhas como o flexWrap faria e confere que cada linha fecha a largura (só o 1 px de folga). */
function linhas(ws: number[], largura: number): number[][] {
  const saida: number[][] = [];
  let atual: number[] = [];
  let soma = 0;
  for (const w of ws) {
    const proxima = atual.length ? soma + VAO + w : w;
    if (atual.length && proxima > largura + 0.001) { saida.push(atual); atual = []; soma = 0; }
    soma = atual.length ? soma + VAO + w : w;
    atual.push(w);
  }
  if (atual.length) saida.push(atual);
  return saida;
}
const ocupada = (linha: number[]) => linha.reduce((s, w) => s + w, 0) + VAO * (linha.length - 1);

describe('GradeDeIndicadores com as linhas equilibradas e esticadas', () => {
  it('5 cartões em 1100 px: 3 + 2, as duas linhas até a largura toda (menos o 1 px da web)', () => {
    const ws = larguras(<GradeDeIndicadores>{cartoes(5)}</GradeDeIndicadores>, 1100);
    const ls = linhas(ws, 1100);
    expect(ls.map((l) => l.length)).toEqual([3, 2]);
    for (const l of ls) expect(ocupada(l)).toBeCloseTo(1099, 5);
    expect(ls[1][0]).toBeGreaterThan(ls[0][0]);
  });

  it('7 cartões em 1280 px: 4 + 3, sem buraco à direita', () => {
    const ls = linhas(larguras(<GradeDeIndicadores>{cartoes(7)}</GradeDeIndicadores>, 1280), 1280);
    expect(ls.map((l) => l.length)).toEqual([4, 3]);
    for (const l of ls) expect(ocupada(l)).toBeCloseTo(1279, 5);
  });

  it('7 cartões em 900 px: 3 + 2 + 2, cada linha até a largura toda, a de 2 com cartões mais largos', () => {
    const ls = linhas(larguras(<GradeDeIndicadores>{cartoes(7)}</GradeDeIndicadores>, 900), 900);
    expect(ls.map((l) => l.length)).toEqual([3, 2, 2]);
    for (const l of ls) expect(ocupada(l)).toBeCloseTo(899, 5);
    expect(ls[1][0]).toBeCloseTo((899 - VAO) / 2, 5);
    expect(ls[1][0]).toBeGreaterThan(ls[0][0]);
    expect(ls[2]).toEqual(ls[1]);
  });

  it('5 cartões em 600 px: 2 + 2 + 1, o que sobra sozinho na linha toda', () => {
    const ls = linhas(larguras(<GradeDeIndicadores>{cartoes(5)}</GradeDeIndicadores>, 600), 600);
    expect(ls.map((l) => l.length)).toEqual([2, 2, 1]);
    expect(ls[2][0]).toBeCloseTo(599, 5);
  });

  it('13 cartões em 1300 px: 4 + 3 + 3 + 3', () => {
    const ls = linhas(larguras(<GradeDeIndicadores>{cartoes(13)}</GradeDeIndicadores>, 1300), 1300);
    expect(ls.map((l) => l.length)).toEqual([4, 3, 3, 3]);
    for (const l of ls) expect(ocupada(l)).toBeCloseTo(1299, 5);
  });

  it('6 cartões em 1008 px: 3 + 3 de larguras iguais (total com divisor não muda)', () => {
    const ws = larguras(<GradeDeIndicadores>{cartoes(6)}</GradeDeIndicadores>, 1008);
    expect(new Set(ws.map((w) => w.toFixed(4))).size).toBe(1);
    expect(linhas(ws, 1008).map((l) => l.length)).toEqual([3, 3]);
  });

  it('5 cartões numa largura que cabe todos: uma linha só', () => {
    expect(linhas(larguras(<GradeDeIndicadores>{cartoes(5)}</GradeDeIndicadores>, 1400), 1400).map((l) => l.length)).toEqual([5]);
  });

  it('Grade sem o modo (as outras telas): a última célula fica com a largura das outras', () => {
    const ws = larguras(<Grade gap={VAO} colunas={() => 3}>{cartoes(5)}</Grade>, 1100);
    expect(new Set(ws.map((w) => w.toFixed(4))).size).toBe(1);
  });
});
