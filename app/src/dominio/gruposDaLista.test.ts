import { agruparLista, contagemDoGrupo, sugerirGrupos, TITULO_DO_ALUNO, TITULO_SEM_GRUPO, tituloDoGrupoNoPdf } from './gruposDaLista';

/** Itens fictícios: nome, grupo e se o aluno acrescentou. */
type Item = { nome: string; grupo?: string | null; aluno?: boolean };
const agrupar = (itens: Item[]) => agruparLista(itens, (i) => i.grupo, (i) => !!i.aluno);
const resumo = (itens: Item[]) => agrupar(itens).map((g) => [g.titulo, g.itens.map((i) => i.nome)]);

describe('agruparLista', () => {
  it('grupos em ordem alfabética sem acento, "Outros itens" e depois "Adicionados por você", sem mudar a ordem de dentro', () => {
    expect(resumo([
      { nome: 'Arroz', grupo: 'Cereais e derivados' },
      { nome: 'Café', aluno: true, grupo: 'Bebidas' },
      { nome: 'Frango', grupo: 'Carnes e derivados' },
      { nome: 'Sal' },
      { nome: 'Aveia', grupo: 'Cereais e derivados' },
      { nome: 'Abóbora', grupo: 'Água e derivados' },
      { nome: 'Pimenta', grupo: '  ' },
      { nome: 'Sabão', aluno: true },
    ])).toEqual([
      ['Água e derivados', ['Abóbora']],
      ['Carnes e derivados', ['Frango']],
      ['Cereais e derivados', ['Arroz', 'Aveia']],
      [TITULO_SEM_GRUPO, ['Sal', 'Pimenta']],
      [TITULO_DO_ALUNO, ['Café', 'Sabão']],
    ]);
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
