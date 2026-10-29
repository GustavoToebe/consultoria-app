import type { Compromisso, Participante, Repeticao } from '../api/agendaTipos';
import type { AtualizacaoDaLista } from '../api/tipos';
import {
  acaoDeCancelamento, acoesDeSituacao, adicionarParticipante, ALUNOS_MAXIMO, datasEmConflito, erroDosParticipantes, escopoPermitido,
  escoposPermitidos, nomesDosParticipantes, OCORRENCIAS_MAXIMO, previsaoDaSerie, removerParticipante, repeticaoDoFormulario,
  resumoDosParticipantes, seloDoCompromisso, SEM_REPETICAO, situacaoDoCompromisso, textoDaOcorrencia, textoDaPrevisao,
  textoDeAlunosOcupados, textoDoConflitoPorData, vagasNoCompromisso, conflitoNaLista, dataEmBrasilia, deslocarReferencia, diasDaAgenda, diasDoCompromisso, formularioDoCompromisso,
  formularioNovo, hojeEmBrasilia, horaEmBrasilia, horaValida, instanteDeBrasilia, intervaloDoPedido, lerDataDeReferencia, lerSituacao,
  lerVisao, mascaraHora, metadadosDoCompromisso, pedidoDoFormulario, periodoDaVisao, resumoDoDia, seloDaSituacao, sobrepoe,
  textoDaDuracao, textoDoHorario, textosDoCompromissoDoAluno, tituloDoPeriodo,
  alternarDiaDaRepeticao, avisadosAoCancelar, explicacaoDoEscopo, filtroDeAlunosOcupados, mudouAData, nomesPorExtenso,
  textoDoCancelamentoDoAluno, textoDoCancelamentoInteiro, textoDoErroDaAgenda, trocarTipoDaRepeticao,
} from './agendaPresencial';

