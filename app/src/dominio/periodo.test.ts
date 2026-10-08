import { periodoInicial } from './periodo';

it('começa hoje e termina depois de N dias contando o primeiro', () => {
  expect(periodoInicial('2026-02-15', 30)).toEqual({ inicio: '15/02/2026', fim: '16/03/2026' });
  expect(periodoInicial('2026-10-08', 1)).toEqual({ inicio: '08/10/2026', fim: '08/10/2026' });
});

it('sem prazo no cadastro só o início vem preenchido', () => {
  expect(periodoInicial('2026-10-08', null)).toEqual({ inicio: '08/10/2026', fim: '' });
  expect(periodoInicial('2026-10-08', undefined)).toEqual({ inicio: '08/10/2026', fim: '' });
  expect(periodoInicial('2026-10-08', 0)).toEqual({ inicio: '08/10/2026', fim: '' });
});
