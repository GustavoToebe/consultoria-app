import { comMaiuscula, dataRelativa, dataSemAnoCorrente, instanteRelativo, periodoCurto } from './datasRelativas';

const HOJE = '2026-10-19';

describe('dataRelativa', () => {
  it('perto de hoje vira palavra', () => {
    expect(dataRelativa('2026-10-19', HOJE)).toBe('hoje');
    expect(dataRelativa('2026-10-20', HOJE)).toBe('amanhã');
    expect(dataRelativa('2026-10-18', HOJE)).toBe('ontem');
    expect(dataRelativa('2026-10-22', HOJE)).toBe('em 3 dias');
    expect(dataRelativa('2026-10-12', HOJE)).toBe('há 7 dias');
  });
  it('longe vira data curta, com ano só se for outro', () => {
    expect(dataRelativa('2026-11-15', HOJE)).toBe('15/11');
    expect(dataRelativa('2026-10-11', HOJE)).toBe('11/10');
    expect(dataRelativa('2025-12-30', HOJE)).toBe('30/12/2025');
  });
  it('ausente é "—"; aceita instante com hora', () => {
    expect(dataRelativa(null, HOJE)).toBe('—');
    expect(dataRelativa('2026-10-19T10:00:00Z', HOJE)).toBe('hoje');
  });
});

describe('dataSemAnoCorrente e periodoCurto', () => {
  it('omite o ano corrente', () => {
    expect(dataSemAnoCorrente('2026-09-20', HOJE)).toBe('20/09');
    expect(dataSemAnoCorrente('2027-01-02', HOJE)).toBe('02/01/2027');
  });
  it('período sem ano no ano corrente; com ano nas duas pontas se alguma for de outro ano', () => {
    expect(periodoCurto('2026-09-20', '2026-10-19', HOJE)).toBe('20/09 a 19/10');
    expect(periodoCurto('2026-12-01', '2027-01-15', HOJE)).toBe('01/12/2026 a 15/01/2027');
    expect(periodoCurto(null, null, HOJE)).toBe('Sem período');
    expect(periodoCurto('2026-09-20', null, HOJE)).toBe('20/09 a —');
  });
});

describe('instanteRelativo', () => {
  const agora = new Date(2026, 9, 19, 20, 0);
  it('hoje e ontem com a hora', () => {
    expect(instanteRelativo(new Date(2026, 9, 19, 18, 47).toISOString(), agora)).toBe('Hoje, 18:47');
    expect(instanteRelativo(new Date(2026, 9, 18, 9, 5).toISOString(), agora)).toBe('Ontem, 09:05');
  });
  it('antes disso, data curta e hora', () => {
    expect(instanteRelativo(new Date(2026, 9, 10, 7, 30).toISOString(), agora)).toBe('10/10 07:30');
    expect(instanteRelativo(null, agora)).toBe('—');
  });
});

describe('comMaiuscula', () => {
  it('só a primeira letra', () => {
    expect(comMaiuscula('em 3 dias')).toBe('Em 3 dias');
    expect(comMaiuscula('')).toBe('');
  });
});
