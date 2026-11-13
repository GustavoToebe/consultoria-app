import {
  chipsDasPastas, chipsDeRegistros, chipsDoGrupo, chipsDoPeriodoDoHistorico, REGISTROS_SEM_FILTRO, selecaoDepoisDoGrupo, semOFiltroDeRegistros,
} from './filtrosDosCartoes';

const PERIODOS = [{ valor: '14', rotulo: '14 dias' }, { valor: '30', rotulo: '30 dias' }, { valor: '60', rotulo: '60 dias' }];
const PLANOS = [{ valor: 'p1', rotulo: 'Treino A' }, { valor: 'p2', rotulo: 'Treino B' }];

describe('filtros das pastas', () => {
  it('"Todas" não conta; as outras viram etiqueta', () => {
    expect(chipsDasPastas('todas')).toEqual([]);
    expect(chipsDasPastas('abertas')).toEqual([{ chave: 'situacao', texto: 'Situação: Abertas' }]);
    expect(chipsDasPastas('concluidas')).toEqual([{ chave: 'situacao', texto: 'Situação: Concluídas' }]);
  });
});

describe('filtros dos registros', () => {
  it('sem filtro, nada conta (14 dias é o padrão do período)', () => {
    expect(chipsDeRegistros(REGISTROS_SEM_FILTRO, { comPeriodo: true, periodos: PERIODOS, planos: PLANOS })).toEqual([]);
  });
  it('período fora do padrão e plano escolhido: duas etiquetas', () => {
    expect(chipsDeRegistros({ dias: '60', planoId: 'p2' }, { comPeriodo: true, periodos: PERIODOS, planos: PLANOS }).map((c) => c.texto))
      .toEqual(['Período: 60 dias', 'Plano: Treino B']);
  });
  it('na pasta com período o dia não conta; plano que sumiu da lista também não', () => {
    expect(chipsDeRegistros({ dias: '60', planoId: 'sumiu' }, { comPeriodo: false, periodos: PERIODOS, planos: PLANOS })).toEqual([]);
  });
  it('o ✕ volta só aquele critério ao padrão', () => {
    expect(semOFiltroDeRegistros({ dias: '60', planoId: 'p2' }, 'dias')).toEqual({ dias: '14', planoId: 'p2' });
    expect(semOFiltroDeRegistros({ dias: '60', planoId: 'p2' }, 'planoId')).toEqual({ dias: '60', planoId: 'todos' });
  });
});

describe('período do histórico', () => {
  const OPCOES = [{ valor: 'PASTA_ATUAL', rotulo: 'Pasta em uso' }, { valor: 'PASTA_ANTERIOR', rotulo: 'Pasta anterior' }, { valor: 'ULTIMOS_30', rotulo: 'Últimos 30 dias' }];
  it('o padrão (primeira opção) não conta', () => {
    expect(chipsDoPeriodoDoHistorico('PASTA_ATUAL', OPCOES)).toEqual([]);
    expect(chipsDoPeriodoDoHistorico('ULTIMOS_30', OPCOES.slice(2))).toEqual([]);
  });
  it('outra opção vira etiqueta com o nome dela', () => {
    expect(chipsDoPeriodoDoHistorico('PASTA_ANTERIOR', OPCOES)).toEqual([{ chave: 'periodo', texto: 'Período: Pasta anterior' }]);
  });
});

describe('grupo muscular das folhas de exercícios', () => {
  it('o "Todos" da folha não conta', () => {
    expect(chipsDoGrupo('', '')).toEqual([]);
    expect(chipsDoGrupo('todos', 'todos')).toEqual([]);
    expect(chipsDoGrupo('Peito', '')).toEqual([{ chave: 'grupo', texto: 'Grupo muscular: Peito' }]);
  });
  it('aplicar outro grupo tira da seleção o que não é dele e avisa quantos saíram', () => {
    const r = selecaoDepoisDoGrupo(new Set(['a', 'b', 'c']), new Set(['a']), 'Peito');
    expect([...r.marcados]).toEqual(['a']);
    expect(r.aviso).toBe('2 exercícios marcados saíram da seleção porque não são do grupo Peito.');
    expect(selecaoDepoisDoGrupo(new Set(['a', 'b']), new Set(['a']), 'Peito').aviso).toBe('1 exercício marcado saiu da seleção porque não é do grupo Peito.');
  });
  it('"Todos" ou grupo que já contém a seleção: nada sai e não há aviso', () => {
    const marcados = new Set(['a', 'b']);
    expect(selecaoDepoisDoGrupo(marcados, null, '')).toEqual({ marcados, aviso: null });
    expect(selecaoDepoisDoGrupo(marcados, new Set(['a', 'b', 'c']), 'Peito')).toEqual({ marcados, aviso: null });
  });
});
