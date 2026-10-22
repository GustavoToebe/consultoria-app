import type { PastaModelo, Receita } from '../api/tipos';
import { agruparPorColecao, filtrarModelos, resumoDeModelos, SEM_COLECAO } from './colecoes';

const m = (nome: string, pastaId: string | null, extra: Partial<Receita> = {}): Receita => ({
  id: nome, tipo: 'PLANO_TREINO', nome, descricao: null, conteudo: null, ordem: 0, pastaId, versao: 1, ...extra,
});
const c = (id: string, nome: string): PastaModelo => ({ id, nome, versao: 1 });
const nomes = (lista: readonly Receita[]) => lista.map((r) => r.nome);

describe('agruparPorColecao', () => {
  it('coleções em ordem alfabética, "Sem coleção" por último, ordem de dentro mantida', () => {
    const grupos = agruparPorColecao(
      [m('B', 'c2'), m('C', null), m('A', 'c2'), m('D', 'c1')],
      [c('c2', 'Hipertrofia'), c('c1', 'Avançados')],
    );
    expect(grupos.map((g) => [g.pastaId, g.rotulo])).toEqual([['c1', 'Avançados'], ['c2', 'Hipertrofia'], [null, SEM_COLECAO]]);
    expect(nomes(grupos[1].itens)).toEqual(['B', 'A']);
    expect(nomes(grupos[2].itens)).toEqual(['C']);
  });

  it('coleção sem modelo não aparece e sem modelo solto não há "Sem coleção"', () => {
    expect(agruparPorColecao([m('A', 'c1')], [c('c1', 'Base'), c('c2', 'Vazia')]).map((g) => g.rotulo)).toEqual(['Base']);
    expect(agruparPorColecao([], [c('c1', 'Base')])).toEqual([]);
  });

  it('modelo de coleção que não existe mais cai em "Sem coleção"', () => {
    const grupos = agruparPorColecao([m('A', 'sumiu')], []);
    expect(grupos.map((g) => g.rotulo)).toEqual([SEM_COLECAO]);
    expect(nomes(grupos[0].itens)).toEqual(['A']);
  });

  it('ordem alfabética em português: acento não manda para o fim', () => {
    const grupos = agruparPorColecao([m('A', 'c1'), m('B', 'c2'), m('C', 'c3')], [c('c1', 'Zinco'), c('c2', 'Água'), c('c3', 'base')]);
    expect(grupos.map((g) => g.rotulo)).toEqual(['Água', 'base', 'Zinco']);
  });
});

describe('resumoDeModelos', () => {
  it('singular e plural', () => {
    expect(resumoDeModelos(1)).toBe('1 modelo');
    expect(resumoDeModelos(13)).toBe('13 modelos');
  });
});

describe('filtrarModelos', () => {
  const lista = [
    m('Semana básica', null, { descricao: 'Iniciação' }),
    m('Semana avançada', 'c1'),
    m('Dieta base', null, { tipo: 'PLANO_DIETA' }),
  ];

  it('só do tipo; busca vazia (ou só espaços) traz todos', () => {
    expect(nomes(filtrarModelos(lista, 'PLANO_TREINO', ''))).toEqual(['Semana básica', 'Semana avançada']);
    expect(nomes(filtrarModelos(lista, 'PLANO_TREINO', '  '))).toEqual(['Semana básica', 'Semana avançada']);
    expect(nomes(filtrarModelos(lista, 'PLANO_DIETA', ''))).toEqual(['Dieta base']);
    expect(filtrarModelos(lista, 'MOBILIDADE', '')).toEqual([]);
  });

  it('sem acento nem caixa, no nome e na descrição', () => {
    expect(nomes(filtrarModelos(lista, 'PLANO_TREINO', 'BASICA'))).toEqual(['Semana básica']);
    expect(nomes(filtrarModelos(lista, 'PLANO_TREINO', 'iniciação'))).toEqual(['Semana básica']);
    expect(nomes(filtrarModelos(lista, 'PLANO_TREINO', 'avancada'))).toEqual(['Semana avançada']);
    expect(filtrarModelos(lista, 'PLANO_TREINO', 'xyz')).toEqual([]);
  });
});
