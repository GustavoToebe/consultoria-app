import {
  chaveDosFiltros, chipsDosFiltros, lerDoEndereco, MEUS, opcoesDeResponsavel, paraEndereco, pedidoDaApi, SEM_FILTROS, SEM_RESPONSAVEL,
  semOFiltro,
} from './filtrosDeAtualizacoes';

const ID = 'u0000000-0000-4000-8000-000000000007';
const EU = 'e0000000-0000-4000-8000-000000000001';
const OUTRO = { id: ID, nome: 'Bia Fictícia' };

describe('filtros das atualizações', () => {
  test('endereço: meus, pessoas, sem responsável e período; o resto é ignorado', () => {
    expect(lerDoEndereco({})).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({ meus: 'true', responsavel: ID }).responsaveis).toEqual([MEUS]);
    expect(lerDoEndereco({ responsavel: `${ID},nenhum` }).responsaveis).toEqual([ID, SEM_RESPONSAVEL]);
    expect(lerDoEndereco({ responsavel: ['meus', ID] }).responsaveis).toEqual([MEUS, ID]);
    expect(lerDoEndereco({ responsavel: '../x' }).responsaveis).toEqual([]);
    expect(lerDoEndereco({ de: '2026-10-01', ate: '2026-10-31' }).periodo).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    // A rota só aceita o par.
    expect(lerDoEndereco({ de: '2026-10-01' }).periodo).toEqual({ de: null, ate: null });
  });

  test('ida e volta pelo endereço', () => {
    const f = { responsaveis: [ID, SEM_RESPONSAVEL], periodo: { de: '2026-10-01', ate: '2026-10-31' } };
    expect(paraEndereco(f)).toEqual({ responsavel: `${ID},nenhum`, de: '2026-10-01', ate: '2026-10-31' });
    expect(lerDoEndereco(paraEndereco(f))).toEqual(f);
    expect(paraEndereco({ ...SEM_FILTROS, responsaveis: [MEUS] })).toEqual({ meus: 'true' });
    expect(paraEndereco({ ...SEM_FILTROS, responsaveis: [MEUS, ID] })).toEqual({ responsavel: `meus,${ID}` });
    expect(paraEndereco(SEM_FILTROS)).toEqual({});
  });

  test('pedido: só Meus = meus=true; Meus com outros vira o id; busca e período em par', () => {
    expect(pedidoDaApi(SEM_FILTROS, '', EU)).toEqual({ meus: false, filtro: {} });
    expect(pedidoDaApi({ ...SEM_FILTROS, responsaveis: [MEUS] }, '', EU)).toEqual({ meus: true, filtro: {} });
    expect(pedidoDaApi({ responsaveis: [MEUS, SEM_RESPONSAVEL], periodo: { de: '2026-10-01', ate: '2026-10-31' } }, ' ana ', EU))
      .toEqual({ meus: false, filtro: { responsavel: [EU, SEM_RESPONSAVEL], busca: 'ana', de: '2026-10-01', ate: '2026-10-31' } });
    expect(pedidoDaApi({ ...SEM_FILTROS, responsaveis: [MEUS, ID] }, '', null)).toEqual({ meus: false, filtro: { responsavel: [ID] } });
  });

  test('chave muda com a busca e não com a ordem das pessoas', () => {
    expect(chaveDosFiltros({ ...SEM_FILTROS, responsaveis: [ID, MEUS] })).toBe(chaveDosFiltros({ ...SEM_FILTROS, responsaveis: [MEUS, ID] }));
    expect(chaveDosFiltros(SEM_FILTROS, 'ana')).not.toBe(chaveDosFiltros(SEM_FILTROS));
  });

  test('chips e ✕', () => {
    const f = { responsaveis: [SEM_RESPONSAVEL, ID, MEUS], periodo: { de: '2026-10-01', ate: '2026-10-31' } };
    expect(chipsDosFiltros(f, (id) => (id === ID ? OUTRO.nome : null))).toEqual([
      { chave: 'responsavel', texto: 'Responsável: Meus alunos, Bia Fictícia, Sem responsável' },
      { chave: 'periodo', texto: 'Data: 01/10/2026 a 31/10/2026' },
    ]);
    expect(semOFiltro(f, 'responsavel').responsaveis).toEqual([]);
    expect(semOFiltro(f, 'periodo').periodo).toEqual({ de: null, ate: null });
  });

  test('opções de responsável', () => {
    expect(opcoesDeResponsavel([{ id: 'eu-0000000', nome: 'Eu' }, OUTRO], 'eu-0000000').map((o) => o.rotulo))
      .toEqual(['Meus alunos', 'Bia Fictícia', 'Sem responsável']);
  });
});
