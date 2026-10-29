import { CHAVES_DA_AGENDA } from '../tema/tokens';
import { horaDoPontoDaGrade, itensDaCelula, visaoDoAtalho } from './agendaCalendario';
import { ROTULOS_DAS_CORES_DA_AGENDA, textoDaRepeticaoDoEvento } from './agendaEvento';

/** Regras pequenas da tela da Agenda (passo 13): atalhos, "+N" do Mês, hora do clique na grade, nomes das cores e repetição por extenso. */

describe('visaoDoAtalho', () => {
  it('D, W, M e Y abrem Dia, Semana, Mês e Ano, também em maiúscula', () => {
    expect(['d', 'w', 'm', 'y'].map((t) => visaoDoAtalho(t))).toEqual(['dia', 'semana', 'mes', 'ano']);
    expect(visaoDoAtalho('M')).toBe('mes');
  });

  it('não vale com Ctrl, Alt ou Meta, com o foco num campo nem com algo aberto por cima', () => {
    expect(visaoDoAtalho('d', { ctrl: true })).toBeNull();
    expect(visaoDoAtalho('d', { alt: true })).toBeNull();
    expect(visaoDoAtalho('d', { meta: true })).toBeNull();
    expect(visaoDoAtalho('d', { emCampo: true })).toBeNull();
    expect(visaoDoAtalho('d', { sobreposto: true })).toBeNull();
  });

  it('outra tecla não é atalho', () => {
    expect(visaoDoAtalho('k')).toBeNull();
    expect(visaoDoAtalho('Enter')).toBeNull();
    expect(visaoDoAtalho('')).toBeNull();
  });
});

describe('itensDaCelula', () => {
  it('até o limite mostra todos', () => {
    expect(itensDaCelula([1, 2, 3], 3)).toEqual({ visiveis: [1, 2, 3], mais: 0 });
  });

  it('passou do limite: a última linha vira "+N" com o que sobrou', () => {
    expect(itensDaCelula([1, 2, 3, 4], 3)).toEqual({ visiveis: [1, 2], mais: 2 });
    expect(itensDaCelula([1, 2, 3, 4, 5, 6], 4)).toEqual({ visiveis: [1, 2, 3], mais: 3 });
  });

  it('limite 1 com mais itens: só o "+N"', () => {
    expect(itensDaCelula(['a', 'b'], 1)).toEqual({ visiveis: [], mais: 2 });
  });
});

describe('horaDoPontoDaGrade', () => {
  it('arredonda para baixo à meia hora', () => {
    expect(horaDoPontoDaGrade(0, 48)).toBe('00:00');
    expect(horaDoPontoDaGrade(48 * 9 + 10, 48)).toBe('09:00');
    expect(horaDoPontoDaGrade(48 * 9 + 24, 48)).toBe('09:30');
    expect(horaDoPontoDaGrade(48 * 14 + 47, 48, 15)).toBe('14:45');
  });

  it('fora da grade fica no primeiro ou no último passo do dia', () => {
    expect(horaDoPontoDaGrade(-20, 48)).toBe('00:00');
    expect(horaDoPontoDaGrade(48 * 30, 48)).toBe('23:30');
  });
});

describe('ROTULOS_DAS_CORES_DA_AGENDA', () => {
  it('toda cor da paleta tem nome', () => {
    for (const chave of CHAVES_DA_AGENDA) expect(ROTULOS_DAS_CORES_DA_AGENDA[chave]).toMatch(/^\p{Lu}/u);
    expect(Object.keys(ROTULOS_DAS_CORES_DA_AGENDA).sort()).toEqual([...CHAVES_DA_AGENDA].sort());
  });
});

describe('textoDaRepeticaoDoEvento', () => {
  const hoje = '2026-10-19';

  it('avulso', () => {
    expect(textoDaRepeticaoDoEvento(null, hoje)).toBe('Não se repete');
    expect(textoDaRepeticaoDoEvento({ tipo: 'NENHUMA' }, hoje)).toBe('Não se repete');
  });

  it('semanal com os dias na ordem da semana e a data final', () => {
    expect(textoDaRepeticaoDoEvento({ tipo: 'SEMANAL', diasDaSemana: ['WEDNESDAY', 'MONDAY'], ate: '2026-11-30' }, hoje))
      .toBe('Toda semana: segunda e quarta, até 30/11');
    expect(textoDaRepeticaoDoEvento({ tipo: 'SEMANAL', diasDaSemana: ['FRIDAY', 'MONDAY', 'WEDNESDAY'] }, hoje))
      .toBe('Toda semana: segunda, quarta e sexta, sem fim');
  });

  it('número de vezes e data de outro ano', () => {
    expect(textoDaRepeticaoDoEvento({ tipo: 'DIARIA', vezes: 10 }, hoje)).toBe('Todo dia, 10 vezes');
    expect(textoDaRepeticaoDoEvento({ tipo: 'MENSAL', ate: '2027-03-01' }, hoje)).toBe('Todo mês, até 01/03/2027');
    expect(textoDaRepeticaoDoEvento({ tipo: 'DIAS_UTEIS' }, hoje)).toBe('Dias úteis (segunda a sexta), sem fim');
    expect(textoDaRepeticaoDoEvento({ tipo: 'ANUAL', vezes: 3 }, hoje)).toBe('Todo ano, 3 vezes');
  });
});
