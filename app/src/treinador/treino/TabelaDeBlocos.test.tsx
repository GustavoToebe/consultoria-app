/* eslint-disable @typescript-eslint/no-require-imports */
import type { ResumoDoBloco } from '../../dominio/editorDeTreino';
import { colunasDasSeries } from './colunasDasSeries';
import { TabelaDeBlocos, type LinhaDoBloco } from './TabelaDeBlocos';

jest.mock('../../tema/TemaProvider', () => ({
  useTema: () => ({ cores: require('../../tema/tokens').ESCURO, variante: 'escuro', bordas: { item: 1 }, fatorTexto: 1 }),
}));
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('../FolhaDeAcoes', () => ({ FolhaDeAcoes: () => null }));
jest.mock('../../ui/ArrasteDaLista', () => ({
  LARGURA_DA_ALCA: 24, useArrasteDaLista: () => ({}), AlcaDeArraste: () => null,
  ItemArrastavel: ({ children }: { children?: unknown }) => require('react').createElement(require('react-native').View, null, children),
}));
jest.mock('../../ui/Aviso', () => ({ useAviso: () => ({ avisar: () => undefined }) }));
jest.mock('@rn-primitives/portal', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/slot', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/switch', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('@rn-primitives/label', () => jest.requireActual('../../aluno/primitivosFalsos.apoioTeste').primitivosFalsos());
jest.mock('../../ui/Texto', () => ({
  Texto: ({ children, testID }: { children?: unknown; testID?: string }) => require('react').createElement(require('react-native').Text, { testID }, children),
}));

const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');
type Raiz = import('react-test-renderer').ReactTestRenderer;
const textos = (raiz: Raiz) => raiz.root.findAll((x) => typeof x.type === 'string' && typeof x.props.children === 'string').map((x) => x.props.children as string);

const resumo = (r: Partial<ResumoDoBloco> = {}): ResumoDoBloco => ({
  nome: 'Trabalho · WS', quantidade: 1, repeticoes: '3 a 6 reps', descanso: '3 min', variacao: [], semDescanso: false, tecnica: null, ...r,
});
const linha = (valor: string, r: Partial<ResumoDoBloco> = {}, extra: Partial<LinhaDoBloco> = {}): LinhaDoBloco => ({
  valor, rotulo: `Série ${valor} · WS`, serie: `Série ${valor}`, tipo: 'WS', carga: 'Carga de trabalho', resumo: resumo(r), edicao: `Editando série ${valor}`, ...extra,
});

function montar(props: Partial<Parameters<typeof TabelaDeBlocos>[0]> = {}) {
  let raiz!: Raiz;
  Renderer.act(() => {
    raiz = Renderer.create(<TabelaDeBlocos linhas={[linha('1')]} ativa={null} aoMudar={() => undefined} {...props} />);
  });
  return raiz;
}

describe('colunasDasSeries', () => {
  it('todas as colunas por padrão, na ordem do cabeçalho', () => {
    expect(colunasDasSeries()).toEqual(['tipo', 'carga', 'reps', 'descanso']);
  });
  it('sem carga, sem a coluna Carga', () => {
    expect(colunasDasSeries({ semCarga: true })).toEqual(['tipo', 'reps', 'descanso']);
  });
});

describe('TabelaDeBlocos (linha fechada, 27/11)', () => {
  it('cluster: "6 séries · cluster" embaixo do número e "5 × 5 (25)" na Reps, sem repetir a técnica no Tipo', () => {
    const t = textos(montar({ linhas: [linha('1', { quantidade: 6, tecnica: 'cluster', repeticoes: '5 × 5 (25)', nome: 'Trabalho · WS + Cluster' })] }));
    expect(t).toContain('6 séries · cluster');
    expect(t).toContain('5 × 5 (25)');
    expect(t).not.toContain('Trabalho · WS + Cluster');
  });

  it('sem técnica: só a quantidade e o nome por extenso quando diz mais que o selo', () => {
    const t = textos(montar({ linhas: [linha('1', { quantidade: 1, nome: 'Preparação · FS' }, { tipo: 'FS' })] }));
    expect(t).toContain('1 série');
    expect(t).toContain('Preparação · FS');
  });

  it('série sem descanso: "● Falta o descanso" no lugar do valor, também no nome acessível', () => {
    const raiz = montar({ linhas: [linha('1', { semDescanso: true, descanso: '—' })] });
    expect(textos(raiz)).toContain('● Falta o descanso');
    expect(textos(raiz)).not.toContain('—');
    const botao = raiz.root.find((x) => x.props.accessibilityRole === 'button' && typeof x.props.onPress === 'function' && x.props['aria-expanded'] !== undefined);
    expect(botao.props.accessibilityLabel).toContain('falta o descanso');
  });

  it('empilhado (390): a falta do descanso sai da linha corrida e vira linha própria', () => {
    const t = textos(montar({ empilhado: true, linhas: [linha('1', { semDescanso: true, descanso: '—' })] }));
    expect(t).toContain('● Falta o descanso');
    expect(t.some((x) => x.includes('descanso —'))).toBe(false);
  });

  it('sem carga: sem a coluna Carga no cabeçalho e nas linhas', () => {
    const com = montar();
    expect(com.root.findAll((x) => x.props.testID === 'cabecalho-carga')).not.toHaveLength(0);
    const sem = montar({ semCarga: true });
    expect(sem.root.findAll((x) => x.props.testID === 'cabecalho-carga')).toHaveLength(0);
    expect(textos(sem)).not.toContain('Carga de trabalho');
  });

  it('"+ Nova série" é a última linha e chama quem usa', () => {
    const aoTocar = jest.fn();
    const raiz = montar({ nova: { rotulo: 'Nova série', aoTocar } });
    Renderer.act(() => raiz.root.find((x) => x.props.testID === 'nova-serie' && typeof x.props.onPress === 'function').props.onPress());
    expect(aoTocar).toHaveBeenCalledTimes(1);
  });
});
