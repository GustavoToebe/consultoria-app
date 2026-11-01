import { chipsDosFiltros, lerDoEndereco, opcoesDePessoa, paraEndereco, pedidoDaApi, SEM_FILTROS, semOFiltro, SISTEMA } from './filtrosDeAuditoria';

const ACOES = { ALUNO_CRIADO: 'Aluno cadastrado', PERFIL_CRIADO: 'Perfil criado' };
const ID = 'u0000000-0000-4000-8000-000000000007';

describe('filtros da auditoria', () => {
  test('endereço: pessoas (e Sistema), ações do catálogo e período; o resto é ignorado', () => {
    expect(lerDoEndereco({}, ACOES)).toEqual(SEM_FILTROS);
    expect(lerDoEndereco({ usuarioId: `${ID},Sistema`, acao: 'aluno_criado,PERFIL_CRIADO,INVENTADA', de: '2026-10-01' }, ACOES))
      .toEqual({ pessoas: [ID, SISTEMA], acoes: ['ALUNO_CRIADO', 'PERFIL_CRIADO'], periodo: { de: '2026-10-01', ate: null } });
    expect(lerDoEndereco({ usuarioId: '../x', acao: 'INVENTADA', de: '2026-10-31', ate: '2026-10-01' }, ACOES)).toEqual(SEM_FILTROS);
  });

  test('ida e volta, pedido e chips', () => {
    const f = { pessoas: [ID, SISTEMA], acoes: ['ALUNO_CRIADO', 'PERFIL_CRIADO'], periodo: { de: '2026-10-01', ate: '2026-10-31' } };
    expect(paraEndereco(f)).toEqual({ usuarioId: `${ID},sistema`, acao: 'ALUNO_CRIADO,PERFIL_CRIADO', de: '2026-10-01', ate: '2026-10-31' });
    expect(lerDoEndereco(paraEndereco(f), ACOES)).toEqual(f);
    expect(pedidoDaApi(f)).toEqual({ de: '2026-10-01', ate: '2026-10-31', usuarioId: [ID, SISTEMA], acao: ['ALUNO_CRIADO', 'PERFIL_CRIADO'] });
    expect(pedidoDaApi(SEM_FILTROS)).toEqual({});
    expect(chipsDosFiltros(f, () => 'Bia', ACOES).map((c) => c.texto))
      .toEqual(['Pessoa: Bia, Sistema', 'Ação: Aluno cadastrado, Perfil criado', 'Período: 01/10/2026 a 31/10/2026']);
    expect(chipsDosFiltros({ ...SEM_FILTROS, pessoas: [ID] }, () => null, ACOES)[0].texto).toBe('Pessoa: Outra pessoa');
    expect(semOFiltro(f, 'pessoa').pessoas).toEqual([]);
    expect(semOFiltro(f, 'acao').acoes).toEqual([]);
    expect(semOFiltro(f, 'periodo').periodo).toEqual({ de: null, ate: null });
  });

  test('opções de pessoa: por nome e Sistema por último', () => {
    expect(opcoesDePessoa([{ id: 'b', nome: 'Bia' }, { id: 'a', nome: 'Ana' }]).map((o) => o.rotulo)).toEqual(['Ana', 'Bia', 'Sistema']);
  });
});
