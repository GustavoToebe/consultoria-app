// agenda: criar unificado (23/11)
import { dicaDaGradeVazia, horarioSugerido, textoDaDuracaoDoHorario, textoDasPerdas, trocarTipoDaCriacao } from './agendaCriacao';
import { formularioDeEventoNovo } from './agendaEvento';
import { erroDoFim, fimDaHora, formularioNovo, inicioMudou, LIMITES_COMPROMISSO, opcaoDigitadaDoFim } from './agendaPresencial';

const HOJE = '2026-11-23';

describe('horarioSugerido', () => {
  it('arredonda para a próxima meia hora; meia hora em ponto fica', () => {
    expect(horarioSugerido(HOJE, HOJE, 14 * 60 + 10)).toEqual({ data: HOJE, hora: '14:30' });
    expect(horarioSugerido(HOJE, HOJE, 14 * 60 + 30)).toEqual({ data: HOJE, hora: '14:30' });
    expect(horarioSugerido(HOJE, HOJE, 0)).toEqual({ data: HOJE, hora: '00:00' });
  });
  it('em hoje, depois das 23:30 vira o dia seguinte às 00:00', () => {
    expect(horarioSugerido(HOJE, HOJE, 23 * 60 + 50)).toEqual({ data: '2026-11-24', hora: '00:00' });
    expect(horarioSugerido('2026-12-31', '2026-12-31', 23 * 60 + 31)).toEqual({ data: '2027-01-01', hora: '00:00' });
  });
  it('noutro dia a data fica e só a hora volta ao relógio', () => {
    expect(horarioSugerido('2026-11-30', HOJE, 23 * 60 + 50)).toEqual({ data: '2026-11-30', hora: '00:00' });
    expect(horarioSugerido('2026-11-30', HOJE, 9 * 60 + 1)).toEqual({ data: '2026-11-30', hora: '09:30' });
  });
});

describe('fim acompanha o início (duração mantida)', () => {
  it('mudar o início mantém a duração e o fim anda junto, inclusive pela meia-noite', () => {
    const f = { ...formularioNovo('r1', HOJE, '09:00') };
    expect(fimDaHora(f.hora, f.duracao)).toBe('10:00');
    const depois = inicioMudou(f, '23:30');
    expect(depois.duracao).toBe('60');
    expect(fimDaHora(depois.hora, depois.duracao)).toBe('00:30');
    expect(textoDaDuracaoDoHorario(depois.hora, depois.duracao)).toBe('1 h, dia seguinte');
  });
  it('fim digitado antes do início é o dia seguinte; fim igual ao início é recusado no compromisso', () => {
    const opcao = opcaoDigitadaDoFim('22:00', '01:00', LIMITES_COMPROMISSO);
    expect(opcao && 'opcao' in opcao ? opcao.opcao.diaSeguinte : null).toBe(true);
    expect(erroDoFim('09:00', '09:00', LIMITES_COMPROMISSO)).toBe('O fim precisa ser depois do início.');
  });
  it('a duração escrita', () => {
    expect(textoDaDuracaoDoHorario('09:00', '60')).toBe('1 h');
    expect(textoDaDuracaoDoHorario('09:00', '45')).toBe('45 min');
    expect(textoDaDuracaoDoHorario('09:00', '90')).toBe('1 h 30 min');
    expect(textoDaDuracaoDoHorario('', '60')).toBeNull();
    expect(textoDaDuracaoDoHorario('09:00', '')).toBeNull();
  });
});