function compromisso(parcial: Partial<Compromisso> & Pick<Compromisso, 'id' | 'inicio' | 'fim'>): Compromisso {
  return {
    responsavelId: 'r1', responsavelNome: 'Ana', data: dataEmBrasilia(parcial.inicio),
    hora: horaEmBrasilia(parcial.inicio), horaFim: horaEmBrasilia(parcial.fim), duracaoMinutos: 60, local: null, observacao: null,
    cancelado: false, participantes: [{ id: 'a1', nome: 'Aluna Fictícia', situacao: 'AGENDADO' }], versao: 0,
    serieId: null, ocorrenciaDaSerie: null, totalDaSerie: null, ...parcial,
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
      compromisso({ id: 'c2', inicio: '2026-11-10T12:00:00Z', fim: '2026-11-10T13:00:00Z', cancelado: true }),
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
  it('futuro: realizado e falta desabilitados com o porquê; cancelar a participação pede confirmação', () => {
    const acoes = acoesDeSituacao({ situacao: 'AGENDADO', inicio: '2026-11-11T12:00:00Z' }, agora);
    expect(acoes.map((a) => [a.situacao, !!a.motivo])).toEqual([['REALIZADO', true], ['FALTOU', true], ['CANCELADO', false]]);
    expect(acoes[2]).toMatchObject({ rotulo: 'Cancelar participação', confirmar: true, perigo: true });
  });

  it('passado: marca realizado ou falta; o que não está agendado volta a agendado', () => {
    expect(acoesDeSituacao({ situacao: 'AGENDADO', inicio: '2026-11-09T12:00:00Z' }, agora).every((a) => !a.motivo)).toBe(true);
    expect(acoesDeSituacao({ situacao: 'REALIZADO', inicio: '2026-11-09T12:00:00Z' }, agora).map((a) => a.situacao))
      .toEqual(['FALTOU', 'AGENDADO']);
    expect(acoesDeSituacao({ situacao: 'CANCELADO', inicio: '2026-11-09T12:00:00Z' }, agora).map((a) => a.rotulo))
      .toEqual(['Reabrir participação']);
  });

  it('nunca diz "Cancelar compromisso" por aluno; sozinho, cancelar e reabrir ficam só no compromisso', () => {
    const todas = (['AGENDADO', 'REALIZADO', 'FALTOU', 'CANCELADO'] as const)
      .flatMap((situacao) => acoesDeSituacao({ situacao, inicio: '2026-11-09T12:00:00Z' }, agora));
    expect(todas.some((a) => /compromisso/i.test(a.rotulo))).toBe(false);
    expect(acoesDeSituacao({ situacao: 'AGENDADO', inicio: '2026-11-09T12:00:00Z' }, agora, { sozinho: true }).map((a) => a.situacao))
      .toEqual(['REALIZADO', 'FALTOU']);
    expect(acoesDeSituacao({ situacao: 'CANCELADO', inicio: '2026-11-09T12:00:00Z' }, agora, { sozinho: true })).toEqual([]);
    expect(acoesDeSituacao({ situacao: 'FALTOU', inicio: '2026-11-09T12:00:00Z' }, agora, { sozinho: true }).map((a) => a.rotulo))
      .toEqual(['Marcar realizado', 'Voltar para agendado']);
  });

  it('compromisso inteiro cancelado: nada por aluno; o nome vai ao rótulo do leitor de tela', () => {
    expect(acoesDeSituacao({ situacao: 'CANCELADO', inicio: '2026-11-09T12:00:00Z' }, agora, { cancelado: true })).toEqual([]);
    expect(acoesDeSituacao({ situacao: 'AGENDADO', inicio: '2026-11-09T12:00:00Z' }, agora, { nome: 'Ana' })[0].rotuloAcessivel)
      .toBe('Marcar realizado: Ana');
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
    const f = { ...formularioNovo('r1', '2026-11-10'), alunoIds: ['a1'], hora: '23:30', local: ' Sala 2 ', observacao: 'Nota fictícia' };
    expect(f.data).toBe('10/11/2026');
    const { erros, pedido } = pedidoDoFormulario(f, true);
    expect(erros).toEqual({});
    expect(pedido).toEqual({ alunoIds: ['a1'], responsavelId: 'r1', data: '2026-11-10', hora: '23:30', duracaoMinutos: 60, local: 'Sala 2', observacao: 'Nota fictícia' });
    expect(pedidoDoFormulario(f, false, 4).pedido).toMatchObject({ observacao: null, versao: 4 });
    expect(intervaloDoPedido(pedido!)).toEqual({ inicio: '2026-11-11T02:30:00.000Z', fim: '2026-11-11T03:30:00.000Z' });
  });

  it('erros por campo, com os limites da API', () => {
    const { erros, pedido } = pedidoDoFormulario({ alunoIds: [], responsavelId: '', data: '31/02/2026', hora: '25:00', duracao: '481',
      local: 'x'.repeat(121), observacao: 'x'.repeat(501), repeticao: SEM_REPETICAO }, true);
    expect(pedido).toBeNull();
    expect(Object.keys(erros).sort()).toEqual(['alunoIds', 'data', 'duracao', 'hora', 'local', 'observacao', 'responsavelId']);
    expect(pedidoDoFormulario({ ...formularioNovo('r', '2026-11-10'), alunoIds: ['a'], hora: '', data: '', duracao: '4' }, true).erros)
      .toEqual({ data: 'Informe a data.', hora: 'Informe a hora.', duracao: 'De 5 a 480 minutos.' });
  });

  it('editar parte do compromisso gravado', () => {
    const c = compromisso({ id: 'c', inicio: '2026-11-04T12:00:00Z', fim: '2026-11-04T12:45:00Z', duracaoMinutos: 45, local: 'Sala 1', observacao: null });
    expect(formularioDoCompromisso(c)).toEqual({
      alunoIds: ['a1'], responsavelId: 'r1', data: '04/11/2026', hora: '09:00', duracao: '45', local: 'Sala 1', observacao: '', repeticao: SEM_REPETICAO,
    });
  });
});

const participante = (id: string, situacao: Participante['situacao'] = 'AGENDADO', nome: string | null = `Aluno ${id}`): Participante => ({ id, nome, situacao });
const comParticipantes = (participantes: Participante[], extra: Partial<Compromisso> = {}) =>
  compromisso({ id: 'c', inicio: '2026-11-10T12:00:00Z', fim: '2026-11-10T13:00:00Z', participantes, ...extra });

