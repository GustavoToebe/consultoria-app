import { dataSemAnoCorrente, periodoCurto } from './periodoCurto';

it('omite o ano corrente e mostra os outros', () => {
  expect(dataSemAnoCorrente('2026-10-07', '2026-10-19')).toBe('07/10');
  expect(dataSemAnoCorrente('2025-12-28', '2026-10-19')).toBe('28/12/2025');
  expect(dataSemAnoCorrente(null, '2026-10-19')).toBe('—');
  expect(periodoCurto({ inicio: '2026-10-07', fim: '2026-10-20' }, '2026-10-19')).toBe('07/10 a 20/10');
  expect(periodoCurto({ inicio: '2026-12-20', fim: '2027-01-10' }, '2026-10-19')).toBe('20/12 a 10/01/2027');
  expect(periodoCurto({ inicio: null, fim: '2026-10-20' }, '2026-10-19')).toBe('— a 20/10');
  expect(periodoCurto({ inicio: null, fim: null }, '2026-10-19')).toBeNull();
});
