import { requisicao } from './cliente';
import {
  aceitarInscricao, alterarCompromisso, alterarSituacaoCompromisso, aplicarAlteracaoDaAnamnese, compromissosDoAluno, criarCompromisso, listarCompromissos, buscarQuestionario, descartarAlteracaoDaAnamnese, fatoresDosAlimentos, inscricao, inscricaoPublica, listarPlanos,
  retornoDoPagamento,
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
    const corpo = { alunoId: 'a', responsavelId: 'r', data: '2026-11-02', hora: '09:00', duracaoMinutos: 60, local: null, observacao: null };
    await criarCompromisso(corpo);
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos', { metodo: 'POST', corpo });
    await alterarCompromisso('../x', { ...corpo, versao: 2 });
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos/..%2Fx', { metodo: 'PUT', corpo: { ...corpo, versao: 2 } });
    await alterarSituacaoCompromisso('c1', 'REALIZADO', 3);
    expect(requisicao).toHaveBeenLastCalledWith('/agenda/compromissos/c1/situacao', { metodo: 'POST', corpo: { situacao: 'REALIZADO', versao: 3 } });
    await expect(compromissosDoAluno()).resolves.toBe('/aluno/compromissos');
  });

  it('uuid comum passa igual', async () => {
    await expect(buscarQuestionario('5d1c2a40-0000-4000-8000-000000000001')).resolves.toBe('/questionarios/5d1c2a40-0000-4000-8000-000000000001');
  });
});
