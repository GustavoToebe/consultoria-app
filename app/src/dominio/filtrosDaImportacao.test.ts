import { chipsDosFiltros, lerDoEndereco, paraEndereco, pedidoDaApi, SEM_FILTROS, semOFiltro } from './filtrosDaImportacao';

const DESTINOS = [{ id: 'alunos' }, { id: 'pesos' }];

describe('filtros da importação', () => {
  test('endereço: destino permitido, situação e arquivo; o resto é ignorado', () => {
    expect(lerDoEndereco({}, DESTINOS)).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({ destino: 'alunos', situacao: 'falhou', arquivo: 'CSV' }, DESTINOS)).toEqual({ ...SEM_FILTROS, destino: 'alunos', situacao: 'FALHOU', arquivo: 'csv' });
    // Destino que a pessoa não pode importar não filtra.
    expect(lerDoEndereco({ destino: 'alimentos', situacao: 'X', arquivo: 'pdf' }, DESTINOS)).toEqual(SEM_FILTROS);
  });

  test('ida e volta, pedido e chips', () => {
    const f = { destino: 'pesos', situacao: 'CONCLUIDA_COM_ERROS' as const, arquivo: 'xlsx' as const, periodo: { de: '2026-10-01', ate: null } };
    expect(lerDoEndereco(paraEndereco(f), DESTINOS)).toEqual(f);
    expect(pedidoDaApi(f)).toEqual({ destino: 'pesos', situacao: 'CONCLUIDA_COM_ERROS', arquivo: 'xlsx', de: '2026-10-01' });
    expect(pedidoDaApi(SEM_FILTROS)).toEqual({});
    expect(chipsDosFiltros(f, () => 'Pesos').map((c) => c.texto))
      .toEqual(['Destino: Pesos', 'Situação: Concluída com erros', 'Arquivo: Excel (.xlsx)', 'Data: a partir de 01/10/2026']);
    expect(semOFiltro(f, 'arquivo')).toEqual({ ...f, arquivo: '' });
    expect(semOFiltro(f, 'periodo').periodo).toEqual({ de: null, ate: null });
    // Fim antes do início não filtra.
    expect(lerDoEndereco({ de: '2026-10-31', ate: '2026-10-01' }, DESTINOS)).toEqual(SEM_FILTROS);
  });
});
