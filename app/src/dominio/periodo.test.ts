import { dadosDaRenovacao, periodoInicial, proximoPeriodo } from './periodo';

it('começa hoje e termina depois de N dias contando o primeiro', () => {
  expect(periodoInicial('2026-02-15', 30)).toEqual({ inicio: '15/02/2026', fim: '16/03/2026' });
  expect(periodoInicial('2026-10-08', 1)).toEqual({ inicio: '08/10/2026', fim: '08/10/2026' });
});

it('sem prazo no cadastro só o início vem preenchido', () => {
  expect(periodoInicial('2026-10-08', null)).toEqual({ inicio: '08/10/2026', fim: '' });
  expect(periodoInicial('2026-10-08', undefined)).toEqual({ inicio: '08/10/2026', fim: '' });
  expect(periodoInicial('2026-10-08', 0)).toEqual({ inicio: '08/10/2026', fim: '' });
});

it('próximo ciclo começa no dia seguinte ao fim e dura o mesmo tanto', () => {
  expect(proximoPeriodo({ inicio: '2026-10-01', fim: '2026-10-30' })).toEqual({ inicio: '31/10/2026', fim: '29/11/2026' });
  expect(proximoPeriodo({ inicio: null, fim: '2026-10-30' })).toEqual({ inicio: '31/10/2026', fim: '' });
  expect(proximoPeriodo({ inicio: '2026-10-01', fim: null })).toEqual({ inicio: '', fim: '' });
});

describe('renovar pasta', () => {
  it('usa o próximo ciclo da pasta, com datas ISO para a API', () => {
    expect(dadosDaRenovacao({ titulo: 'Plano 16', inicio: '2026-10-01', fim: '2026-10-30' }, '2026-10-13', 28)).toEqual({
      titulo: 'Plano 16 (renovada)', inicio: '2026-10-31', fim: '2026-11-29', texto: '31/10/2026 a 29/11/2026',
    });
  });

  it('pasta sem fim parte de hoje pelo ciclo do aluno; sem ciclo, só o início', () => {
    expect(dadosDaRenovacao({ titulo: 'Plano', inicio: null, fim: null }, '2026-10-13', 30)).toMatchObject({
      inicio: '2026-10-13', fim: '2026-11-11', texto: '13/10/2026 a 11/11/2026',
    });
    expect(dadosDaRenovacao({ titulo: 'Plano', inicio: null, fim: null }, '2026-10-13', null)).toMatchObject({
      inicio: '2026-10-13', fim: null, texto: 'a partir de 13/10/2026',
    });
  });

  it('o título respeita o limite de 120 caracteres da API', () => {
    expect(dadosDaRenovacao({ titulo: 'x'.repeat(120), inicio: null, fim: null }, '2026-10-13', 7).titulo).toHaveLength(120);
  });
});
