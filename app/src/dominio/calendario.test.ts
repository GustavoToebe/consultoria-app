import { isoDoDia, mesDeIso, mudarMes, semanasDoMes } from './calendario';

describe('calendário', () => {
  it('monta 6 semanas de outubro de 2026, com os dias vizinhos nas pontas', () => {
    const semanas = semanasDoMes({ ano: 2026, mes: 9 });
    expect(semanas).toHaveLength(6);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(semanas[0].map((d) => d.dia)).toEqual([27, 28, 29, 30, 1, 2, 3]);
    expect(semanas[0].map((d) => d.doMes)).toEqual([false, false, false, false, true, true, true]);
    expect(semanas[0][0].iso).toBe('2026-09-27');
    expect(semanas[5][6].iso).toBe('2026-11-07');
  });

  it('fevereiro bissexto tem 29 dias do mês', () => {
    const dias = semanasDoMes({ ano: 2028, mes: 1 }).flat().filter((d) => d.doMes);
    expect(dias).toHaveLength(29);
  });

  it('muda de mês atravessando o ano', () => {
    expect(mudarMes({ ano: 2026, mes: 11 }, 1)).toEqual({ ano: 2027, mes: 0 });
    expect(mudarMes({ ano: 2026, mes: 0 }, -1)).toEqual({ ano: 2025, mes: 11 });
    expect(mudarMes({ ano: 2026, mes: 5 }, -12)).toEqual({ ano: 2025, mes: 5 });
  });

  it('converte de e para ISO', () => {
    expect(isoDoDia(2026, 9, 5)).toBe('2026-10-05');
    expect(mesDeIso('2026-10-05', '2000-01-01')).toEqual({ ano: 2026, mes: 9 });
    expect(mesDeIso(null, '2026-03-20')).toEqual({ ano: 2026, mes: 2 });
  });
});
