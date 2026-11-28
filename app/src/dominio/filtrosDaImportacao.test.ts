import { chipsDosFiltros, lerDoEndereco, paraEndereco, pedidoDaApi, SEM_FILTROS, semOFiltro } from './filtrosDaImportacao';

const DESTINOS = [{ id: 'alunos' }, { id: 'pesos' }];

describe('filtros da importação', () => {
  test('endereço: destinos permitidos, situações e arquivo; o resto é ignorado', () => {
    expect(lerDoEndereco({}, DESTINOS)).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({ destino: 'alunos', situacao: 'falhou', arquivo: 'CSV' }, DESTINOS))
      .toEqual({ ...SEM_FILTROS, destinos: ['alunos'], situacoes: ['FALHOU'], arquivo: 'csv' });
    // Destino que a pessoa não pode importar não filtra.
    expect(lerDoEndereco({ destino: 'alimentos', situacao: 'X', arquivo: 'pdf' }, DESTINOS)).toEqual(SEM_FILTROS);
    // Vários de cada, numa vírgula ou repetidos; a ordem é a da tela, sem repetir.
    expect(lerDoEndereco({ destino: 'pesos,alimentos,alunos,pesos', situacao: ['FALHOU', 'CONCLUIDA'] }, DESTINOS))
      .toEqual({ ...SEM_FILTROS, destinos: ['alunos', 'pesos'], situacoes: ['CONCLUIDA', 'FALHOU'] });
  });

  test('ida e volta, pedido e chips', () => {
    const f = {
      destinos: ['alunos', 'pesos'], situacoes: ['CONCLUIDA_COM_ERROS' as const, 'FALHOU' as const], arquivo: 'xlsx' as const,
      periodo: { de: '2026-10-01', ate: null },
    };
    expect(paraEndereco(f)).toEqual({ destino: 'alunos,pesos', situacao: 'CONCLUIDA_COM_ERROS,FALHOU', arquivo: 'xlsx', de: '2026-10-01' });
    expect(lerDoEndereco(paraEndereco(f), DESTINOS)).toEqual(f);
    expect(pedidoDaApi(f)).toEqual({ destino: ['alunos', 'pesos'], situacao: ['CONCLUIDA_COM_ERROS', 'FALHOU'], arquivo: 'xlsx', de: '2026-10-01' });
    expect(pedidoDaApi(SEM_FILTROS)).toEqual({});
    expect(chipsDosFiltros(f, (id) => (id === 'pesos' ? 'Pesos' : 'Alunos')).map((c) => c.texto))
      .toEqual(['Destino: Alunos, Pesos', 'Situação: Concluída com erros, Falhou', 'Arquivo: Excel', 'Data: a partir de 01/10/2026']);
    expect(semOFiltro(f, 'arquivo')).toEqual({ ...f, arquivo: '' });
    expect(semOFiltro(f, 'destino').destinos).toEqual([]);
    expect(semOFiltro(f, 'situacao').situacoes).toEqual([]);
    expect(semOFiltro(f, 'periodo').periodo).toEqual({ de: null, ate: null });
    // Fim antes do início não filtra.
    expect(lerDoEndereco({ de: '2026-10-31', ate: '2026-10-01' }, DESTINOS)).toEqual(SEM_FILTROS);
  });
});
