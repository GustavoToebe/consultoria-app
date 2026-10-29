import type { Compromisso } from '../api/agendaTipos';
import type { AtualizacaoDaLista } from '../api/tipos';
import {
  acoesDeSituacao, conflitoNaLista, dataEmBrasilia, deslocarReferencia, diasDaAgenda, diasDoCompromisso, formularioDoCompromisso,
  formularioNovo, hojeEmBrasilia, horaEmBrasilia, horaValida, instanteDeBrasilia, intervaloDoPedido, lerDataDeReferencia, lerSituacao,
  lerVisao, mascaraHora, metadadosDoCompromisso, pedidoDoFormulario, periodoDaVisao, resumoDoDia, seloDaSituacao, sobrepoe,
  textoDaDuracao, textoDoHorario, textosDoCompromissoDoAluno, tituloDoPeriodo,
} from './agendaPresencial';

function compromisso(parcial: Partial<Compromisso> & Pick<Compromisso, 'id' | 'inicio' | 'fim'>): Compromisso {
  return {
    alunoId: 'a1', alunoNome: 'Aluna Fictícia', responsavelId: 'r1', responsavelNome: 'Ana', data: dataEmBrasilia(parcial.inicio),
    hora: horaEmBrasilia(parcial.inicio), horaFim: horaEmBrasilia(parcial.fim), duracaoMinutos: 60, local: null, observacao: null,
    situacao: 'AGENDADO', versao: 0, ...parcial,
  };
}

const atualizacao = (pastaId: string, data: string | null, nome = 'Aluno'): AtualizacaoDaLista =>
  ({ id: null, pastaId, alunoId: 'x', nomeAluno: nome, dataAtualizacao: data, fase: 'EM_DIA', diasParaData: 0, diasDeAtraso: 0, atrasoAte: null }) as unknown as AtualizacaoDaLista;

describe('fuso de Brasília', () => {
  it('converte instante para data e hora de Brasília (UTC−3), atravessando a meia-noite', () => {
    expect(dataEmBrasilia('2026-11-11T02:30:00Z')).toBe('2026-11-10');
    expect(horaEmBrasilia('2026-11-11T02:30:00Z')).toBe('23:30');
    expect(dataEmBrasilia('2026-11-11T03:00:00Z')).toBe('2026-11-11');
    expect(instanteDeBrasilia('2026-11-10', '23:30')).toBe('2026-11-11T02:30:00.000Z');
  });

  it('hoje é o de Brasília, não o do aparelho', () => {
    // 01:00 UTC do dia 11 ainda é 22:00 do dia 10 em Brasília.
    expect(hojeEmBrasilia(new Date('2026-11-11T01:00:00Z'))).toBe('2026-11-10');
    expect(hojeEmBrasilia(new Date('2026-11-11T03:00:00Z'))).toBe('2026-11-11');
  });
});

describe('sobreposição', () => {
  const base = { inicio: '2026-11-10T12:00:00Z', fim: '2026-11-10T13:00:00Z' };
  it('sobrepõe quando um começa antes de o outro terminar; encostar não conta', () => {
    expect(sobrepoe(base, { inicio: '2026-11-10T12:30:00Z', fim: '2026-11-10T13:30:00Z' })).toBe(true);
    expect(sobrepoe(base, { inicio: '2026-11-10T11:00:00Z', fim: '2026-11-10T14:00:00Z' })).toBe(true);
    expect(sobrepoe(base, { inicio: '2026-11-10T13:00:00Z', fim: '2026-11-10T13:30:00Z' })).toBe(false);
    expect(sobrepoe(base, { inicio: '2026-11-10T11:00:00Z', fim: '2026-11-10T12:00:00Z' })).toBe(false);
  });

  it('conflito na lista: mesmo responsável, não cancelado e não o próprio', () => {
    const lista = [
      compromisso({ id: 'c1', ...base }),
      compromisso({ id: 'c2', inicio: '2026-11-10T12:00:00Z', fim: '2026-11-10T13:00:00Z', situacao: 'CANCELADO' }),
      compromisso({ id: 'c3', inicio: '2026-11-10T12:00:00Z', fim: '2026-11-10T13:00:00Z', responsavelId: 'r2' }),
    ];
    const pedido = { responsavelId: 'r1', inicio: '2026-11-10T12:30:00Z', fim: '2026-11-10T13:30:00Z' };
    expect(conflitoNaLista(lista, pedido)?.id).toBe('c1');
    expect(conflitoNaLista(lista, { ...pedido, id: 'c1' })).toBeNull();
    expect(conflitoNaLista(lista, { ...pedido, responsavelId: 'r3' })).toBeNull();
  });
});

