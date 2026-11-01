import { chipsDosFiltros, filtrarMembros, SEM_FILTROS, semOFiltro, situacaoDoMembro } from './filtrosDeMembros';

const m = (nome: string, extra: Partial<{ email: string; perfilId: string; ativo: boolean; convitePendente: boolean }> = {}) =>
  ({ nome, email: `${nome.toLowerCase().split(' ')[0]}@exemplo.test`, perfilId: 'p-treinador', ativo: true, convitePendente: false, ...extra });
const MEMBROS = [
  m('João Fictício'),
  m('Bia Exemplo', { ativo: false, perfilId: 'p-assistente' }),
  m('Caio Teste', { convitePendente: true, ativo: false }),
];
const PERFIS = [{ id: 'p-treinador', nome: 'Treinador' }, { id: 'p-assistente', nome: 'Assistente' }];

describe('filtros dos membros', () => {
  test('situação como o selo: convite antes de ativo/inativo', () => {
    expect(MEMBROS.map(situacaoDoMembro)).toEqual(['ATIVO', 'INATIVO', 'CONVITE']);
  });

  test('busca por nome ou e-mail sem acento, situação e perfil em "ou"', () => {
    expect(filtrarMembros(MEMBROS, SEM_FILTROS, '')).toHaveLength(3);
    expect(filtrarMembros(MEMBROS, SEM_FILTROS, 'joao').map((x) => x.nome)).toEqual(['João Fictício']);
    expect(filtrarMembros(MEMBROS, SEM_FILTROS, 'bia@').map((x) => x.nome)).toEqual(['Bia Exemplo']);
    expect(filtrarMembros(MEMBROS, { situacoes: ['INATIVO', 'CONVITE'], perfis: [] }, '').map((x) => x.nome)).toEqual(['Bia Exemplo', 'Caio Teste']);
    expect(filtrarMembros(MEMBROS, { situacoes: [], perfis: ['p-assistente'] }, '').map((x) => x.nome)).toEqual(['Bia Exemplo']);
    expect(filtrarMembros(MEMBROS, { situacoes: ['ATIVO'], perfis: ['p-assistente'] }, '')).toEqual([]);
  });

  test('chips e ✕', () => {
    const f = { situacoes: ['CONVITE' as const, 'ATIVO' as const], perfis: ['p-assistente', 'sumiu'] };
    expect(chipsDosFiltros(f, PERFIS).map((c) => c.texto)).toEqual(['Situação: Ativos, Convite pendente', 'Perfil: Assistente, Outro perfil']);
    expect(semOFiltro(f, 'situacao').situacoes).toEqual([]);
    expect(semOFiltro(f, 'perfil').perfis).toEqual([]);
  });
});
