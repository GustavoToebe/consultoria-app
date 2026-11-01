import {
  chipsDosFiltros, contagensValem, filtrarPorNome, lerDoEndereco, MEUS, opcoesDeResponsavel, paraEndereco, pedidoDaApi, SEM_FILTROS,
  semOFiltro, TODOS,
} from './filtrosDeAtualizacoes';

const ID = 'u0000000-0000-4000-8000-000000000007';
const OUTRO = { id: ID, nome: 'Bia Fictícia' };

describe('filtros das atualizações', () => {
  test('endereço: meus, pessoa e período; o resto é ignorado', () => {
    expect(lerDoEndereco({})).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({ meus: 'true', responsavel: ID }).responsavel).toBe(MEUS);
    expect(lerDoEndereco({ responsavel: ID }).responsavel).toBe(ID);
    expect(lerDoEndereco({ responsavel: '../x' }).responsavel).toBe(TODOS);
    expect(lerDoEndereco({ de: '2026-10-01', ate: '2026-10-31' }).periodo).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    // A rota só aceita o par.
    expect(lerDoEndereco({ de: '2026-10-01' }).periodo).toEqual({ de: null, ate: null });
  });

  test('ida e volta pelo endereço', () => {
    const f = { responsavel: ID, periodo: { de: '2026-10-01', ate: '2026-10-31' } };
    expect(paraEndereco(f)).toEqual({ responsavel: ID, de: '2026-10-01', ate: '2026-10-31' });
    expect(lerDoEndereco(paraEndereco(f))).toEqual(f);
    expect(paraEndereco({ ...SEM_FILTROS, responsavel: MEUS })).toEqual({ meus: 'true' });
    expect(paraEndereco(SEM_FILTROS)).toEqual({});
  });

  test('pedido: meus ou responsável, nunca os dois; período só em par', () => {
    expect(pedidoDaApi(SEM_FILTROS)).toEqual({ meus: false, filtro: {} });
    expect(pedidoDaApi({ ...SEM_FILTROS, responsavel: MEUS })).toEqual({ meus: true, filtro: {} });
    expect(pedidoDaApi({ responsavel: ID, periodo: { de: '2026-10-01', ate: '2026-10-31' } }))
      .toEqual({ meus: false, filtro: { responsavel: ID, de: '2026-10-01', ate: '2026-10-31' } });
  });

  test('contagens das abas só sem pessoa e sem período', () => {
    expect(contagensValem(SEM_FILTROS)).toBe(true);
    expect(contagensValem({ ...SEM_FILTROS, responsavel: MEUS })).toBe(true);
    expect(contagensValem({ ...SEM_FILTROS, responsavel: ID })).toBe(false);
    expect(contagensValem({ ...SEM_FILTROS, periodo: { de: '2026-10-01', ate: '2026-10-31' } })).toBe(false);
  });

  test('chips e ✕', () => {
    const f = { responsavel: ID, periodo: { de: '2026-10-01', ate: '2026-10-31' } };
    expect(chipsDosFiltros(f, (id) => (id === ID ? OUTRO.nome : null))).toEqual([
      { chave: 'responsavel', texto: 'Responsável: Bia Fictícia' },
      { chave: 'periodo', texto: 'Data: 01/10/2026 a 31/10/2026' },
    ]);
    expect(chipsDosFiltros({ ...SEM_FILTROS, responsavel: MEUS })).toEqual([{ chave: 'responsavel', texto: 'Responsável: Meus alunos' }]);
    expect(semOFiltro(f, 'responsavel').responsavel).toBe(TODOS);
    expect(semOFiltro(f, 'periodo').periodo).toEqual({ de: null, ate: null });
  });

  test('opções de responsável e busca pelo nome', () => {
    expect(opcoesDeResponsavel([{ id: 'eu-0000000', nome: 'Eu' }, OUTRO], 'eu-0000000').map((o) => o.rotulo)).toEqual(['Todos', 'Meus alunos', 'Bia Fictícia']);
    const itens = [{ nomeAluno: 'João Fictício' }, { nomeAluno: null }, { nomeAluno: 'Ana' }];
    expect(filtrarPorNome(itens, 'joao')).toEqual([{ nomeAluno: 'João Fictício' }]);
    expect(filtrarPorNome(itens, '  ')).toHaveLength(3);
  });
});
