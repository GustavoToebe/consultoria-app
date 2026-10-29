import { agruparLista, contagemDoGrupo, GRUPOS_DO_CATALOGO_NA_ORDEM_DO_MERCADO, sugerirGrupos, TITULO_DO_ALUNO, TITULO_SEM_GRUPO, tituloDoGrupoNoPdf } from './gruposDaLista';

/** Itens fictícios: nome, grupo e se o aluno acrescentou. */
type Item = { nome: string; grupo?: string | null; aluno?: boolean };
const agrupar = (itens: Item[]) => agruparLista(itens, (i) => i.grupo, (i) => !!i.aluno);
const resumo = (itens: Item[]) => agrupar(itens).map((g) => [g.titulo, g.itens.map((i) => i.nome)]);

describe('agruparLista', () => {
  it('catálogo na ordem do mercado, grupo do treinador depois em ordem alfabética, "Outros itens" e "Adicionados por você" no fim, sem mudar a ordem de dentro', () => {
    expect(resumo([
      { nome: 'Arroz', grupo: 'Cereais e derivados' },
      { nome: 'Café', aluno: true, grupo: 'Bebidas (alcoólicas e não alcoólicas)' },
      { nome: 'Frango', grupo: 'Carnes e derivados' },
      { nome: 'Sal' },
      { nome: 'Aveia', grupo: 'Cereais e derivados' },
      { nome: 'Banana', grupo: 'Frutas e derivados' },
      { nome: 'Whey', grupo: 'Suplementos' },
      { nome: 'Alface', grupo: 'Verduras, hortaliças e derivados' },
      { nome: 'Abóbora', grupo: 'Água e derivados' },
      { nome: 'Pimenta', grupo: '  ' },
      { nome: 'Sabão', aluno: true },
    ])).toEqual([
      ['Verduras, hortaliças e derivados', ['Alface']],
      ['Frutas e derivados', ['Banana']],
      ['Carnes e derivados', ['Frango']],
      ['Cereais e derivados', ['Arroz', 'Aveia']],
      ['Água e derivados', ['Abóbora']],
      ['Suplementos', ['Whey']],
      [TITULO_SEM_GRUPO, ['Sal', 'Pimenta']],
      [TITULO_DO_ALUNO, ['Café', 'Sabão']],
    ]);
  });

  it('percorre o mercado: hortifrúti, carnes e ovos, pescados, leite, cereais, leguminosas, óleos, açúcares, bebidas e o resto', () => {
    const todos = GRUPOS_DO_CATALOGO_NA_ORDEM_DO_MERCADO.map((grupo) => ({ nome: grupo, grupo }));
    const embaralhados = [...todos].reverse();
    expect(agrupar(embaralhados).map((g) => g.titulo)).toEqual([...GRUPOS_DO_CATALOGO_NA_ORDEM_DO_MERCADO]);
    const ordem = (nome: string) => GRUPOS_DO_CATALOGO_NA_ORDEM_DO_MERCADO.indexOf(nome);
    const marcos = [
      'Verduras, hortaliças e derivados', 'Frutas e derivados', 'Carnes e derivados', 'Ovos e derivados', 'Pescados e frutos do mar',
      'Leite e derivados', 'Cereais e derivados', 'Leguminosas e derivados', 'Gorduras e óleos', 'Produtos açucarados',
      'Bebidas (alcoólicas e não alcoólicas)', 'Outros alimentos industrializados',
    ];
    expect(marcos.map(ordem)).toEqual([...marcos.map(ordem)].sort((a, b) => a - b));
    expect(marcos.every((m) => ordem(m) >= 0)).toBe(true);
  });

  it('o catálogo não tem nome repetido (sem acento e sem caixa)', () => {
    const chaves = GRUPOS_DO_CATALOGO_NA_ORDEM_DO_MERCADO.map((n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('o nome do catálogo vale sem acento e sem caixa e fica antes de qualquer grupo do treinador', () => {
    expect(resumo([
      { nome: 'Bolo', grupo: 'Doces caseiros' },
      { nome: 'Peixe', grupo: 'PESCADOS E FRUTOS DO MAR' },
      { nome: 'Soja', grupo: 'leguminosas e derivados' },
      { nome: 'Alface', grupo: 'verduras, hortalicas e derivados' },
      { nome: 'Barra', grupo: 'Barras' },
    ])).toEqual([
      ['verduras, hortalicas e derivados', ['Alface']],
      ['PESCADOS E FRUTOS DO MAR', ['Peixe']],
      ['leguminosas e derivados', ['Soja']],
      ['Barras', ['Barra']],
      ['Doces caseiros', ['Bolo']],
    ]);
  });

  it('grupos do treinador em ordem alfabética sem acento e sem caixa', () => {
    expect(agrupar([
      { nome: 'a', grupo: 'Zebra' },
      { nome: 'b', grupo: 'água' },
      { nome: 'c', grupo: 'Ótimos' },
      { nome: 'd', grupo: 'bolos' },
    ]).map((g) => g.titulo)).toEqual(['água', 'bolos', 'Ótimos', 'Zebra']);
  });

  it('caixa, acento e espaços não separam o grupo; vale o nome como apareceu primeiro', () => {
    expect(resumo([
      { nome: 'Leite', grupo: 'Laticínios' },
      { nome: 'Queijo', grupo: ' laticinios  ' },
      { nome: 'Iogurte', grupo: 'LATICÍNIOS' },
    ])).toEqual([['Laticínios', ['Leite', 'Queijo', 'Iogurte']]]);
  });

  it('grupo sem item não aparece; lista vazia = nenhum grupo', () => {
    expect(agrupar([])).toEqual([]);
    expect(agrupar([{ nome: 'Sal' }]).map((g) => g.chave)).toEqual(['sem-grupo']);
    expect(agrupar([{ nome: 'Café', aluno: true }]).map((g) => g.chave)).toEqual(['do-aluno']);
  });

  it('não perde nem repete item (a contagem "N de M" não muda)', () => {
    const itens: Item[] = [{ nome: 'a', grupo: 'X' }, { nome: 'b' }, { nome: 'c', aluno: true }, { nome: 'd', grupo: 'x' }];
    expect(agrupar(itens).flatMap((g) => g.itens)).toHaveLength(itens.length);
  });
});

describe('textos dos grupos', () => {
  it('contagem no cabeçalho e título no PDF', () => {
    expect(contagemDoGrupo(1)).toBe('1 item');
    expect(contagemDoGrupo(3)).toBe('3 itens');
    expect(tituloDoGrupoNoPdf({ titulo: 'Carnes e derivados', itens: [1, 2] })).toBe('Carnes e derivados (2)');
  });
});

describe('sugerirGrupos', () => {
  it('junta os da consultoria e os do catálogo sem repetir, filtra pelo digitado sem acento e some o que já está igual', () => {
    const daConsultoria = ['Proteínas', null, 'Carnes e derivados', 'proteinas'];
    const doCatalogo = ['Carnes e derivados', 'Cereais e derivados', 'Frutas e derivados'];
    expect(sugerirGrupos(daConsultoria, doCatalogo, '')).toEqual(['Carnes e derivados', 'Cereais e derivados', 'Frutas e derivados', 'Proteínas']);
    expect(sugerirGrupos(daConsultoria, doCatalogo, 'CER')).toEqual(['Cereais e derivados']);
    expect(sugerirGrupos(daConsultoria, doCatalogo, 'proteinas')).toEqual([]);
  });
});
