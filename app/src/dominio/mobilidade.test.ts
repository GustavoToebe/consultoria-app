import { mobilidadeParaApi, mobilidadeValida, normalizarMobilidade, novaSecaoMobilidade } from './mobilidade';

it('normaliza o conteúdo da API com campos nulos e cria uma seção quando vem vazio', () => {
  expect(normalizarMobilidade(null).secoes).toHaveLength(1);
  const c = normalizarMobilidade({ orientacoes: null, secoes: [{ uid: 'a', titulo: null, itens: [{ uid: 'b', nome: 'Lunge', prescricao: null, videoUrl: null }] }] });
  expect(c.orientacoes).toBe('');
  expect(c.secoes[0]).toEqual({ uid: 'a', titulo: '', itens: [{ uid: 'b', nome: 'Lunge', prescricao: '', videoUrl: '' }] });
});

it('envia texto aparado e vazio como nulo', () => {
  const c = { orientacoes: ' ', secoes: [{ uid: 'a', titulo: ' Alongamentos ', itens: [{ uid: 'b', nome: ' Lunge ', prescricao: '', videoUrl: ' ' }] }] };
  expect(mobilidadeParaApi(c)).toEqual({ orientacoes: null, secoes: [{ uid: 'a', titulo: 'Alongamentos', itens: [{ uid: 'b', nome: 'Lunge', prescricao: null, videoUrl: null }] }] });
});

it('só valida com nome em todo item e link do YouTube quando informado', () => {
  const base = novaSecaoMobilidade('X');
  expect(mobilidadeValida({ orientacoes: '', secoes: [base] })).toBe(false);
  base.itens[0].nome = 'Lunge';
  expect(mobilidadeValida({ orientacoes: '', secoes: [base] })).toBe(true);
  base.itens[0].videoUrl = 'https://exemplo.com/v';
  expect(mobilidadeValida({ orientacoes: '', secoes: [base] })).toBe(false);
  base.itens[0].videoUrl = 'https://youtu.be/abc';
  expect(mobilidadeValida({ orientacoes: '', secoes: [base] })).toBe(true);
  expect(mobilidadeValida({ orientacoes: '', secoes: [] })).toBe(false);
});
