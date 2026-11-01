import {
  chipsDosFiltros, ehSoMeus, filtrosDaFila, filtrosVisiveis, lerDoEndereco, limpos, MEUS, opcoesDeResponsavel, paraEndereco,
  paraEnderecoSemSituacao, SEM_FILTROS, SEM_RESPONSAVEL, semOFiltro, temOutrosFiltros,
} from './filtrosDeInteressados';

const ID = 'u0000000-0000-4000-8000-000000000007';
const EU = 'e0000000-0000-4000-8000-000000000001';
const OUTUBRO = { de: '2026-10-01', ate: '2026-10-31' };

describe('filtros de Interessados', () => {
  test('endereço: situação, meus, pessoas e nenhum, origens, períodos; o desconhecido é ignorado', () => {
    expect(lerDoEndereco({})).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({ situacao: 'NOVA', meus: 'true', responsavel: ID, origem: 'INSTAGRAM' }))
      .toEqual({ ...SEM_FILTROS, situacao: 'NOVA', responsaveis: [MEUS], origens: ['INSTAGRAM'] });
    expect(lerDoEndereco({ responsavel: `Nenhum,${ID}` }).responsaveis).toEqual([SEM_RESPONSAVEL, ID]);
    expect(lerDoEndereco({ origem: 'nao_informada,GOOGLE,TV' }).origens).toEqual(['NAO_INFORMADA', 'GOOGLE']);
    expect(lerDoEndereco({ situacao: 'X', responsavel: '../x', origem: 'TV' })).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({ de: '2026-10-01', atividadeAte: '2026-10-31' }))
      .toEqual({ ...SEM_FILTROS, entrada: { de: '2026-10-01', ate: null }, atividade: { de: null, ate: '2026-10-31' } });
    // Fim antes do início não vale.
    expect(lerDoEndereco({ atividadeDe: '2026-10-31', atividadeAte: '2026-10-01' }).atividade).toEqual({ de: null, ate: null });
  });

  test('ida e volta; trocar de visão leva tudo menos a situação', () => {
    const f = { situacao: 'ACEITA' as const, responsaveis: [SEM_RESPONSAVEL, ID], origens: ['GOOGLE' as const, 'NAO_INFORMADA' as const],
      entrada: OUTUBRO, atividade: { de: '2026-10-15', ate: null } };
    expect(paraEndereco(f)).toEqual({ situacao: 'ACEITA', responsavel: `nenhum,${ID}`, origem: 'GOOGLE,NAO_INFORMADA',
      de: '2026-10-01', ate: '2026-10-31', atividadeDe: '2026-10-15' });
    expect(lerDoEndereco(paraEndereco(f))).toEqual(f);
    expect(paraEnderecoSemSituacao(f)).not.toHaveProperty('situacao');
    expect(paraEndereco({ ...SEM_FILTROS, responsaveis: [MEUS] })).toEqual({ meus: 'true' });
  });

  test('filtros da fila: só Meus = meus; Meus com outros vira o id; períodos e origens vão juntos', () => {
    expect(filtrosDaFila(SEM_FILTROS, ' ', EU)).toEqual({ meus: false, busca: undefined, responsavel: undefined, origem: undefined,
      de: undefined, ate: undefined, atividadeDe: undefined, atividadeAte: undefined });
    expect(filtrosDaFila({ ...SEM_FILTROS, responsaveis: [MEUS] }, 'ana', EU)).toMatchObject({ meus: true, busca: 'ana', responsavel: undefined });
    expect(filtrosDaFila({ ...SEM_FILTROS, responsaveis: [MEUS, SEM_RESPONSAVEL], origens: ['NAO_INFORMADA'], entrada: OUTUBRO }, '', EU))
      .toMatchObject({ meus: false, responsavel: [EU, SEM_RESPONSAVEL], origem: ['NAO_INFORMADA'], de: '2026-10-01', ate: '2026-10-31' });
    expect(ehSoMeus({ ...SEM_FILTROS, responsaveis: [MEUS] })).toBe(true);
    expect(ehSoMeus({ ...SEM_FILTROS, responsaveis: [MEUS, ID] })).toBe(false);
  });

  test('a situação só aparece na Lista; Limpar na Kanban mantém a situação da Lista', () => {
    expect(filtrosVisiveis('lista')).toEqual(['situacao', 'responsavel', 'origem', 'entrada', 'atividade']);
    expect(filtrosVisiveis('kanban')).toEqual(['responsavel', 'origem', 'entrada', 'atividade']);
    const f = { ...SEM_FILTROS, situacao: 'NOVA' as const, responsaveis: [ID, MEUS], origens: ['GOOGLE' as const, 'INSTAGRAM' as const],
      entrada: OUTUBRO, atividade: { de: '2026-10-20', ate: null } };
    expect(chipsDosFiltros(f, 'lista', () => 'Bia').map((c) => c.texto)).toEqual([
      'Situação: Novas', 'Responsável: Meus, Bia', 'Origem: Instagram, Google', 'Entrada: 01/10/2026 a 31/10/2026',
      'Última atividade: a partir de 20/10/2026',
    ]);
    expect(chipsDosFiltros(f, 'kanban', () => 'Bia').map((c) => c.chave)).toEqual(['responsavel', 'origem', 'entrada', 'atividade']);
    expect(limpos(f, 'lista')).toEqual(SEM_FILTROS);
    expect(limpos(f, 'kanban')).toEqual({ ...SEM_FILTROS, situacao: 'NOVA' });
  });

  test('✕, outros filtros e opções', () => {
    const f = { ...SEM_FILTROS, situacao: 'NOVA' as const, responsaveis: [ID], origens: ['GOOGLE' as const], entrada: OUTUBRO, atividade: OUTUBRO };
    expect(semOFiltro(f, 'situacao').situacao).toBe('ABERTAS');
    expect(semOFiltro(f, 'responsavel').responsaveis).toEqual([]);
    expect(semOFiltro(f, 'origem').origens).toEqual([]);
    expect(semOFiltro(f, 'entrada').entrada).toEqual({ de: null, ate: null });
    expect(semOFiltro(f, 'atividade').atividade).toEqual({ de: null, ate: null });
    expect(temOutrosFiltros({ ...SEM_FILTROS, responsaveis: [MEUS] })).toBe(false);
    expect(temOutrosFiltros({ ...SEM_FILTROS, origens: ['GOOGLE'] })).toBe(true);
    expect(temOutrosFiltros({ ...SEM_FILTROS, atividade: OUTUBRO })).toBe(true);
    expect(opcoesDeResponsavel([{ id: 'eu-0000000', nome: 'Eu' }, { id: ID, nome: 'Bia' }], 'eu-0000000').map((o) => o.rotulo))
      .toEqual(['Meus', 'Bia', 'Sem responsável']);
  });
});
