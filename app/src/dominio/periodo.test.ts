import { cicloDoAluno, dadosDaRenovacao, diasDoPeriodo, fimQueAcompanha, periodoInicial, proximoPeriodo, textoDoCiclo } from './periodo';

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

describe('ciclo de atualização do aluno (reunião de 17/10)', () => {
  it('o do aluno vale; sem ele, o padrão da consultoria; sem nenhum, nulo', () => {
    expect(cicloDoAluno(15, 30)).toBe(15);
    expect(cicloDoAluno(null, 30)).toBe(30);
    expect(cicloDoAluno(undefined, null)).toBeNull();
  });

  it('texto da ficha diz quando vem do padrão', () => {
    expect(textoDoCiclo(15, 30)).toBe('15 dias');
    expect(textoDoCiclo(null, 30)).toBe('30 dias (padrão da consultoria)');
    expect(textoDoCiclo(null, null)).toBeNull();
  });
});

describe('fim que acompanha o início (pasta nova)', () => {
  it('conta os dias do período incluindo o primeiro e o último', () => {
    expect(diasDoPeriodo('01/11/2026', '15/11/2026')).toBe(15);
    expect(diasDoPeriodo('08/10/2026', '08/10/2026')).toBe(1);
    expect(diasDoPeriodo('30/12/2026', '05/01/2027')).toBe(7);
  });

  it('sem uma das datas ou com o fim antes do início não há duração', () => {
    expect(diasDoPeriodo('', '15/11/2026')).toBeNull();
    expect(diasDoPeriodo('01/11/2026', '')).toBeNull();
    expect(diasDoPeriodo('15/11/2026', '01/11/2026')).toBeNull();
    expect(diasDoPeriodo('31/02/2026', '15/11/2026')).toBeNull();
  });

  it('mudar o início leva o fim junto: início + dias - 1, inclusive na virada do mês e do ano', () => {
    expect(fimQueAcompanha('01/11/2026', 15)).toBe('15/11/2026');
    expect(fimQueAcompanha('25/11/2026', 15)).toBe('09/12/2026');
    expect(fimQueAcompanha('20/12/2026', 15)).toBe('03/01/2027');
    expect(fimQueAcompanha('08/10/2026', 1)).toBe('08/10/2026');
  });

  it('início incompleto ou sem duração não inventa data', () => {
    expect(fimQueAcompanha('01/11/20', 15)).toBeNull();
    expect(fimQueAcompanha('', 15)).toBeNull();
    expect(fimQueAcompanha('01/11/2026', null)).toBeNull();
    expect(fimQueAcompanha('01/11/2026', 0)).toBeNull();
  });
});
