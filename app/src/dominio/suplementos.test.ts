import type { SuplementoDaBiblioteca } from '../api/tipos';
import {
  categoriasDe,
  descricaoDaPorcao,
  filtrarSuplementos,
  marcaECategoria,
  MAX_SABORES,
  nomeParaDieta,
  saboresDoTexto,
  saboresParaCampo,
  saboresParaTela,
} from './suplementos';

const s = (nome: string, extra: Partial<SuplementoDaBiblioteca> = {}): SuplementoDaBiblioteca => ({
  id: nome, nome, marca: 'Marca de Teste', categoria: null, porcao: null, porcoesPorEmbalagem: null, sabores: [], link: null, ...extra,
});

describe('porção', () => {
  it('junta porção e porções por embalagem', () => {
    expect(descricaoDaPorcao({ porcao: '2 dosadores (15g)', porcoesPorEmbalagem: '30' })).toBe('2 dosadores (15g) · 30 porções');
    expect(descricaoDaPorcao({ porcao: '35g (1 dosador)', porcoesPorEmbalagem: 'cerca de 26' })).toBe('35g (1 dosador) · cerca de 26 porções');
    expect(descricaoDaPorcao({ porcao: '1 cápsula', porcoesPorEmbalagem: '1' })).toBe('1 cápsula · 1 porção');
  });
  it('o que faltar é "—", sem inventar', () => {
    expect(descricaoDaPorcao({ porcao: '15g (1 colher de sopa)', porcoesPorEmbalagem: null })).toBe('15g (1 colher de sopa)');
    expect(descricaoDaPorcao({ porcao: null, porcoesPorEmbalagem: '30' })).toBe('— · 30 porções');
    expect(descricaoDaPorcao({ porcao: null, porcoesPorEmbalagem: null })).toBe('—');
    expect(descricaoDaPorcao({ porcao: '  ', porcoesPorEmbalagem: '  ' })).toBe('—');
  });
});

describe('textos do cartão', () => {
  it('sabores e marca/categoria', () => {
    expect(saboresParaTela(s('A', { sabores: ['Maracujá', 'Creme'] }))).toBe('Maracujá, Creme');
    expect(saboresParaTela(s('A'))).toBe('—');
    expect(marcaECategoria({ marca: 'Heavy Suppz', categoria: 'Whey' })).toBe('Heavy Suppz · Whey');
    expect(marcaECategoria({ marca: null, categoria: 'Whey' })).toBe('Whey');
    expect(marcaECategoria({ marca: null, categoria: null })).toBe('—');
  });
  it('nome da linha de dieta leva a marca', () => {
    expect(nomeParaDieta({ nome: 'Creatina', marca: 'Heavy Suppz' })).toBe('Creatina (Heavy Suppz)');
    expect(nomeParaDieta({ nome: 'Creatina', marca: null })).toBe('Creatina');
    expect(nomeParaDieta({ nome: 'Creatina', marca: ' ' })).toBe('Creatina');
  });
});

describe('sabores no formulário', () => {
  it('separa por vírgula, tira vazios e repetidos', () => {
    expect(saboresDoTexto('Maracujá,  Pink   Lemonade , , maracujá,Creme')).toEqual(['Maracujá', 'Pink Lemonade', 'Creme']);
    expect(saboresDoTexto('')).toEqual([]);
    expect(saboresParaCampo(['A', 'B'])).toBe('A, B');
  });
  it('respeita o máximo da API', () => {
    const muitos = Array.from({ length: MAX_SABORES + 5 }, (_, i) => `Sabor ${i}`).join(',');
    expect(saboresDoTexto(muitos)).toHaveLength(MAX_SABORES);
  });
});

describe('busca e categorias', () => {
  const lista = [
    s('Ômega 3', { categoria: 'Vitaminas e minerais' }),
    s('Creatina', { categoria: 'Creatina', marca: 'Outra' }),
    s('Sem categoria'),
  ];
  it('busca sem acento no nome e na marca', () => {
    expect(filtrarSuplementos(lista, 'omega', '').map((x) => x.nome)).toEqual(['Ômega 3']);
    expect(filtrarSuplementos(lista, 'OUTRA', '').map((x) => x.nome)).toEqual(['Creatina']);
    expect(filtrarSuplementos(lista, '', '')).toHaveLength(3);
  });
  it('filtra por categoria e junta com a busca', () => {
    expect(filtrarSuplementos(lista, '', 'Creatina').map((x) => x.nome)).toEqual(['Creatina']);
    expect(filtrarSuplementos(lista, 'omega', 'Creatina')).toEqual([]);
  });
  it('categorias distintas em ordem', () => {
    expect(categoriasDe(lista)).toEqual(['Creatina', 'Vitaminas e minerais']);
    expect(categoriasDe([])).toEqual([]);
  });
});
