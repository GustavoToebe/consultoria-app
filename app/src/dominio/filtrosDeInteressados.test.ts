import {
  chipsDosFiltros, filtrosDaFila, filtrosVisiveis, lerDoEndereco, limpos, MEUS, opcoesDeResponsavel, paraEndereco, paraEnderecoSemSituacao,
  SEM_FILTROS, SEM_RESPONSAVEL, semOFiltro, temOutrosFiltros, TODOS,
} from './filtrosDeInteressados';

const ID = 'u0000000-0000-4000-8000-000000000007';

describe('filtros de Interessados', () => {
  test('endereço: situação, meus, pessoa ou nenhum, origem; o desconhecido é ignorado', () => {
    expect(lerDoEndereco({})).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({ situacao: 'NOVA', meus: 'true', responsavel: ID, origem: 'INSTAGRAM' }))
      .toEqual({ situacao: 'NOVA', responsavel: MEUS, origem: 'INSTAGRAM' });
    expect(lerDoEndereco({ responsavel: 'Nenhum' }).responsavel).toBe(SEM_RESPONSAVEL);
    expect(lerDoEndereco({ responsavel: ID }).responsavel).toBe(ID);
    expect(lerDoEndereco({ situacao: 'X', responsavel: '../x', origem: 'TV' })).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({ origem: 'nao_informada' }).origem).toBe('NAO_INFORMADA');
  });

  test('ida e volta; trocar de visão leva só responsável e origem', () => {
    const f = { situacao: 'ACEITA' as const, responsavel: SEM_RESPONSAVEL, origem: 'GOOGLE' as const };
    expect(paraEndereco(f)).toEqual({ situacao: 'ACEITA', responsavel: 'nenhum', origem: 'GOOGLE' });
    expect(lerDoEndereco(paraEndereco(f))).toEqual(f);
    expect(paraEnderecoSemSituacao(f)).toEqual({ responsavel: 'nenhum', origem: 'GOOGLE' });
    expect(paraEndereco({ ...SEM_FILTROS, responsavel: MEUS })).toEqual({ meus: 'true' });
  });

  test('filtros da fila: meus ou responsável, nunca os dois', () => {
    expect(filtrosDaFila(SEM_FILTROS, ' ')).toEqual({ meus: false, busca: undefined, responsavel: undefined, origem: undefined });
    expect(filtrosDaFila({ ...SEM_FILTROS, responsavel: MEUS }, 'ana')).toEqual({ meus: true, busca: 'ana', responsavel: undefined, origem: undefined });
    expect(filtrosDaFila({ ...SEM_FILTROS, responsavel: ID, origem: 'NAO_INFORMADA' }, '').responsavel).toBe(ID);
  });

  test('a situação só aparece na Lista; Limpar na Kanban mantém a situação da Lista', () => {
    expect(filtrosVisiveis('lista')).toEqual(['situacao', 'responsavel', 'origem']);
    expect(filtrosVisiveis('kanban')).toEqual(['responsavel', 'origem']);
    const f = { situacao: 'NOVA' as const, responsavel: ID, origem: 'GOOGLE' as const };
    expect(chipsDosFiltros(f, 'lista', () => 'Bia').map((c) => c.texto)).toEqual(['Situação: Novas', 'Responsável: Bia', 'Origem: Google']);
    expect(chipsDosFiltros(f, 'kanban', () => 'Bia').map((c) => c.chave)).toEqual(['responsavel', 'origem']);
    expect(limpos(f, 'lista')).toEqual(SEM_FILTROS);
    expect(limpos(f, 'kanban')).toEqual({ ...SEM_FILTROS, situacao: 'NOVA' });
  });

  test('✕, outros filtros e opções', () => {
    const f = { situacao: 'NOVA' as const, responsavel: ID, origem: 'GOOGLE' as const };
    expect(semOFiltro(f, 'situacao').situacao).toBe('ABERTAS');
    expect(semOFiltro(f, 'responsavel').responsavel).toBe(TODOS);
    expect(semOFiltro(f, 'origem').origem).toBe('');
    expect(temOutrosFiltros({ ...SEM_FILTROS, responsavel: MEUS })).toBe(false);
    expect(temOutrosFiltros({ ...SEM_FILTROS, origem: 'GOOGLE' })).toBe(true);
    expect(opcoesDeResponsavel([{ id: 'eu-0000000', nome: 'Eu' }, { id: ID, nome: 'Bia' }], 'eu-0000000').map((o) => o.rotulo))
      .toEqual(['Toda a equipe', 'Meus', 'Bia', 'Sem responsável']);
  });
});
