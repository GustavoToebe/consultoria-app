import { aplicarModeloDeMobilidade, itemParaTela, mobilidadeParaApi, mobilidadeParaExibir, mobilidadeValida, normalizarMobilidade, novaSecaoMobilidade, secaoValida, temAbaMobilidade } from './mobilidade';

it('normaliza o conteúdo da API com campos nulos e cria uma seção quando vem vazio', () => {
  expect(normalizarMobilidade(null).secoes).toHaveLength(1);
  const c = normalizarMobilidade({ orientacoes: null, secoes: [{ uid: 'a', titulo: null, itens: [{ uid: 'b', nome: 'Lunge', prescricao: null, videoUrl: null }] }] });
  expect(c.orientacoes).toBe('');
  expect(c.secoes[0]).toEqual({ uid: 'a', titulo: '', itens: [{ uid: 'b', nome: 'Lunge', prescricao: '', videoUrl: '' }] });
});

it('usar modelo troca as seções por uma cópia com uids novos e mantém as orientações do plano', () => {
  const atual = { orientacoes: 'Do plano', secoes: [novaSecaoMobilidade('Antiga')] };
  const modelo = { orientacoes: 'Do modelo', secoes: [{ uid: 'a', titulo: 'Quadril', itens: [{ uid: 'b', nome: 'Lunge', prescricao: '2 x 20s', videoUrl: null }] }] };
  const c = aplicarModeloDeMobilidade(atual, modelo);
  expect(c.orientacoes).toBe('Do plano');
  expect(c.secoes).toHaveLength(1);
  expect(c.secoes[0]).toMatchObject({ titulo: 'Quadril', itens: [{ nome: 'Lunge', prescricao: '2 x 20s', videoUrl: '' }] });
  expect(c.secoes[0].uid).not.toBe('a');
  expect(c.secoes[0].itens[0].uid).not.toBe('b');
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
  expect(secaoValida(base)).toBe(true);
  expect(secaoValida({ ...base, itens: [...base.itens, { ...base.itens[0], uid: 'c', nome: ' ' }] })).toBe(false);
});

describe('mobilidade do aluno', () => {
  const versao = { id: 'v', planoId: 'p', numero: 1, titulo: 'M', inicio: null, fim: null, publicadoEm: '2026-10-01T10:00:00Z', conteudo: { orientacoes: null, secoes: [] } };

  it('a aba só existe quando há mobilidade publicada, a vigente ou a da pasta escolhida', () => {
    expect(temAbaMobilidade(null, null)).toBe(false);
    expect(temAbaMobilidade(versao, null)).toBe(true);
    expect(temAbaMobilidade(null, { mobilidade: versao })).toBe(true);
    expect(temAbaMobilidade(null, { mobilidade: null })).toBe(false);
    expect(temAbaMobilidade(null, {})).toBe(false); // sem o campo
  });

  it('com pasta escolhida mostra a dela (ou nada), nunca a vigente', () => {
    expect(mobilidadeParaExibir(versao, null)).toBe(versao);
    expect(mobilidadeParaExibir(versao, { mobilidade: null })).toBeNull();
    expect(mobilidadeParaExibir(null, { mobilidade: versao })).toBe(versao);
  });

  it('item sem prescrição mostra "—" e só link de vídeo válido vira botão', () => {
    expect(itemParaTela({ uid: 'a', nome: 'Gato e vaca', prescricao: null, videoUrl: null })).toEqual({ nome: 'Gato e vaca', prescricao: '—', video: null });
    expect(itemParaTela({ uid: 'a', nome: 'X', prescricao: ' ', videoUrl: 'https://exemplo.com/v' }).video).toBeNull();
    expect(itemParaTela({ uid: 'a', nome: 'X', prescricao: '2 x 20s', videoUrl: 'https://youtu.be/tsGPYSQbZx4' })).toEqual({ nome: 'X', prescricao: '2 x 20s', video: 'https://youtu.be/tsGPYSQbZx4' });
  });
});
