import { chipsDosFiltros, lerDoEndereco, paraEndereco, pedidoDaApi, SEM_FILTROS, semOFiltro } from './filtrosDeAuditoria';

const ACOES = { ALUNO_CRIADO: 'Aluno cadastrado' };
const ID = 'u0000000-0000-4000-8000-000000000007';

describe('filtros da auditoria', () => {
  test('endereço: pessoa, ação do catálogo e período; o resto é ignorado', () => {
    expect(lerDoEndereco({}, ACOES)).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({ usuarioId: ID, acao: 'aluno_criado', de: '2026-10-01' }, ACOES))
      .toEqual({ usuarioId: ID, acao: 'ALUNO_CRIADO', periodo: { de: '2026-10-01', ate: null } });
    expect(lerDoEndereco({ usuarioId: '../x', acao: 'INVENTADA', de: '2026-10-31', ate: '2026-10-01' }, ACOES)).toEqual(SEM_FILTROS);
  });

  test('ida e volta, pedido e chips', () => {
    const f = { usuarioId: ID, acao: 'ALUNO_CRIADO', periodo: { de: '2026-10-01', ate: '2026-10-31' } };
    expect(lerDoEndereco(paraEndereco(f), ACOES)).toEqual(f);
    expect(pedidoDaApi(f)).toEqual({ de: '2026-10-01', ate: '2026-10-31', usuarioId: ID, acao: 'ALUNO_CRIADO' });
    expect(pedidoDaApi(SEM_FILTROS)).toEqual({});
    expect(chipsDosFiltros(f, () => 'Bia', ACOES).map((c) => c.texto)).toEqual(['Pessoa: Bia', 'Ação: Aluno cadastrado', 'Período: 01/10/2026 a 31/10/2026']);
    expect(chipsDosFiltros(f, () => null, ACOES)[0].texto).toBe('Pessoa: Outra pessoa');
    expect(semOFiltro(f, 'pessoa').usuarioId).toBe('');
    expect(semOFiltro(f, 'acao').acao).toBe('');
    expect(semOFiltro(f, 'periodo').periodo).toEqual({ de: null, ate: null });
  });
});
