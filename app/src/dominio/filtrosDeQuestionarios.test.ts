import { arquivadosDaApi, chipsDosFiltros, filtrarQuestionarios, SEM_FILTROS, semOFiltro } from './filtrosDeQuestionarios';

const q = (nome: string, versaoPublicada: number, alteradoDesdePublicacao = false, descricao: string | null = null) =>
  ({ nome, descricao, versaoPublicada, alteradoDesdePublicacao });
const LISTA = [q('Check-in semanal', 3), q('Anamnese inicial', 0), q('Mensal', 1, true, 'Revisão do mês')];

describe('filtros dos questionários', () => {
  test('busca no nome e na descrição, sem acento', () => {
    expect(filtrarQuestionarios(LISTA, SEM_FILTROS, 'revisao').map((x) => x.nome)).toEqual(['Mensal']);
    expect(filtrarQuestionarios(LISTA, SEM_FILTROS, '')).toHaveLength(3);
  });

  test('publicação', () => {
    expect(filtrarQuestionarios(LISTA, { ...SEM_FILTROS, publicacao: 'PUBLICADOS' }, '').map((x) => x.nome)).toEqual(['Check-in semanal', 'Mensal']);
    expect(filtrarQuestionarios(LISTA, { ...SEM_FILTROS, publicacao: 'NUNCA_PUBLICADOS' }, '').map((x) => x.nome)).toEqual(['Anamnese inicial']);
    expect(filtrarQuestionarios(LISTA, { ...SEM_FILTROS, publicacao: 'ALTERADOS' }, '').map((x) => x.nome)).toEqual(['Mensal']);
  });

  test('chips: ativos é o padrão e não conta', () => {
    expect(chipsDosFiltros(SEM_FILTROS)).toEqual([]);
    const f = { situacao: 'ARQUIVADOS' as const, publicacao: 'ALTERADOS' as const };
    expect(chipsDosFiltros(f).map((c) => c.texto)).toEqual(['Situação: Arquivados', 'Publicação: Alterados desde a publicação']);
    expect(semOFiltro(f, 'situacao').situacao).toBe('ATIVOS');
    expect(semOFiltro(f, 'publicacao').publicacao).toBe('');
    expect(chipsDosFiltros({ ...SEM_FILTROS, situacao: 'TODOS' }).map((c) => c.texto)).toEqual(['Situação: Ativos e arquivados']);
  });

  test('situação vai à API: false, true ou todos', () => {
    expect(arquivadosDaApi('ATIVOS')).toBe(false);
    expect(arquivadosDaApi('ARQUIVADOS')).toBe(true);
    expect(arquivadosDaApi('TODOS')).toBe('todos');
  });
});