describe('trocarTipoDaCriacao', () => {
  const compromisso = () => ({ ...formularioNovo('r1', HOJE, '09:00'), local: 'Sala 2', observacao: 'Trazer a ficha' });
  const evento = () => formularioDeEventoNovo('ag1', HOJE, '');

  it('do compromisso para o evento leva data, horário, local e observação (vira descrição)', () => {
    const c = { ...compromisso(), data: '24/11/2026', hora: '10:15', duracao: '45' };
    const r = trocarTipoDaCriacao('evento', c, evento(), true);
    expect(r.evento).toMatchObject({ data: '24/11/2026', hora: '10:15', duracao: '45', local: 'Sala 2', descricao: 'Trazer a ficha', titulo: '', agendaId: 'ag1' });
    expect(r.compromisso).toBe(c);
    expect(r.perdas).toEqual([]);
  });
  it('alunos e repetição do compromisso ficam nele (perdas)', () => {
    const c = { ...compromisso(), alunoIds: ['a1', 'a2'], repeticao: { tipo: 'SEMANAL' as const, dias: ['MONDAY' as const], fim: 'VEZES' as const, ate: '', vezes: '4' } };
    const r = trocarTipoDaCriacao('evento', c, evento(), true);
    expect(r.perdas).toEqual(['alunos', 'repetição']);
    expect(r.evento.repeticao.tipo).toBe('NENHUMA');
    expect(textoDasPerdas('evento', r.perdas)).toBe('Fica só no compromisso: alunos e repetição.');
    expect(trocarTipoDaCriacao('evento', { ...c, alunoIds: ['a1'], repeticao: compromisso().repeticao }, evento(), true).perdas).toEqual(['aluno']);
  });
  it('sem a permissão da observação, o evento mantém a descrição que já tinha', () => {
    const e = { ...evento(), descricao: 'minha nota' };
    expect(trocarTipoDaCriacao('evento', { ...compromisso(), observacao: '' }, e, false).evento.descricao).toBe('minha nota');
  });

  it('do evento para o compromisso: título, repetição e dia inteiro entram em perdas; aluno e responsável ficam', () => {
    const c = { ...compromisso(), alunoIds: ['a9'] };
    const e = { ...evento(), titulo: 'Dentista', diaInteiro: true, hora: '08:00', duracao: '60', descricao: 'curta',
      repeticao: { tipo: 'DIARIA' as const, dias: [], fim: 'NUNCA' as const, ate: '', vezes: '' } };
    const r = trocarTipoDaCriacao('compromisso', c, e, true);
    expect(r.perdas).toEqual(['título', 'repetição', 'dia inteiro']);
    expect(r.compromisso).toMatchObject({ alunoIds: ['a9'], responsavelId: 'r1', hora: '08:00', duracao: '60', observacao: 'curta' });
    expect(textoDasPerdas('compromisso', r.perdas)).toBe('Fica só no evento pessoal: título, repetição e dia inteiro.');
  });
  it('duração acima do máximo do compromisso volta a 1 h e avisa', () => {
    const r = trocarTipoDaCriacao('compromisso', compromisso(), { ...evento(), hora: '09:00', duracao: '600' }, true);
    expect(r.compromisso.duracao).toBe('60');
    expect(r.perdas).toEqual(['duração']);
  });
  it('descrição longa ou sem campo de observação conta como perda', () => {
    const longa = 'x'.repeat(LIMITES_COMPROMISSO.observacao + 1);
    const r = trocarTipoDaCriacao('compromisso', compromisso(), { ...evento(), descricao: longa }, true);
    expect(r.compromisso.observacao).toHaveLength(LIMITES_COMPROMISSO.observacao);
    expect(r.perdas).toEqual(['descrição']);
    const sem = trocarTipoDaCriacao('compromisso', { ...compromisso(), observacao: '' }, { ...evento(), descricao: 'nota' }, false);
    expect(sem.compromisso.observacao).toBe('');
    expect(sem.perdas).toEqual(['descrição']);
  });
  it('sem nada digitado não há perdas nem aviso', () => {
    expect(trocarTipoDaCriacao('compromisso', compromisso(), evento(), true).perdas).toEqual([]);
    expect(textoDasPerdas('evento', [])).toBeNull();
  });
});

describe('dicaDaGradeVazia', () => {
  it('só fala em clicar quando o clique cria', () => {
    expect(dicaDaGradeVazia('semana', true)).toBe('Nenhum compromisso nesta semana. Clique num horário para criar.');
    expect(dicaDaGradeVazia('semana', false)).toBe('Nenhum compromisso nesta semana.');
    expect(dicaDaGradeVazia('dia', true)).toBe('Nenhum compromisso neste dia. Clique num horário para criar.');
    expect(dicaDaGradeVazia('dia', false)).toBe('Nenhum compromisso neste dia.');
  });
});