describe('participantes', () => {
  it('o máximo é 20 e a lista não repete aluno', () => {
    expect(ALUNOS_MAXIMO).toBe(20);
    const vinte = Array.from({ length: 20 }, (_, i) => `a${i}`);
    expect(erroDosParticipantes(vinte)).toBeNull();
    expect(erroDosParticipantes([...vinte, 'a20'])).toBe('Escolha até 20 alunos.');
    expect(erroDosParticipantes([])).toBe('Escolha ao menos um aluno.');
    expect(erroDosParticipantes(['a', 'b', 'a'])).toBe('Há aluno repetido na lista.');
  });

  it('adicionar ignora repetido e o 21º; remover tira só o aluno', () => {
    const vinte = Array.from({ length: 20 }, (_, i) => `a${i}`);
    expect(adicionarParticipante(['a'], 'b')).toEqual(['a', 'b']);
    expect(adicionarParticipante(['a'], 'a')).toEqual(['a']);
    expect(adicionarParticipante(vinte, 'novo')).toEqual(vinte);
    expect(adicionarParticipante(vinte, 'novo')).not.toBe(vinte);
    expect(adicionarParticipante([], '')).toEqual([]);
    expect(vagasNoCompromisso(vinte)).toBe(0);
    expect(vagasNoCompromisso(['a'])).toBe(19);
    expect(removerParticipante(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('nomes para a linha: um, dois ou "Ana, Bruno +N"; por extenso para o leitor; sem nome vira "Aluno"', () => {
    expect(nomesDosParticipantes(comParticipantes([participante('1', 'AGENDADO', 'Ana')]))).toBe('Ana');
    expect(nomesDosParticipantes(comParticipantes([participante('1', 'AGENDADO', 'Ana'), participante('2', 'AGENDADO', 'Bruno')]))).toBe('Ana e Bruno');
    const quatro = comParticipantes(['1', '2', '3', '4'].map((i) => participante(i, 'AGENDADO', `N${i}`)));
    expect(nomesDosParticipantes(quatro)).toBe('N1, N2 +2');
    expect(nomesPorExtenso(quatro)).toBe('N1, N2 e mais 2');
    expect(nomesPorExtenso(comParticipantes([participante('1', 'AGENDADO', 'Ana')]))).toBe('Ana');
    expect(nomesDosParticipantes(comParticipantes([participante('1', 'AGENDADO', null)]))).toBe('Aluno');
    expect(nomesDosParticipantes(comParticipantes([]))).toBe('Aluno');
  });

  it('situação do compromisso: cancelado só quando todos cancelaram (ou a API marcou)', () => {
    const doisCancelados = [participante('1', 'CANCELADO'), participante('2', 'CANCELADO')];
    expect(situacaoDoCompromisso({ cancelado: false, participantes: doisCancelados })).toBe('CANCELADO');
    expect(situacaoDoCompromisso({ cancelado: true, participantes: [participante('1')] })).toBe('CANCELADO');
    expect(situacaoDoCompromisso({ cancelado: false, participantes: [participante('1', 'CANCELADO'), participante('2')] })).toBe('AGENDADO');
    expect(situacaoDoCompromisso({ cancelado: false, participantes: [participante('1', 'CANCELADO'), participante('2', 'REALIZADO')] })).toBe('REALIZADO');
    expect(situacaoDoCompromisso({ cancelado: false, participantes: [participante('1', 'REALIZADO'), participante('2', 'FALTOU')] })).toBe('REALIZADO');
    expect(situacaoDoCompromisso({ cancelado: false, participantes: [participante('1', 'FALTOU')] })).toBe('FALTOU');
    expect(situacaoDoCompromisso({ cancelado: false, participantes: [] })).toBe('AGENDADO');
  });

  it('resumo e selo: um aluno mostra a situação dele; vários, a contagem', () => {
    expect(seloDoCompromisso({ cancelado: false, participantes: [participante('1', 'FALTOU')] })).toEqual({ texto: 'Faltou', tipo: 'perigo' });
    const tres = [participante('1', 'REALIZADO'), participante('2', 'REALIZADO'), participante('3', 'AGENDADO')];
    expect(resumoDosParticipantes({ cancelado: false, participantes: tres })).toBe('1 agendado · 2 de 3 realizados');
    expect(resumoDosParticipantes({ cancelado: false, participantes: [participante('1', 'REALIZADO'), participante('2', 'REALIZADO'), participante('3', 'FALTOU')] }))
      .toBe('2 de 3 realizados · 1 faltou');
    expect(resumoDosParticipantes({ cancelado: false, participantes: [participante('1', 'REALIZADO'), participante('2', 'FALTOU'), participante('3', 'FALTOU'), participante('4', 'CANCELADO')] }))
      .toBe('1 de 4 realizados · 2 faltaram · 1 cancelado');
    expect(seloDoCompromisso({ cancelado: false, participantes: [participante('1', 'CANCELADO'), participante('2', 'CANCELADO')] })).toEqual({ texto: 'Cancelado', tipo: 'neutro' });
    expect(seloDoCompromisso({ cancelado: false, participantes: tres }).tipo).toBe('atencao');
  });

  it('cancelar o compromisso inteiro pede confirmação; cancelado reabre sem confirmar', () => {
    expect(acaoDeCancelamento({ cancelado: false })).toMatchObject({ cancelado: true, confirmar: true, perigo: true, rotulo: 'Cancelar compromisso' });
    expect(acaoDeCancelamento({ cancelado: false, participantes: [1, 2] }).rotulo).toBe('Cancelar compromisso inteiro');
    expect(acaoDeCancelamento({ cancelado: true })).toMatchObject({ cancelado: false, confirmar: false, rotulo: 'Reabrir compromisso' });
  });

  it('cancelar inteiro avisa os que ainda participam; compromisso terminado não avisa ninguém', () => {
    const agora = new Date('2026-11-10T10:00:00Z');
    const c = comParticipantes([participante('1'), participante('2', 'CANCELADO'), participante('3', 'REALIZADO')]);
    expect(avisadosAoCancelar(c, agora)).toBe(2);
    expect(textoDoCancelamentoInteiro(c, agora)).toBe('Todos os alunos deste compromisso ficam cancelados. 2 alunos recebem o aviso do cancelamento. O horário do responsável fica livre.');
    expect(textoDoCancelamentoInteiro(comParticipantes([participante('1')]), agora)).toContain('1 aluno recebe o aviso');
    expect(avisadosAoCancelar(c, new Date('2026-11-10T13:00:00Z'))).toBe(0);
    expect(textoDoCancelamentoInteiro(c, new Date('2026-11-10T14:00:00Z'))).toContain('Nenhum aluno recebe aviso.');
  });

  it('texto da ocorrência na série, também nos metadados da linha', () => {
    expect(textoDaOcorrencia({ serieId: 's', ocorrenciaDaSerie: 3, totalDaSerie: 10 })).toBe('Ocorrência 3 de 10');
    expect(textoDaOcorrencia({ serieId: null, ocorrenciaDaSerie: null, totalDaSerie: null })).toBeNull();
    expect(metadadosDoCompromisso(comParticipantes([participante('1')], { serieId: 's', ocorrenciaDaSerie: 3, totalDaSerie: 10 })))
      .toBe('Compromisso · 09:00–10:00 · com Ana · Ocorrência 3 de 10');
  });
});

describe('escopo, aviso de aluno ocupado e repetição no formulário', () => {
  it('explica o alcance de cada escopo e percebe a data mudada', () => {
    expect(explicacaoDoEscopo('ESTA', '2026-11-05', '2026-10-19')).toBe('Só o compromisso de 05/11.');
    expect(explicacaoDoEscopo('SEGUINTES', '2026-11-05', '2026-10-19')).toBe('O de 05/11 e os seguintes da série que ainda não terminaram.');
    expect(explicacaoDoEscopo('TODAS', '2026-11-05', '2026-10-19')).toContain('Os que já passaram não mudam.');
    expect(mudouAData({ data: '05/11/2026' }, { data: '2026-11-05' })).toBe(false);
    expect(mudouAData({ data: '06/11/2026' }, { data: '2026-11-05' })).toBe(true);
  });

  it('cancelar só um aluno e erros próprios da agenda', () => {
    const c = comParticipantes([participante('1')]);
    expect(textoDoCancelamentoDoAluno('Ana', c, new Date('2026-11-10T10:00:00Z')))
      .toBe('Ana deixa de participar e recebe o aviso do cancelamento. Os outros alunos continuam marcados.');
    expect(textoDoCancelamentoDoAluno(null, c, new Date('2026-11-10T14:00:00Z'))).toBe('Aluno deixa de participar. Os outros alunos continuam marcados.');
    const ocupado = { codigo: 'HORARIO_OCUPADO', campos: [{ field: 'datasEmConflito', message: '2026-10-26' }] };
    expect(textoDoErroDaAgenda(ocupado, '2026-10-19')).toBe('O responsável já tem compromisso nesse horário em 26/10. Escolha outro horário.');
    expect(textoDoErroDaAgenda({ codigo: 'CONFLITO_EDICAO', campos: [] }, '2026-10-19')).toContain('Outra pessoa alterou');
    expect(textoDoErroDaAgenda({ codigo: 'ALUNO_INATIVO', campos: [] }, '2026-10-19')).toBeNull();
    expect(textoDoErroDaAgenda(new Error('x'), '2026-10-19')).toBeNull();
  });

  it('filtro de alunos ocupados só com alunos e horário válidos', () => {
    const f = { alunoIds: ['a1', 'a2'], data: '05/11/2026', hora: '09:00', duracao: '60' };
    expect(filtroDeAlunosOcupados(f)).toEqual({ data: '2026-11-05', hora: '09:00', duracaoMinutos: 60, alunoIds: ['a1', 'a2'] });
    expect(filtroDeAlunosOcupados(f, 'k1')).toMatchObject({ ignorar: 'k1' });
    expect(filtroDeAlunosOcupados({ ...f, alunoIds: [] })).toBeNull();
    expect(filtroDeAlunosOcupados({ ...f, hora: '09:' })).toBeNull();
    expect(filtroDeAlunosOcupados({ ...f, data: '31/02/2026' })).toBeNull();
    expect(filtroDeAlunosOcupados({ ...f, duracao: '4' })).toBeNull();
  });

  it('"Toda semana" nasce com o dia da data; os dias ficam de segunda a domingo', () => {
    // 05/11/2026 é quinta-feira.
    expect(trocarTipoDaRepeticao(SEM_REPETICAO, 'SEMANAL', '05/11/2026').dias).toEqual(['THURSDAY']);
    expect(trocarTipoDaRepeticao({ ...SEM_REPETICAO, dias: ['MONDAY'] }, 'SEMANAL', '05/11/2026').dias).toEqual(['MONDAY']);
    expect(trocarTipoDaRepeticao({ ...SEM_REPETICAO, tipo: 'SEMANAL', dias: ['MONDAY'] }, 'DIARIA', '05/11/2026')).toMatchObject({ tipo: 'DIARIA', dias: [] });
    expect(trocarTipoDaRepeticao(SEM_REPETICAO, 'SEMANAL', '').dias).toEqual([]);
    expect(alternarDiaDaRepeticao(['FRIDAY'], 'MONDAY')).toEqual(['MONDAY', 'FRIDAY']);
    expect(alternarDiaDaRepeticao(['MONDAY', 'FRIDAY'], 'MONDAY')).toEqual(['FRIDAY']);
  });
});

describe('avisos de aluno ocupado e de conflito por data', () => {
  it('aluno ocupado: um, vários e muitos; nada quando ninguém', () => {
    expect(textoDeAlunosOcupados([])).toBeNull();
    expect(textoDeAlunosOcupados([{ nome: 'Ana' }])).toBe('Ana já tem outro compromisso nesse horário. Dá para salvar mesmo assim.');
    expect(textoDeAlunosOcupados([{ nome: 'Ana' }, { nome: null }])).toBe('Ana e Aluno já têm outro compromisso nesse horário. Dá para salvar mesmo assim.');
    expect(textoDeAlunosOcupados([{ nome: 'A' }, { nome: 'B' }, { nome: 'C' }, { nome: 'D' }, { nome: 'E' }]))
      .toBe('A, B, C e mais 2 já têm outro compromisso nesse horário. Dá para salvar mesmo assim.');
  });

  it('datas do 409 HORARIO_OCUPADO: uma por item de fieldErrors, em ordem; outro erro não tem', () => {
    const campos = [
      { field: 'datasEmConflito', message: '2026-11-12' }, { field: 'datasEmConflito', message: '2026-11-05' }, { field: 'outro', message: 'x' },
    ];
    expect(datasEmConflito({ codigo: 'HORARIO_OCUPADO', campos })).toEqual(['2026-11-05', '2026-11-12']);
    expect(datasEmConflito({ codigo: 'CONFLITO_EDICAO', campos })).toEqual([]);
    expect(datasEmConflito({ codigo: 'HORARIO_OCUPADO', campos: [] })).toEqual([]);
    expect(datasEmConflito(null)).toEqual([]);
    expect(datasEmConflito(new Error('x'))).toEqual([]);
  });

  it('texto por data: as datas civis de Brasília saem como estão, e o ano só quando não é o corrente', () => {
    const hoje = '2026-11-03';
    expect(textoDoConflitoPorData([], hoje)).toBe('O responsável já tem compromisso nesse horário. Escolha outro horário.');
    expect(textoDoConflitoPorData(['2026-11-05'], hoje)).toBe('O responsável já tem compromisso nesse horário em 05/11. Escolha outro horário.');
    expect(textoDoConflitoPorData(['2026-11-05', '2026-11-12', '2026-11-19'], hoje))
      .toBe('O responsável já tem compromisso nesse horário nestas datas: 05/11, 12/11 e 19/11. Escolha outro horário.');
    expect(textoDoConflitoPorData(['2026-12-31', '2027-01-07'], hoje)).toContain('31/12 e 07/01/2027');
    const sete = Array.from({ length: 7 }, (_, i) => `2026-11-${String(10 + i).padStart(2, '0')}`);
    expect(textoDoConflitoPorData(sete, hoje)).toContain('10/11, 11/11, 12/11, 13/11, 14/11 e mais 2');
  });
});

describe('série: repetição', () => {
  const datas = (primeira: string, r: Repeticao) => previsaoDaSerie(primeira, r).datas;

  it('o fim é obrigatório e exatamente um: sem fim ("nunca") e com os dois são recusados', () => {
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA' }).erro?.campo).toBe('fim');
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA', ate: '2026-11-10', vezes: 3 }).erro?.campo).toBe('fim');
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA', ate: null, vezes: null }).erro?.campo).toBe('fim');
  });

  it('vezes de 2 a 52 (a primeira conta); 52 passa, 53 e 1 não', () => {
    expect(OCORRENCIAS_MAXIMO).toBe(52);
    expect(datas('2026-11-02', { tipo: 'DIARIA', vezes: 52 })).toHaveLength(52);
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA', vezes: 53 }).erro?.campo).toBe('vezes');
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA', vezes: 1 }).erro?.campo).toBe('vezes');
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA', vezes: 2.5 }).erro?.campo).toBe('vezes');
    expect(datas('2026-11-02', { tipo: 'DIARIA', vezes: 3 })).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
  });

  it('data final: depois da primeira, inclusive, e nunca cortada em silêncio acima de 52', () => {
    expect(datas('2026-11-02', { tipo: 'DIARIA', ate: '2026-11-04' })).toEqual(['2026-11-02', '2026-11-03', '2026-11-04']);
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA', ate: '2026-11-02' }).erro?.campo).toBe('ate');
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA', ate: '2026-11-01' }).erro?.campo).toBe('ate');
    expect(datas('2026-11-02', { tipo: 'DIARIA', ate: '2026-12-23' })).toHaveLength(52);
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA', ate: '2026-12-24' }).erro?.mensagem).toContain('no máximo 52');
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA', ate: '2030-01-01' }).datas).toEqual([]);
  });

  it('semanal: dias escolhidos incluindo o da primeira data; sem dias ou sem o dia da primeira é erro', () => {
    // 02/11/2026 é segunda-feira.
    expect(datas('2026-11-02', { tipo: 'SEMANAL', diasDaSemana: ['MONDAY', 'WEDNESDAY'], vezes: 5 }))
      .toEqual(['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11', '2026-11-16']);
    expect(previsaoDaSerie('2026-11-02', { tipo: 'SEMANAL', vezes: 3 }).erro?.campo).toBe('dias');
    expect(previsaoDaSerie('2026-11-02', { tipo: 'SEMANAL', diasDaSemana: [], vezes: 3 }).erro?.campo).toBe('dias');
    expect(previsaoDaSerie('2026-11-02', { tipo: 'SEMANAL', diasDaSemana: ['TUESDAY'], vezes: 3 }).erro?.mensagem).toContain('incluir o dia');
    expect(previsaoDaSerie('2026-11-02', { tipo: 'SEMANAL', diasDaSemana: ['SEGUNDA' as never], vezes: 3 }).erro?.campo).toBe('dias');
    expect(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA', diasDaSemana: ['MONDAY'], vezes: 3 }).erro?.campo).toBe('dias');
  });

  it('dias úteis: pula sábado e domingo e não começa no fim de semana', () => {
    // 06/11/2026 é sexta-feira.
    expect(datas('2026-11-06', { tipo: 'DIAS_UTEIS', vezes: 4 })).toEqual(['2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11']);
    expect(previsaoDaSerie('2026-11-07', { tipo: 'DIAS_UTEIS', vezes: 4 }).erro?.campo).toBe('tipo');
    expect(previsaoDaSerie('2026-11-08', { tipo: 'DIAS_UTEIS', vezes: 4 }).erro?.campo).toBe('tipo');
  });

  it('mensal pula o mês sem o dia; anual leva 29/02 ao próximo bissexto; virada de ano', () => {
    expect(datas('2026-01-31', { tipo: 'MENSAL', vezes: 4 })).toEqual(['2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31']);
    expect(datas('2026-11-30', { tipo: 'MENSAL', vezes: 3 })).toEqual(['2026-11-30', '2026-12-30', '2027-01-30']);
    expect(datas('2026-12-15', { tipo: 'MENSAL', ate: '2027-02-15' })).toEqual(['2026-12-15', '2027-01-15', '2027-02-15']);
    expect(datas('2028-02-29', { tipo: 'ANUAL', vezes: 3 })).toEqual(['2028-02-29', '2032-02-29', '2036-02-29']);
    expect(datas('2026-12-31', { tipo: 'DIARIA', vezes: 3 })).toEqual(['2026-12-31', '2027-01-01', '2027-01-02']);
    expect(datas('2026-05-10', { tipo: 'ANUAL', ate: '2028-05-10' })).toEqual(['2026-05-10', '2027-05-10', '2028-05-10']);
  });

  it('fim por data que deixa menos de 2 ocorrências é erro', () => {
    expect(previsaoDaSerie('2026-11-02', { tipo: 'SEMANAL', diasDaSemana: ['MONDAY'], ate: '2026-11-08' }).erro?.campo).toBe('ate');
  });

  it('texto da previsão', () => {
    expect(textoDaPrevisao(previsaoDaSerie('2026-11-02', { tipo: 'SEMANAL', diasDaSemana: ['MONDAY'], vezes: 6 }), '2026-11-01'))
      .toBe('6 compromissos, de 02/11 a 07/12');
    expect(textoDaPrevisao(previsaoDaSerie('2026-12-28', { tipo: 'SEMANAL', diasDaSemana: ['MONDAY'], vezes: 3 }), '2026-11-01'))
      .toBe('3 compromissos, de 28/12 a 11/01/2027');
    expect(textoDaPrevisao(previsaoDaSerie('2026-11-02', { tipo: 'DIARIA' }), '2026-11-01')).toContain('Informe o fim');
  });
});

describe('série: repetição no formulário e no pedido', () => {
  const base = { ...formularioNovo('r1', '2026-11-02'), alunoIds: ['a1'], hora: '09:00' };

  it('sem repetição, o pedido não leva `repeticao`', () => {
    expect(pedidoDoFormulario(base, false).pedido).not.toHaveProperty('repeticao');
  });

  it('semanal por número de vezes: os dias vão como nomes de DayOfWeek, em ordem da semana', () => {
    const f = { ...base, repeticao: { tipo: 'SEMANAL' as const, dias: ['WEDNESDAY' as const, 'MONDAY' as const], fim: 'VEZES' as const, ate: '', vezes: '4' } };
    const { erros, errosDaRepeticao, pedido } = pedidoDoFormulario(f, false);
    expect(erros).toEqual({});
    expect(errosDaRepeticao).toEqual({});
    expect(pedido?.repeticao).toEqual({ tipo: 'SEMANAL', diasDaSemana: ['MONDAY', 'WEDNESDAY'], vezes: 4 });
  });

  it('por data final em DD/MM/AAAA vira ISO', () => {
    const f = { ...base, repeticao: { tipo: 'DIARIA' as const, dias: [], fim: 'DATA' as const, ate: '05/11/2026', vezes: '' } };
    expect(pedidoDoFormulario(f, false).pedido?.repeticao).toEqual({ tipo: 'DIARIA', ate: '2026-11-05' });
  });

  it('erros: sem fim, data inválida, vezes fora do limite, série grande demais; nenhum pedido sai', () => {
    const rep = (extra: Partial<typeof SEM_REPETICAO>) => ({ ...base, repeticao: { ...SEM_REPETICAO, tipo: 'DIARIA' as const, ...extra } });
    const r1 = pedidoDoFormulario(rep({ fim: 'VEZES', vezes: '' }), false);
    expect(r1.pedido).toBeNull();
    expect(r1.errosDaRepeticao).toEqual({ vezes: 'Informe quantas vezes.' });
    expect(r1.erros.repeticao).toBeDefined();
    expect(pedidoDoFormulario(rep({ fim: 'DATA', ate: '' }), false).errosDaRepeticao).toEqual({ ate: 'Informe a data final.' });
    expect(pedidoDoFormulario(rep({ fim: 'DATA', ate: '31/02/2026' }), false).errosDaRepeticao).toEqual({ ate: 'Data final inválida.' });
    expect(Object.keys(pedidoDoFormulario(rep({ fim: 'VEZES', vezes: '53' }), false).errosDaRepeticao)).toEqual(['vezes']);
    expect(Object.keys(pedidoDoFormulario(rep({ fim: 'VEZES', vezes: 'abc' }), false).errosDaRepeticao)).toEqual(['vezes']);
    expect(Object.keys(pedidoDoFormulario(rep({ fim: 'DATA', ate: '31/12/2027' }), false).errosDaRepeticao)).toEqual(['ate']);
  });

  it('remarcar (com versão) nunca leva repetição, mesmo escolhida', () => {
    const f = { ...base, repeticao: { ...SEM_REPETICAO, tipo: 'DIARIA' as const, vezes: '3' } };
    const { pedido, errosDaRepeticao } = pedidoDoFormulario(f, false, 2);
    expect(errosDaRepeticao).toEqual({});
    expect(pedido).not.toHaveProperty('repeticao');
    expect(pedido?.versao).toBe(2);
  });

  it('com data do compromisso inválida, a repetição não é conferida (o erro é o da data)', () => {
    const { erros, errosDaRepeticao } = pedidoDoFormulario({ ...base, data: '', repeticao: { ...SEM_REPETICAO, tipo: 'DIARIA', vezes: '3' } }, false);
    expect(erros.data).toBeDefined();
    expect(errosDaRepeticao).toEqual({});
    expect(repeticaoDoFormulario({ ...SEM_REPETICAO, tipo: 'NENHUMA' }, '2026-11-02')).toEqual({ erros: {}, repeticao: null, previsao: null });
  });

  it('lista de alunos inválida aparece no pedido', () => {
    expect(pedidoDoFormulario({ ...base, alunoIds: ['a', 'a'] }, false).erros.alunoIds).toBe('Há aluno repetido na lista.');
    expect(pedidoDoFormulario({ ...base, alunoIds: Array.from({ length: 21 }, (_, i) => `a${i}`) }, false).erros.alunoIds).toBe('Escolha até 20 alunos.');
  });
});

describe('série: escopo permitido', () => {
  it('sem série, só "somente este"; na série, os três', () => {
    expect(escoposPermitidos({ serieId: null })).toEqual(['ESTA']);
    expect(escoposPermitidos({ serieId: 's1' })).toEqual(['ESTA', 'SEGUINTES', 'TODAS']);
    expect(escopoPermitido({ serieId: null }, 'TODAS')).toBe(false);
    expect(escopoPermitido({ serieId: 's1' }, 'SEGUINTES')).toBe(true);
  });

  it('mudar a data e marcar realizado ou falta valem só para uma ocorrência', () => {
    expect(escoposPermitidos({ serieId: 's1' }, { mudouData: true })).toEqual(['ESTA']);
    expect(escoposPermitidos({ serieId: 's1' }, { situacao: 'REALIZADO' })).toEqual(['ESTA']);
    expect(escoposPermitidos({ serieId: 's1' }, { situacao: 'FALTOU' })).toEqual(['ESTA']);
    expect(escoposPermitidos({ serieId: 's1' }, { situacao: 'CANCELADO' })).toEqual(['ESTA', 'SEGUINTES', 'TODAS']);
    expect(escoposPermitidos({ serieId: 's1' }, { situacao: 'AGENDADO' })).toHaveLength(3);
  });
});
