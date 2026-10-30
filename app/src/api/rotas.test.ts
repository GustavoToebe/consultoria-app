import { requisicao } from './cliente';
import {
  aceitarInscricao, alterarCancelamentoCompromisso, alterarCompromisso, alterarSituacaoDoAluno, aplicarAlteracaoDaAnamnese, avisosDeCompromisso, listarAlunosOcupados, marcarAvisoDeCompromissoVisto, compromissosDoAluno, criarCompromisso, listarCompromissos, buscarQuestionario, descartarAlteracaoDaAnamnese, fatoresDosAlimentos, inscricao, inscricaoPublica, listarPlanos,
  retornoDoPagamento, definirLembretesDoAluno, lembretesDaCobranca, lembretesDoAluno,
  alterarAgendaPessoal, alterarEvento, apagarAgendaPessoal, contarEventosDaAgenda, criarAgendaPessoal, criarEvento, cruzamentosDoEvento,
  detalheDoEvento, excluirEvento, listarAgendasPessoais, listarAtualizacoes, listarEventos, resumoDaAgenda,
} from './rotas';

jest.mock('./cliente', () => ({ requisicao: jest.fn((caminho: string) => Promise.resolve(caminho)) }));

describe('caminhos da API', () => {
  it('id vindo do endereço da tela é codificado: "../" não vira outra rota com o token de quem abriu', async () => {
    await expect(buscarQuestionario('../../alunos/x')).resolves.toBe('/questionarios/..%2F..%2Falunos%2Fx');
    await expect(listarPlanos('treino', 'a/b')).resolves.toBe('/alunos/a%2Fb/planos-treino');
  });

  it('código do link de inscrição e id da inscrição também são codificados', async () => {
    await expect(inscricaoPublica('../alunos')).resolves.toBe('/publico/inscricoes/..%2Falunos');
    await expect(inscricao('a/b')).resolves.toBe('/inscricoes/a%2Fb');
    await expect(inscricaoPublica('Ab-_09xYzAb-_09xYzAb-_09')).resolves.toBe('/publico/inscricoes/Ab-_09xYzAb-_09xYzAb-_09');
  });

  it('ids dos fatores vão separados por vírgula, cada um codificado', async () => {
    await expect(fatoresDosAlimentos(['a', 'b,c', '../x'])).resolves.toBe('/alimentos/fatores?ids=a,b%2Cc,..%2Fx');
  });

  it('alteração do cadastro proposta pela anamnese: os dois ids codificados', async () => {
    await expect(aplicarAlteracaoDaAnamnese('a/b', '../c')).resolves.toBe('/anamneses/a%2Fb/alteracoes/..%2Fc/aplicar');
    await expect(descartarAlteracaoDaAnamnese('a', 'b')).resolves.toBe('/anamneses/a/alteracoes/b/descartar');
  });

  it('lembretes de pagamento do aluno: sem id (é sempre o da sessão), GET para ler e PUT com só o `receber`', async () => {
    await expect(lembretesDoAluno()).resolves.toBe('/aluno/lembretes-de-cobranca');
    await definirLembretesDoAluno(false);
    expect(requisicao).toHaveBeenLastCalledWith('/aluno/lembretes-de-cobranca', { metodo: 'PUT', corpo: { receber: false } });
    await definirLembretesDoAluno(true);
    expect(requisicao).toHaveBeenLastCalledWith('/aluno/lembretes-de-cobranca', { metodo: 'PUT', corpo: { receber: true } });
  });

  it('lembretes de uma cobrança: o id vindo da tela é codificado', async () => {
    await expect(lembretesDaCobranca('../x')).resolves.toBe('/cobrancas/..%2Fx/lembretes');
  });

  it('volta do pagamento: POST com o corpo em JSON (camelCase), sem nada no caminho', async () => {
    const corpo = { orderNsu: 'c0000000-0000-4000-8000-0000000000b1', transactionNsu: 'tx1', slug: 'abc', captureMethod: 'pix' };
    await retornoDoPagamento(corpo);
    expect(requisicao).toHaveBeenLastCalledWith('/aluno/financeiro/retorno-pagamento', { metodo: 'POST', corpo });
  });

  it('aceite da inscrição: o corpo leva sempre anamneseQuestionarioId (nulo quando não envia)', async () => {
    await aceitarInscricao('a/b', { convidar: true, anamneseQuestionarioId: null, versao: 3 });
    expect(requisicao).toHaveBeenLastCalledWith('/inscricoes/a%2Fb/aceitar', {
      metodo: 'POST', corpo: { convidar: true, anamneseQuestionarioId: null, versao: 3 },
    });
    await aceitarInscricao('i', { convidar: false, anamneseQuestionarioId: 'q1', versao: 1 });
    expect(requisicao).toHaveBeenLastCalledWith('/inscricoes/i/aceitar', {
      metodo: 'POST', corpo: { convidar: false, anamneseQuestionarioId: 'q1', versao: 1 },
    });
  });

  it('agenda presencial: período e filtros na query, id codificado, corpo em JSON', async () => {
    await expect(listarCompromissos({ de: '2026-11-02', ate: '2026-11-09' })).resolves.toBe('/agenda/compromissos?de=2026-11-02&ate=2026-11-09');
    await expect(listarCompromissos({ de: '2026-11-02', ate: '2026-11-02', responsavel: 'u/1', situacao: 'CANCELADO' }))
      .resolves.toBe('/agenda/compromissos?de=2026-11-02&ate=2026-11-02&responsavel=u%2F1&situacao=CANCELADO');
    const corpo = { alunoIds: ['a', 'b'], responsavelId: 'r', data: '2026-11-02', hora: '09:00', duracaoMinutos: 60, local: null, observacao: null };
    await criarCompromisso(corpo);
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos', { metodo: 'POST', corpo });
    const serie = { ...corpo, repeticao: { tipo: 'SEMANAL' as const, diasDaSemana: ['MONDAY' as const], vezes: 4 } };
    await criarCompromisso(serie);
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos', { metodo: 'POST', corpo: serie });
    await alterarCompromisso('../x', { ...corpo, versao: 2 });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos/..%2Fx', { metodo: 'PUT', corpo: { ...corpo, versao: 2 } });
    await alterarCompromisso('c1', { ...corpo, versao: 2 }, 'ESTA');
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos/c1', { metodo: 'PUT', corpo: { ...corpo, versao: 2 } });
    await alterarCompromisso('c1', { ...corpo, versao: 2 }, 'SEGUINTES');
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos/c1?escopo=SEGUINTES', { metodo: 'PUT', corpo: { ...corpo, versao: 2 } });
    await alterarCancelamentoCompromisso('c1', { cancelado: true, versao: 3 });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos/c1/situacao', { metodo: 'POST', corpo: { cancelado: true, versao: 3 } });
    await alterarCancelamentoCompromisso('c1', { cancelado: false, versao: 3 }, 'TODAS');
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos/c1/situacao?escopo=TODAS', { metodo: 'POST', corpo: { cancelado: false, versao: 3 } });
    await alterarSituacaoDoAluno('c1', 'a/1', { situacao: 'REALIZADO', versao: 3 });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos/c1/alunos/a%2F1/situacao', { metodo: 'POST', corpo: { situacao: 'REALIZADO', versao: 3 } });
    await alterarSituacaoDoAluno('c1', 'a1', { situacao: 'CANCELADO', versao: 3 }, 'SEGUINTES');
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos/c1/alunos/a1/situacao?escopo=SEGUINTES', { metodo: 'POST', corpo: { situacao: 'CANCELADO', versao: 3 } });
    await expect(listarAlunosOcupados({ data: '2026-11-02', hora: '09:00', duracaoMinutos: 60, alunoIds: ['a', 'b'] }))
      .resolves.toBe('/agenda/compromissos/alunos-ocupados?data=2026-11-02&hora=09%3A00&duracaoMinutos=60&alunoIds=a&alunoIds=b');
    await expect(listarAlunosOcupados({ data: '2026-11-02', hora: '09:00', duracaoMinutos: 30, alunoIds: ['a'], ignorar: 'c/1' }))
      .resolves.toBe('/agenda/compromissos/alunos-ocupados?data=2026-11-02&hora=09%3A00&duracaoMinutos=30&alunoIds=a&ignorar=c%2F1');
    await expect(compromissosDoAluno()).resolves.toBe('/aluno/compromissos');
    await expect(avisosDeCompromisso()).resolves.toBe('/aluno/avisos-de-compromisso');
    await marcarAvisoDeCompromissoVisto('av/1');
    expect(requisicao).toHaveBeenLastCalledWith('/aluno/avisos-de-compromisso/av%2F1/visto', { metodo: 'POST' });
  });

  it('calendário: agendas pessoais com id codificado e versão na query do DELETE', async () => {
    await expect(listarAgendasPessoais()).resolves.toBe('/agenda/agendas');
    await criarAgendaPessoal({ nome: 'Pessoal', cor: 'AZUL' });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/agendas', { metodo: 'POST', corpo: { nome: 'Pessoal', cor: 'AZUL' } });
    await alterarAgendaPessoal('../a', { nome: 'Casa', cor: 'TERRA', versao: 2 });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/agendas/..%2Fa', { metodo: 'PUT', corpo: { nome: 'Casa', cor: 'TERRA', versao: 2 } });
    await expect(contarEventosDaAgenda('a/1')).resolves.toBe('/agenda/agendas/a%2F1/contagem');
    await apagarAgendaPessoal('a1', 3);
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/agendas/a1?versao=3', { metodo: 'DELETE' });
  });

  it('calendário: eventos (período, agendas repetidas, escopo e ocorrência só quando valem) e resumo do Ano', async () => {
    await expect(listarEventos({ de: '2026-10-26', ate: '2026-12-06' })).resolves.toBe('/agenda/eventos?de=2026-10-26&ate=2026-12-06');
    await expect(listarEventos({ de: '2026-10-26', ate: '2026-12-06', agendas: ['a', 'b/1'] }))
      .resolves.toBe('/agenda/eventos?de=2026-10-26&ate=2026-12-06&agendas=a&agendas=b%2F1');
    await expect(detalheDoEvento('e/1')).resolves.toBe('/agenda/eventos/e%2F1');
    await expect(detalheDoEvento('e1', '2026-11-05')).resolves.toBe('/agenda/eventos/e1?ocorrencia=2026-11-05');
    const corpo = {
      agendaId: 'a', titulo: 'Reunião', local: null, descricao: null, data: '2026-11-05', diaInteiro: false, hora: '09:00',
      duracaoMinutos: 60, repeticao: null,
    };
    await criarEvento(corpo);
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/eventos', { metodo: 'POST', corpo });
    const pergunta = { eventoId: 'e1', data: '2026-11-05', diaInteiro: false, hora: '09:00', duracaoMinutos: 60, repeticao: { tipo: 'DIARIA' as const } };
    await cruzamentosDoEvento(pergunta);
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/eventos/cruzamentos', { metodo: 'POST', corpo: pergunta });
    await alterarEvento('e1', { ...corpo, versao: 4 });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/eventos/e1', { metodo: 'PUT', corpo: { ...corpo, versao: 4 } });
    await alterarEvento('e1', { ...corpo, versao: 4 }, { escopo: 'ESTA', ocorrencia: '2026-11-05' });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/eventos/e1?ocorrencia=2026-11-05', { metodo: 'PUT', corpo: { ...corpo, versao: 4 } });
    await alterarEvento('e1', { ...corpo, versao: 4 }, { escopo: 'SEGUINTES', ocorrencia: '2026-11-05' });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/eventos/e1?escopo=SEGUINTES&ocorrencia=2026-11-05', { metodo: 'PUT', corpo: { ...corpo, versao: 4 } });
    await alterarEvento('e1', { ...corpo, versao: 4 }, { escopo: 'TODAS' });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/eventos/e1?escopo=TODAS', { metodo: 'PUT', corpo: { ...corpo, versao: 4 } });
    await excluirEvento('e1', 4);
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/eventos/e1?versao=4', { metodo: 'DELETE' });
    await excluirEvento('e/1', 4, { escopo: 'TODAS', ocorrencia: '2026-11-05' });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/eventos/e%2F1?versao=4&escopo=TODAS&ocorrencia=2026-11-05', { metodo: 'DELETE' });
    await expect(resumoDaAgenda({ de: '2026-01-01', ate: '2026-12-31' })).resolves.toBe('/agenda/resumo?de=2026-01-01&ate=2026-12-31');
    await expect(resumoDaAgenda({ de: '2026-01-01', ate: '2026-12-31', responsavel: 'u/1', situacao: 'AGENDADO', agendas: ['a'] }))
      .resolves.toBe('/agenda/resumo?de=2026-01-01&ate=2026-12-31&responsavel=u%2F1&situacao=AGENDADO&agendas=a');
  });

  it('atualizações: `meus` como sempre; `responsavel` troca o `meus`; de/ate só em par', async () => {
    await expect(listarAtualizacoes('PROXIMAS')).resolves.toBe('/atualizacoes?situacao=PROXIMAS&meus=false');
    await expect(listarAtualizacoes('PROXIMAS', true)).resolves.toBe('/atualizacoes?situacao=PROXIMAS&meus=true');
    await expect(listarAtualizacoes('PROXIMAS', false, { responsavel: 'u/1', de: '2026-11-01', ate: '2026-11-30' }))
      .resolves.toBe('/atualizacoes?situacao=PROXIMAS&responsavel=u%2F1&de=2026-11-01&ate=2026-11-30');
    await expect(listarAtualizacoes('PROXIMAS', true, { responsavel: 'u1' })).resolves.toBe('/atualizacoes?situacao=PROXIMAS&responsavel=u1');
    await expect(listarAtualizacoes('PROXIMAS', false, { de: '2026-11-01' })).resolves.toBe('/atualizacoes?situacao=PROXIMAS&meus=false');
  });

  it('uuid comum passa igual', async () => {
    await expect(buscarQuestionario('5d1c2a40-0000-4000-8000-000000000001')).resolves.toBe('/questionarios/5d1c2a40-0000-4000-8000-000000000001');
  });
});
