import { inicioAntesDoMesCorrente, textoDaPrevia } from './contratarNoPassado';

const semEspaco = (t: string) => t.replace(/ /g, ' ');

describe('início antes do mês corrente (D10)', () => {
  it('só um mês anterior ao de hoje (Brasília) mostra o interruptor', () => {
    expect(inicioAntesDoMesCorrente('2026-09-30', '2026-10-01')).toBe(true);
    expect(inicioAntesDoMesCorrente('2025-12-15', '2026-01-10')).toBe(true);
    expect(inicioAntesDoMesCorrente('2026-10-01', '2026-10-19')).toBe(false);
    expect(inicioAntesDoMesCorrente('2026-11-05', '2026-10-19')).toBe(false);
    expect(inicioAntesDoMesCorrente(null, '2026-10-19')).toBe(false);
    expect(inicioAntesDoMesCorrente(undefined, '2026-10-19')).toBe(false);
  });
  it('o padrão é o hoje de Brasília: 03h UTC do dia 1º ainda é o mês anterior lá', () => {
    // 01/11 às 02:00 UTC = 31/10 às 23:00 em Brasília: outubro ainda é o mês corrente.
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T02:00:00Z'));
    try {
      expect(inicioAntesDoMesCorrente('2026-10-05')).toBe(false);
      expect(inicioAntesDoMesCorrente('2026-09-05')).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('texto da prévia', () => {
  it('só formata o que a API mandou: quantidade, total e o período', () => {
    expect(semEspaco(textoDaPrevia({ quantidade: 3, totalCentavos: 45_000, primeiraCompetencia: '2026-08', ultimaCompetencia: '2026-10' })))
      .toBe('3 mensalidades vão nascer em aberto, total R$ 450,00 (08/2026 a 10/2026).');
    expect(semEspaco(textoDaPrevia({ quantidade: 1, totalCentavos: 15_000, primeiraCompetencia: '2026-09', ultimaCompetencia: '2026-09' })))
      .toBe('1 mensalidade vai nascer em aberto, total R$ 150,00 (09/2026).');
    // Total que não é quantidade × valor (valor por mês diferente): o app não confere nem refaz a conta.
    expect(semEspaco(textoDaPrevia({ quantidade: 2, totalCentavos: 12_345, primeiraCompetencia: null, ultimaCompetencia: null })))
      .toBe('2 mensalidades vão nascer em aberto, total R$ 123,45.');
  });
  it('quantidade 0: nada nasce além do que já existe', () => {
    expect(textoDaPrevia({ quantidade: 0, totalCentavos: 0, primeiraCompetencia: null, ultimaCompetencia: null }))
      .toBe('Nenhuma mensalidade nova vai nascer: o período já tem cobrança.');
  });
});
