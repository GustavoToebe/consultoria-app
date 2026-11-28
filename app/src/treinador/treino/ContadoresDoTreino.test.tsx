/* eslint-disable @typescript-eslint/no-require-imports */
import type { ConteudoTreino, Problema } from '../../api/tipos';
import { exercicio, serie, sessao } from '../../dominio/exemplosDeTreino.apoioTeste';
import { ContadoresDoTreino, EstadoDasPendencias } from './ContadoresDoTreino';

/**
 * Cabeçalho das Sessões (SERIE-ABERTA 0.3): "Sessões" + "N sessões · N exercícios · N séries", o selo das pendências
 * antes da ação e, com pendência, o selo clicável que leva à primeira (erro antes do ponto para revisar).
 */
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, fatorTexto: 1 }),
}));
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').Text, null, children),
}));
jest.mock('../../ui/Selo', () => ({
  Selo: ({ texto, tipo }: { texto: string; tipo?: string }) => require('react').createElement(require('react-native').Text, { testID: `selo-${tipo}` }, texto),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
const RN = require('react-native') as typeof import('react-native');
type Raiz = import('react-test-renderer').ReactTestRenderer;

const textos = (raiz: Raiz) => raiz.root.findAll((x) => typeof x.type === 'string' && typeof x.props.children === 'string').map((x) => x.props.children as string);
const tocaveis = (raiz: Raiz) => raiz.root.findAll((x) => typeof x.type !== 'string' && typeof x.props.onPress === 'function' && x.parent?.props.onPress !== x.props.onPress);
const botoes = tocaveis;

// Duas sessões, 3 exercícios, 4 séries; todas com descanso (nenhum ponto para revisar).
const comDescanso = (uid: string) => serie(uid, { descansoSegundos: 90 });
const conteudo = (extra: Partial<ConteudoTreino> = {}): ConteudoTreino => ({
  objetivo: null,
  orientacoes: null,
  sessoes: [
    sessao('a', [exercicio('e1', { series: [comDescanso('s1'), comDescanso('s2')] }), exercicio('e2', { series: [comDescanso('s3')] })]),
    sessao('b', [exercicio('e3', { series: [comDescanso('s4')] })]),
  ],
  ...extra,
});

function montar(props: Partial<Parameters<typeof ContadoresDoTreino>[0]> = {}) {
  let raiz!: Raiz;
  Renderer.act(() => {
    raiz = Renderer.create(
      <ContadoresDoTreino conteudo={conteudo()} erros={[]} modelo aoIrAPendencia={() => undefined}
        acao={<RN.Text>Colar treino (Docs / PDF)</RN.Text>} {...props} />,
    );
  });
  return raiz;
}

describe('ContadoresDoTreino', () => {
  it('título "Sessões" com os totais do plano ao lado, sem o "(N)" nem o "Plano inteiro"', () => {
    const t = textos(montar());
    expect(t).toContain('Sessões');
    expect(t).toContain('2 sessões · 3 exercícios · 4 séries');
    expect(t.some((x) => x.startsWith('Plano inteiro') || x.startsWith('Sessões ('))).toBe(false);
  });

  it('o selo vem antes da ação ("Colar treino")', () => {
    const t = textos(montar());
    expect(t.indexOf('Sem pendências')).toBeLessThan(t.indexOf('Colar treino (Docs / PDF)'));
  });
});

describe('EstadoDasPendencias', () => {
  const montarEstado = (props: Partial<Parameters<typeof EstadoDasPendencias>[0]> = {}) => {
    let raiz!: Raiz;
    Renderer.act(() => {
      raiz = Renderer.create(<EstadoDasPendencias conteudo={conteudo()} erros={[]} modelo aoIrAPendencia={() => undefined} {...props} />);
    });
    return raiz;
  };

  it('sem pendência: selo de sucesso, sem botão ("Sem pendências" no modelo, "Pronto para publicar" no aluno)', () => {
    const modelo = montarEstado();
    expect(modelo.root.findByProps({ testID: 'selo-sucesso' }).props.children).toBe('Sem pendências');
    expect(botoes(modelo)).toHaveLength(0);
    expect(montarEstado({ modelo: false }).root.findByProps({ testID: 'selo-sucesso' }).props.children).toBe('Pronto para publicar');
  });

  it('com erro: "● N pendências" em perigo, e o toque leva à primeira pendência', () => {
    const aoIrAPendencia = jest.fn();
    const erros: Problema[] = [{ caminho: 'sessoes[0].nome', mensagem: 'Informe o nome.' }, { caminho: 'sessoes[1].nome', mensagem: 'Informe o nome.' }];
    const raiz = montarEstado({ erros, aoIrAPendencia });
    expect(raiz.root.findByProps({ testID: 'selo-perigo' }).props.children).toBe('2 pendências');
    const [botao] = botoes(raiz);
    expect(botao.props.accessibilityLabel).toBe('2 pendências · Ir à primeira pendência');
    Renderer.act(() => botao.props.onPress());
    expect(aoIrAPendencia).toHaveBeenCalledWith(expect.objectContaining({ total: 2, sessaoUid: 'a' }), expect.any(Array));
  });

  it('série sem descanso: com `aoIrAoPonto` entra no selo em âmbar e o toque abre o ponto; sem ele, não conta', () => {
    const semDescanso = conteudo({ sessoes: [sessao('a', [exercicio('e1', { nome: 'Agachamento livre', series: [serie('s1')] })])] });
    expect(montarEstado({ conteudo: semDescanso }).root.findByProps({ testID: 'selo-sucesso' })).toBeTruthy();

    const aoIrAoPonto = jest.fn();
    const raiz = montarEstado({ conteudo: semDescanso, aoIrAoPonto, modelo: false });
    expect(raiz.root.findByProps({ testID: 'selo-atencao' }).props.children).toBe('1 ponto para revisar');
    Renderer.act(() => botoes(raiz)[0].props.onPress());
    expect(aoIrAoPonto).toHaveBeenCalledWith(expect.objectContaining({ exercicioUid: 'e1', texto: 'Agachamento livre · Série 1 sem descanso' }));
  });

  it('erro e ponto juntos: o erro vai primeiro', () => {
    const aoIrAPendencia = jest.fn();
    const aoIrAoPonto = jest.fn();
    const semDescanso = conteudo({ sessoes: [sessao('a', [exercicio('e1', { series: [serie('s1')] })])] });
    const raiz = montarEstado({ conteudo: semDescanso, erros: [{ caminho: 'sessoes[0].nome', mensagem: 'x' }], aoIrAPendencia, aoIrAoPonto });
    expect(raiz.root.findByProps({ testID: 'selo-perigo' }).props.children).toBe('2 pendências');
    Renderer.act(() => botoes(raiz)[0].props.onPress());
    expect(aoIrAPendencia).toHaveBeenCalled();
    expect(aoIrAoPonto).not.toHaveBeenCalled();
  });
});
