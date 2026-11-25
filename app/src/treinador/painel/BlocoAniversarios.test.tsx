/* eslint-disable @typescript-eslint/no-require-imports */
import type { ReactNode } from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';

import { aniversariantesDosProximosDias } from '../../dominio/aniversariosDosAlunos';
import type { TamanhoDoBloco } from '../../dominio/painelBlocos';
import { BlocoAniversarios } from './BlocoAniversarios';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, bordas: { bloco: 2, item: 2 }, fatorTexto: 1, preferencias: { animacoes: false } }),
}));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: ReactNode }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../../ui/Selo', () => ({
  Selo: ({ texto, tipo, categoria }: { texto: string; tipo?: string; categoria?: object }) =>
    require('react').createElement(require('react-native').Text, { testID: `selo-${categoria ? 'neutro' : tipo}` }, texto),
}));
jest.mock('../../ui/Botao', () => ({
  Botao: ({ rotulo, rotuloAcessivel, aoTocar }: { rotulo: string; rotuloAcessivel?: string; aoTocar: () => void }) =>
    require('react').createElement(require('react-native').Pressable, { accessibilityRole: 'button', accessibilityLabel: rotuloAcessivel ?? rotulo, onPress: aoTocar },
      require('react').createElement(require('react-native').Text, null, rotulo)),
}));
jest.mock('../../ui/Folha', () => ({
  Folha: ({ visivel, titulo, children }: { visivel: boolean; titulo: string; children?: ReactNode }) =>
    visivel ? require('react').createElement(require('react-native').View, { testID: 'folha', accessibilityLabel: titulo }, children) : null,
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

const HOJE = '2026-11-25';
// Nomes e ids fictícios e sem dígitos: o teste do ano procura 4 dígitos no que aparece.
const NOMES = ['Ana', 'Bia', 'Caio', 'Dani', 'Edu', 'Fê', 'Gil', 'Hugo', 'Iara', 'Juca', 'Kátia'];
/** `n` aniversariantes a partir de hoje, um por dia (o primeiro faz hoje, o segundo amanhã), passados pela regra que ordena. */
const lista = (n: number) => aniversariantesDosProximosDias(
  NOMES.slice(0, n).map((nome, i) => ({ alunoId: `aluno-${nome}`, nome, dia: 25 + i > 30 ? 25 + i - 30 : 25 + i, mes: 25 + i > 30 ? 12 : 11 })),
  HOJE, 15);

function montar(n: number, tamanho: TamanhoDoBloco, dias = 15, aoAbrirFicha: (id: string) => void = () => undefined) {
  let r!: ReactTestRenderer;
  Renderer.act(() => { r = Renderer.create(<BlocoAniversarios aniversariantes={lista(n)} tamanho={tamanho} dias={dias} aoAbrirFicha={aoAbrirFicha} hoje={HOJE} />); });
  return r;
}

const linhas = (r: ReactTestRenderer | import('react-test-renderer').ReactTestInstance) => {
  const raiz = 'root' in r ? r.root : r;
  return raiz.findAll((no) => typeof no.type === 'string' && no.props.accessibilityHint === 'Abre a ficha do aluno').map((no) => String(no.props.accessibilityLabel));
};
const verTodos = (r: ReactTestRenderer) =>
  r.root.findAll((no) => typeof no.props.onPress === 'function' && /ver todos os/.test(String(no.props.accessibilityLabel ?? '')));
/** Tudo o que aparece ou é lido: textos, nomes acessíveis e testIDs (cores do tema ficam de fora). */
const tudoQueSeLe = (r: ReactTestRenderer) => r.root.findAll((no) => typeof no.type === 'string').flatMap((no) => [
  ...(typeof no.props.children === 'string' ? [no.props.children] : []),
  ...(no.props.accessibilityLabel ? [String(no.props.accessibilityLabel)] : []),
  ...(no.props.accessibilityHint ? [String(no.props.accessibilityHint)] : []),
  ...(no.props.testID ? [String(no.props.testID)] : []),
]).join(' | ');

describe('BlocoAniversarios', () => {
  it.each([
    [0, 1, 0], [1, 1, 1], [3, 1, 3], [4, 1, 3], [7, 1, 3], [11, 1, 3],
    [0, 2, 0], [1, 2, 1], [3, 2, 3], [4, 2, 4], [7, 2, 6], [11, 2, 6],
    [0, 3, 0], [1, 3, 1], [3, 3, 3], [4, 3, 4], [7, 3, 7], [11, 3, 10],
  ] as const)('%i aniversariantes no tamanho %i: mostra %i e o "+N" com o resto', (total, tamanho, mostrados) => {
    const r = montar(total, tamanho);
    expect(linhas(r)).toHaveLength(mostrados);
    const resto = total - mostrados;
    expect(verTodos(r).map((b) => b.props.accessibilityLabel)).toEqual(resto ? [`+${resto}: ver todos os ${total} aniversários`] : []);
  });

  it('na ordem da data, com "Hoje" no selo, "Amanhã" e o dia/mês', () => {
    const r = montar(4, 3);
    expect(linhas(r)).toEqual(['Ana, Hoje', 'Bia, Amanhã', 'Caio, 27/11', 'Dani, 28/11']);
    // Pílula neutra: aniversário não é alerta (nada de âmbar).
    expect(r.root.findAll((no) => typeof no.type === 'string' && no.props.testID === 'selo-neutro').map((no) => no.props.children)).toEqual(['Hoje']);
  });

  it('tocar no nome abre a ficha do aluno', () => {
    const aoAbrir = jest.fn();
    const r = montar(3, 1, 15, aoAbrir);
    const bia = r.root.findAll((no) => typeof no.props.onPress === 'function' && no.props.accessibilityLabel === 'Bia, Amanhã')[0];
    Renderer.act(() => bia.props.onPress());
    expect(aoAbrir).toHaveBeenCalledWith('aluno-Bia');
  });

  it('"+N" abre a folha com todos, na mesma apresentação; tocar num nome lá fecha a folha e abre a ficha', () => {
    const aoAbrir = jest.fn();
    const r = montar(11, 1, 15, aoAbrir);
    expect(r.root.findAll((no) => no.props.testID === 'folha')).toHaveLength(0);
    Renderer.act(() => verTodos(r)[0].props.onPress());
    const folha = r.root.findByProps({ testID: 'folha' });
    expect(folha.props.accessibilityLabel).toBe('Aniversários');
    expect(linhas(folha)).toEqual(lista(11).map((a, i) => `${a.nome}, ${i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : a.data}`));
    expect(linhas(r)).toHaveLength(3 + 11);
    const kati = folha.findAll((no) => typeof no.props.onPress === 'function' && no.props.accessibilityLabel === 'Kátia, 05/12')[0];
    Renderer.act(() => kati.props.onPress());
    expect(aoAbrir).toHaveBeenCalledWith('aluno-Kátia');
    expect(r.root.findAll((no) => no.props.testID === 'folha')).toHaveLength(0);
  });

  it.each([[0, 'Nenhum aniversário hoje'], [3, 'Nenhum aniversário nos próximos 3 dias'], [7, 'Nenhum aniversário nos próximos 7 dias'], [15, 'Nenhum aniversário nos próximos 15 dias']] as const)(
    'sem aniversariante em %i dias: uma linha diz isso e não há lista', (dias, frase) => {
      const r = montar(0, 2, dias);
      expect(tudoQueSeLe(r)).toBe(frase);
    });

  it('nunca a idade nem o ano: nada de 4 dígitos nem "anos" no que se vê ou se lê, no bloco e na folha', () => {
    const r = montar(11, 3);
    Renderer.act(() => verTodos(r)[0].props.onPress());
    const texto = tudoQueSeLe(r);
    expect(texto).toContain('Kátia');
    expect(texto).not.toMatch(/\b\d{4}\b/);
    expect(texto).not.toMatch(/\banos?\b/i);
  });
});
