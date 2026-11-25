import {
  agruparPorCategoria, categoriaDeMesmoNome, categoriaDoItemDaEquipe, erroDoNomeDaCategoria, idsDepoisDeMoverNoGrupo, mensagemDeExcluirCategoria,
  mover, normalizarNomeDaCategoria, quantidadeDeItens, SEM_CATEGORIA, sugestoesDeCategoria,
} from './vitrineCategorias';
import { colunasDaVitrine, comPreco, DICA_DA_FOTO_DA_VITRINE, precoEspecialLiberado, rascunhoVazio } from './vitrine';

const CATS = [{ id: 'a', nome: 'Roupas' }, { id: 'b', nome: 'Calçados' }];

describe('nome da categoria', () => {
  test('normaliza como a API: pontas, caixa e acento', () => {
    expect(normalizarNomeDaCategoria('  Calçados ')).toBe('calcados');
  });
  test('vazio, longo e duplicado têm as mensagens fixas', () => {
    expect(erroDoNomeDaCategoria('   ', CATS)).toBe('Informe o nome da categoria.');
    expect(erroDoNomeDaCategoria('x'.repeat(41), CATS)).toBe('Use no máximo 40 caracteres.');
    expect(erroDoNomeDaCategoria('calcados', CATS)).toBe('Já existe uma categoria com esse nome.');
    expect(erroDoNomeDaCategoria('Calçados', CATS, 'b')).toBeNull();
    expect(erroDoNomeDaCategoria('Livros', CATS)).toBeNull();
  });
  test('acha a de mesmo nome', () => {
    expect(categoriaDeMesmoNome(CATS, 'ROUPAS')?.id).toBe('a');
    expect(categoriaDeMesmoNome(CATS, 'Rou')).toBeUndefined();
  });
});

describe('sugestões e textos', () => {
  test('sugestões só sem nenhuma categoria, pelo tipo', () => {
    expect(sugestoesDeCategoria('FISICO', 0)).toEqual(['Roupas', 'Calçados', 'Acessórios', 'Livros']);
    expect(sugestoesDeCategoria('DIGITAL', 0)).toEqual(['E-books', 'Cursos', 'Guias', 'Serviços']);
    expect(sugestoesDeCategoria('DIGITAL', 1)).toEqual([]);
  });
  test('contagem e exclusão', () => {
    expect(quantidadeDeItens(0)).toBe('Nenhum item');
    expect(quantidadeDeItens(1)).toBe('1 item');
    expect(quantidadeDeItens(12)).toBe('12 itens');
    expect(mensagemDeExcluirCategoria(12)).toBe('Os 12 itens continuam na vitrine, sem categoria.');
    expect(mensagemDeExcluirCategoria(1)).toBe('O item continua na vitrine, sem categoria.');
  });
});

describe('agrupar', () => {
  const item = (id: string, categoriaId: string | null, categoriaNome: string | null = categoriaId) => ({ id, categoriaId, categoriaNome });
  test('na ordem de chegada, sem categoria por último', () => {
    const grupos = agruparPorCategoria([item('1', null), item('2', 'a', 'Roupas'), item('3', 'b', 'Livros'), item('4', 'a', 'Roupas')], categoriaDoItemDaEquipe);
    expect(grupos.map((g) => [g.chave, g.titulo, g.itens.map((i) => i.id)])).toEqual([
      ['a', 'Roupas', ['2', '4']], ['b', 'Livros', ['3']], [null, SEM_CATEGORIA, ['1']],
    ]);
  });
  test('nenhum item com categoria: um grupo só, sem título', () => {
    expect(agruparPorCategoria([item('1', null), item('2', null)], categoriaDoItemDaEquipe)).toEqual([{ chave: null, titulo: null, itens: [item('1', null), item('2', null)] }]);
  });
  test('sem itens: nenhum grupo', () => {
    expect(agruparPorCategoria([], categoriaDoItemDaEquipe)).toEqual([]);
  });
  test('mover dentro do grupo devolve a lista completa na ordem de exibição', () => {
    const grupos = agruparPorCategoria([item('1', 'a'), item('2', 'a'), item('3', 'a'), item('4', null), item('5', 'b')], categoriaDoItemDaEquipe);
    expect(idsDepoisDeMoverNoGrupo(grupos, 'a', 0, 2)).toEqual(['2', '3', '1', '5', '4']);
    expect(idsDepoisDeMoverNoGrupo(grupos, 'a', 5, 0)).toEqual(['1', '2', '3', '5', '4']);
  });
  test('mover fora dos limites não muda', () => {
    expect(mover(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
    expect(mover(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });
});

describe('formulário e grade', () => {
  test('a dica da foto sai do limite real', () => {
    expect(DICA_DA_FOTO_DA_VITRINE).toBe('JPEG, até 300 KB');
  });
  test('apagar o preço apaga o especial e o prazo', () => {
    const r = { ...rascunhoVazio(), preco: '100,00', precoEspecial: '80,00', especialAte: '2099-01-01' };
    expect(comPreco(r, '')).toMatchObject({ preco: '', precoEspecial: '', especialAte: '' });
    expect(comPreco(r, '120,00')).toMatchObject({ preco: '120,00', precoEspecial: '80,00', especialAte: '2099-01-01' });
    expect(precoEspecialLiberado({ preco: ' ' })).toBe(false);
    expect(precoEspecialLiberado({ preco: '1,00' })).toBe(true);
  });
  test('colunas pela largura da grade', () => {
    expect(colunasDaVitrine(0)).toBe(1);
    expect(colunasDaVitrine(358)).toBe(1);
    expect(colunasDaVitrine(600)).toBe(2);
    expect(colunasDaVitrine(1000)).toBe(4);
    expect(colunasDaVitrine(1600)).toBe(6);
  });
});