describe('visões Dia e Semana', () => {
  it('lê visão, data e situação do endereço com padrões seguros', () => {
    expect(lerVisao('dia')).toBe('dia');
    expect(lerVisao('mes')).toBe('semana');
    expect(lerVisao(undefined)).toBe('semana');
    expect(lerDataDeReferencia('2026-02-30', '2026-11-03')).toBe('2026-11-03');
    expect(lerDataDeReferencia('ontem', '2026-11-03')).toBe('2026-11-03');
    expect(lerDataDeReferencia('2026-12-01', '2026-11-03')).toBe('2026-12-01');
    expect(lerSituacao('FALTOU')).toBe('FALTOU');
    expect(lerSituacao('TODAS')).toBeNull();
  });

  it('semana = o dia e os 7 seguintes (como antes); setas andam 1 ou 7 dias', () => {
    expect(periodoDaVisao('dia', '2026-11-03')).toEqual({ de: '2026-11-03', ate: '2026-11-03' });
    expect(periodoDaVisao('semana', '2026-11-03')).toEqual({ de: '2026-11-03', ate: '2026-11-10' });
    expect(deslocarReferencia('dia', '2026-11-30', 1)).toBe('2026-12-01');
    expect(deslocarReferencia('semana', '2026-11-03', 1)).toBe('2026-11-10');
    expect(deslocarReferencia('semana', '2026-11-03', -1)).toBe('2026-10-27');
    expect(tituloDoPeriodo('dia', '2026-11-03', '2026-11-03')).toBe('Hoje, 03/11');
    expect(tituloDoPeriodo('semana', '2026-12-30', '2026-11-03')).toBe('30/12 a 06/01/2027');
  });

  it('compromisso que atravessa a meia-noite toca os dois dias', () => {
    const c = compromisso({ id: 'c', inicio: '2026-11-11T02:30:00Z', fim: '2026-11-11T03:30:00Z' });
    expect(diasDoCompromisso(c)).toEqual(['2026-11-10', '2026-11-11']);
    // Terminar exatamente à meia-noite não toca o dia seguinte.
    expect(diasDoCompromisso(compromisso({ id: 'd', inicio: '2026-11-11T02:00:00Z', fim: '2026-11-11T03:00:00Z' }))).toEqual(['2026-11-10']);
    expect(textoDoHorario(c)).toBe('23:30–00:30 (termina no dia seguinte)');
    expect(textoDoHorario(compromisso({ id: 'e', inicio: '2026-11-10T12:00:00Z', fim: '2026-11-10T13:00:00Z' }))).toBe('09:00–10:00');
  });

  it('agrupa por dia: todos os dias do período, compromissos por hora e atualizações por nome', () => {
    const tarde = compromisso({ id: 'tarde', inicio: '2026-11-03T18:00:00Z', fim: '2026-11-03T19:00:00Z' });
    const manha = compromisso({ id: 'manha', inicio: '2026-11-03T12:00:00Z', fim: '2026-11-03T13:00:00Z' });
    const madrugada = compromisso({ id: 'madrugada', inicio: '2026-11-05T02:30:00Z', fim: '2026-11-05T03:30:00Z' });
    const fora = compromisso({ id: 'fora', inicio: '2026-11-20T12:00:00Z', fim: '2026-11-20T13:00:00Z' });
    const dias = diasDaAgenda('2026-11-03', '2026-11-05', '2026-11-03', [tarde, manha, madrugada, fora],
      [atualizacao('p2', '2026-11-03', 'Zeca'), atualizacao('p1', '2026-11-03', 'Ana'), atualizacao('p3', null)]);
    expect(dias.map((d) => d.data)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', null]);
    expect(dias[0].titulo).toBe('Hoje, 03/11');
    expect(dias[0].compromissos.map((c) => c.id)).toEqual(['manha', 'tarde']);
    expect(dias[0].atualizacoes.map((a) => a.nomeAluno)).toEqual(['Ana', 'Zeca']);
    expect(dias[1].compromissos.map((c) => c.id)).toEqual(['madrugada']);
    expect(dias[2].compromissos.map((c) => c.id)).toEqual(['madrugada']);
    expect(dias[3].titulo).toBe('Sem data');
    // Período que não inclui hoje: atualização sem data não entra.
    expect(diasDaAgenda('2026-11-10', '2026-11-10', '2026-11-03', [], [atualizacao('p3', null)]).map((d) => d.data)).toEqual(['2026-11-10']);
  });

  it('resumo do dia', () => {
    expect(resumoDoDia(0, 0)).toBe('Nada marcado');
    expect(resumoDoDia(1, 0)).toBe('1 compromisso');
    expect(resumoDoDia(2, 1)).toBe('2 compromissos · 1 atualização');
    expect(resumoDoDia(0, 3)).toBe('3 atualizações');
  });
});

describe('textos', () => {
  it('selo da situação com texto e cor de significado (nunca a marca)', () => {
    expect(seloDaSituacao('AGENDADO')).toEqual({ texto: 'Agendado', tipo: 'atencao' });
    expect(seloDaSituacao('REALIZADO')).toEqual({ texto: 'Realizado', tipo: 'sucesso' });
    expect(seloDaSituacao('FALTOU')).toEqual({ texto: 'Faltou', tipo: 'perigo' });
    expect(seloDaSituacao('CANCELADO')).toEqual({ texto: 'Cancelado', tipo: 'neutro' });
  });

  it('duração, metadados e o texto do aluno sem o que falta', () => {
    expect(textoDaDuracao(45)).toBe('45 min');
    expect(textoDaDuracao(60)).toBe('1 h');
    expect(textoDaDuracao(90)).toBe('1 h 30 min');
    const c = compromisso({ id: 'c', inicio: '2026-11-04T12:00:00Z', fim: '2026-11-04T13:00:00Z', local: 'Sala 2' });
    expect(metadadosDoCompromisso(c)).toBe('Compromisso · 09:00–10:00 · Sala 2 · com Ana');
    expect(metadadosDoCompromisso({ ...c, local: null, responsavelNome: null })).toBe('Compromisso · 09:00–10:00');
    const doAluno = { id: 'c', inicio: c.inicio, fim: c.fim, data: c.data, hora: c.hora, horaFim: c.horaFim, duracaoMinutos: 60,
      local: null, situacao: 'AGENDADO' as const, responsavelNome: 'Ana' };
    expect(textosDoCompromissoDoAluno(doAluno, '2026-11-03')).toEqual({ titulo: 'Amanhã, 04/11 · 09:00–10:00', detalhe: 'com Ana' });
    expect(textosDoCompromissoDoAluno({ ...doAluno, responsavelNome: null }, '2026-11-03').detalhe).toBeNull();
  });
});

describe('ações sobre a situação', () => {
  const agora = new Date('2026-11-10T12:00:00Z');
  it('futuro: realizado e falta desabilitados com o porquê; cancelar pede confirmação', () => {
    const acoes = acoesDeSituacao({ situacao: 'AGENDADO', inicio: '2026-11-11T12:00:00Z' }, agora);
    expect(acoes.map((a) => [a.situacao, !!a.motivo])).toEqual([['REALIZADO', true], ['FALTOU', true], ['CANCELADO', false]]);
    expect(acoes[2].confirmar).toBe(true);
  });

  it('passado: marca realizado ou falta; o que não está agendado volta a agendado', () => {
    expect(acoesDeSituacao({ situacao: 'AGENDADO', inicio: '2026-11-09T12:00:00Z' }, agora).every((a) => !a.motivo)).toBe(true);
    expect(acoesDeSituacao({ situacao: 'REALIZADO', inicio: '2026-11-09T12:00:00Z' }, agora).map((a) => a.situacao))
      .toEqual(['FALTOU', 'AGENDADO']);
    expect(acoesDeSituacao({ situacao: 'CANCELADO', inicio: '2026-11-09T12:00:00Z' }, agora).map((a) => a.rotulo))
      .toEqual(['Reativar compromisso']);
  });
});

describe('formulário', () => {
  it('máscara e validade da hora', () => {
    expect(mascaraHora('0930')).toBe('09:30');
    expect(mascaraHora('9h3')).toBe('93');
    expect(mascaraHora('12345')).toBe('12:34');
    expect(horaValida('23:59')).toBe(true);
    expect(horaValida('24:00')).toBe(false);
    expect(horaValida('9:00')).toBe(false);
  });

  it('monta o pedido com data ISO; sem permissão a observação nem vai', () => {
    const f = { ...formularioNovo('r1', '2026-11-10'), alunoId: 'a1', hora: '23:30', local: ' Sala 2 ', observacao: 'Nota fictícia' };
    expect(f.data).toBe('10/11/2026');
    const { erros, pedido } = pedidoDoFormulario(f, true);
    expect(erros).toEqual({});
    expect(pedido).toEqual({ alunoId: 'a1', responsavelId: 'r1', data: '2026-11-10', hora: '23:30', duracaoMinutos: 60, local: 'Sala 2', observacao: 'Nota fictícia' });
    expect(pedidoDoFormulario(f, false, 4).pedido).toMatchObject({ observacao: null, versao: 4 });
    expect(intervaloDoPedido(pedido!)).toEqual({ inicio: '2026-11-11T02:30:00.000Z', fim: '2026-11-11T03:30:00.000Z' });
  });

  it('erros por campo, com os limites da API', () => {
    const { erros, pedido } = pedidoDoFormulario({ alunoId: '', responsavelId: '', data: '31/02/2026', hora: '25:00', duracao: '481',
      local: 'x'.repeat(121), observacao: 'x'.repeat(501) }, true);
    expect(pedido).toBeNull();
    expect(Object.keys(erros).sort()).toEqual(['alunoId', 'data', 'duracao', 'hora', 'local', 'observacao', 'responsavelId']);
    expect(pedidoDoFormulario({ ...formularioNovo('r', '2026-11-10'), alunoId: 'a', hora: '', data: '', duracao: '4' }, true).erros)
      .toEqual({ data: 'Informe a data.', hora: 'Informe a hora.', duracao: 'De 5 a 480 minutos.' });
  });

  it('editar parte do compromisso gravado', () => {
    const c = compromisso({ id: 'c', inicio: '2026-11-04T12:00:00Z', fim: '2026-11-04T12:45:00Z', duracaoMinutos: 45, local: 'Sala 1', observacao: null });
    expect(formularioDoCompromisso(c)).toEqual({ alunoId: 'a1', responsavelId: 'r1', data: '04/11/2026', hora: '09:00', duracao: '45', local: 'Sala 1', observacao: '' });
  });
});
