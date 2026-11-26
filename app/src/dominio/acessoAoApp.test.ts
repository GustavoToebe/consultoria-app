import { ErroApi } from '@plataforma/web';

import {
  acoesDoAcesso, comMotivoVisivel, ehFinanceiroIndisponivel, errosDoNovoEmail, MENSAGEM_EMAIL_EM_USO, MENSAGEM_FINANCEIRO_INDISPONIVEL,
  MOTIVO_SEM_COBRANCA_VENCIDA, motivoDoAcesso, motivoVisivel, notaDoAcessoDesativado, seloDoMotivo,
  TEXTO_ACESSO_DESATIVADO, TEXTO_ACESSO_PAUSADO, traduzirErroDoAcesso, ultimoLoginNaLinha,
} from './acessoAoApp';
import { seloDaSituacao } from './cabecalhoDaFicha';
import { seloDoAcesso } from './cadastroDoAluno';
import { selosDeExcecaoDoAluno } from './selosDaLinhaDeAluno';

// Acesso ao app: desativar (25/11) e pausar por atraso (26/11), um cartão e um selo.
describe('selo e nota do acesso desativado ou pausado', () => {
  const agora = new Date('2026-11-25T15:00:00Z');
  test('motivo: o da API, nulo sem ele', () => {
    expect(motivoDoAcesso({ acessoDesativadoMotivo: 'MANUAL' })).toBe('MANUAL');
    expect(motivoDoAcesso({ acessoDesativadoMotivo: 'ATRASO' })).toBe('ATRASO');
    expect(motivoDoAcesso({ acessoDesativadoMotivo: null })).toBeNull();
    expect(motivoDoAcesso({})).toBeNull();
  });
  test('selo: pausado âmbar, desativado neutro com o ponto, as mesmas palavras de todo lugar', () => {
    expect(seloDoMotivo('ATRASO')).toEqual({ texto: TEXTO_ACESSO_PAUSADO, tipo: 'atencao' });
    expect(seloDoMotivo('MANUAL')).toEqual({ texto: TEXTO_ACESSO_DESATIVADO, tipo: 'neutro', ponto: true });
    expect(seloDoMotivo(null)).toBeNull();
    expect([TEXTO_ACESSO_PAUSADO, TEXTO_ACESSO_DESATIVADO]).toEqual(['Acesso pausado', 'Acesso desativado']);
  });
  test('nota: a data de Brasília sem o ano corrente, no selo nunca', () => {
    expect(notaDoAcessoDesativado('MANUAL', '2026-11-20T12:00:00Z', agora)).toBe('Desativado em 20/11. O aluno não entra até ser reativado. Nada foi apagado.');
    // 01:30 UTC de 20/11 ainda é 19/11 em Brasília.
    expect(notaDoAcessoDesativado('MANUAL', '2026-11-20T01:30:00Z', agora)).toMatch(/^Desativado em 19\/11\./);
    expect(notaDoAcessoDesativado('ATRASO', '2025-12-30T12:00:00Z', agora)).toBe('Pausado em 30/12/2025 por cobrança vencida. O aluno só vê as cobranças em aberto; o acesso volta ao quitar.');
  });
  test('nota sem data ou com data malformada: só a frase', () => {
    expect(notaDoAcessoDesativado('MANUAL', null, agora)).toBe('O aluno não entra até ser reativado. Nada foi apagado.');
    expect(notaDoAcessoDesativado('ATRASO', 'ontem', agora)).toMatch(/^O aluno só vê as cobranças em aberto/);
  });
});

// Sem FINANCEIRO_LER o atraso não aparece (26/11): o ATRASO vira MANUAL antes de qualquer selo, nota ou ação.
describe('motivoVisivel', () => {
  test('ATRASO sem FINANCEIRO_LER é MANUAL; com ele, o que veio; o resto não muda', () => {
    expect(motivoVisivel('ATRASO', false)).toBe('MANUAL');
    expect(motivoVisivel('ATRASO', true)).toBe('ATRASO');
    expect(motivoVisivel('MANUAL', false)).toBe('MANUAL');
    expect(motivoVisivel(null, false)).toBeNull();
    expect(motivoVisivel(undefined, false)).toBeNull();
  });
  test('comMotivoVisivel troca só o motivo e devolve o mesmo objeto quando nada muda', () => {
    const atraso = { id: 'a', acessoDesativadoMotivo: 'ATRASO' as const };
    expect(comMotivoVisivel(atraso, false)).toEqual({ id: 'a', acessoDesativadoMotivo: 'MANUAL' });
    expect(atraso.acessoDesativadoMotivo).toBe('ATRASO');
    expect(comMotivoVisivel(atraso, true)).toBe(atraso);
    const livre = { id: 'b', acessoDesativadoMotivo: null };
    expect(comMotivoVisivel(livre, false)).toBe(livre);
  });
  test('ATRASO sem FINANCEIRO_LER nunca vira "Acesso pausado", a nota de cobrança vencida nem a ação de pausa', () => {
    const base = { ativo: true, anonimizado: false, temAcesso: true, aguardandoPrimeiroAcesso: false };
    const aluno = comMotivoVisivel({ ...base, acessoDesativadoMotivo: 'ATRASO' as const }, false);
    const motivo = motivoDoAcesso(aluno);
    expect(seloDoAcesso(aluno)).toEqual({ texto: TEXTO_ACESSO_DESATIVADO, tipo: 'neutro', ponto: true });
    expect(seloDaSituacao(aluno).texto).toBe(TEXTO_ACESSO_DESATIVADO);
    expect(selosDeExcecaoDoAluno({ ativo: true, temAcesso: true, emAtraso: false, acessoDesativadoMotivo: motivo })).toEqual([
      { texto: TEXTO_ACESSO_DESATIVADO, tipo: 'neutro', ponto: true }]);
    expect(notaDoAcessoDesativado(motivo!, '2026-11-20T12:00:00Z', new Date('2026-11-25T15:00:00Z'))).not.toMatch(/Pausado|cobrança vencida/);
    // Sem FINANCEIRO_LER a tela também não pode pausar nem reativar pelo Financeiro.
    expect(acoesDoAcesso(aluno, { convite: true, financeiro: false, pausarVisivel: false }, null)).toEqual({ reativar: 'desativacao', pausar: null, desativar: false });
  });
});

describe('acoesDoAcesso', () => {
  const ativo = { ativo: true, anonimizado: false, temAcesso: true, acessoDesativadoMotivo: null } as const;
  const tudo = { convite: true, financeiro: true, pausarVisivel: true };
  test('acesso normal: pausar (com cobrança vencida) e desativar no ⋯, sem reativar', () => {
    expect(acoesDoAcesso(ativo, tudo, true)).toEqual({ reativar: null, pausar: { motivo: null }, desativar: true });
  });
  test('sem cobrança vencida: pausar desabilitado com o motivo; sem saber (null), habilitado', () => {
    expect(acoesDoAcesso(ativo, tudo, false).pausar).toEqual({ motivo: MOTIVO_SEM_COBRANCA_VENCIDA });
    expect(acoesDoAcesso(ativo, tudo, null).pausar).toEqual({ motivo: null });
  });
  test('cada ação só com a sua permissão', () => {
    expect(acoesDoAcesso(ativo, { ...tudo, financeiro: false }, true)).toEqual({ reativar: null, pausar: null, desativar: true });
    expect(acoesDoAcesso(ativo, { ...tudo, convite: false }, true)).toEqual({ reativar: null, pausar: { motivo: null }, desativar: false });
    // Financeiro desligado: sem a cobrança vencida para conferir, o pausar some.
    expect(acoesDoAcesso(ativo, { ...tudo, pausarVisivel: false }, null).pausar).toBeNull();
  });
  test('MANUAL: só o reativar da equipe (ALUNO_CONVITE); nada no ⋯', () => {
    const manual = { ...ativo, acessoDesativadoMotivo: 'MANUAL' } as const;
    expect(acoesDoAcesso(manual, tudo, true)).toEqual({ reativar: 'desativacao', pausar: null, desativar: false });
    expect(acoesDoAcesso(manual, { ...tudo, convite: false }, true).reativar).toBeNull();
  });
  test('ATRASO: o reativar do Financeiro e, no ⋯, só desativar (troca para MANUAL)', () => {
    const atraso = { ...ativo, acessoDesativadoMotivo: 'ATRASO' } as const;
    expect(acoesDoAcesso(atraso, tudo, true)).toEqual({ reativar: 'pausa', pausar: null, desativar: true });
    expect(acoesDoAcesso(atraso, { ...tudo, financeiro: false }, true).reativar).toBeNull();
    // Pausado sem conta (a API deixa): reativar ainda aparece; desativar não (409 ALUNO_SEM_ACESSO).
    expect(acoesDoAcesso({ ...atraso, temAcesso: false }, tudo, true)).toEqual({ reativar: 'pausa', pausar: null, desativar: false });
  });
  test('sem conta: nada a pausar nem desativar', () => {
    expect(acoesDoAcesso({ ...ativo, temAcesso: false }, tudo, true)).toEqual({ reativar: null, pausar: null, desativar: false });
  });
  test('inativo ou anonimizado: nenhuma ação, nem reativar', () => {
    expect(acoesDoAcesso({ ...ativo, ativo: false, acessoDesativadoMotivo: 'MANUAL' }, tudo, true)).toEqual({ reativar: null, pausar: null, desativar: false });
    expect(acoesDoAcesso({ ...ativo, anonimizado: true, acessoDesativadoMotivo: 'ATRASO' }, tudo, true)).toEqual({ reativar: null, pausar: null, desativar: false });
  });
});

describe('errosDoNovoEmail', () => {
  const atual = 'aluno@exemplo.test';
  test('vazio, formato e confirmação vazia', () => {
    expect(errosDoNovoEmail('', '', atual)).toEqual({ email: 'Informe o novo e-mail.', confirmacao: 'Repita o novo e-mail.' });
    expect(errosDoNovoEmail('sem-arroba', 'sem-arroba', atual).email).toBe('Informe um e-mail válido, como nome@exemplo.com.');
    expect(errosDoNovoEmail(`${'a'.repeat(250)}@x.test`, '', atual).email).toBe('Informe um e-mail válido, como nome@exemplo.com.');
  });
  test('igual ao atual, sem diferença de caixa nem espaços', () => {
    expect(errosDoNovoEmail('  ALUNO@exemplo.test ', 'aluno@exemplo.test', atual).email).toBe('Este já é o e-mail de acesso do aluno. Informe outro.');
  });
  test('os dois precisam ser iguais (caixa não conta)', () => {
    expect(errosDoNovoEmail('novo@exemplo.test', 'outro@exemplo.test', atual)).toEqual({ confirmacao: 'Os dois e-mails não são iguais.' });
    expect(errosDoNovoEmail('novo@exemplo.test', ' NOVO@exemplo.test', atual)).toEqual({});
    expect(errosDoNovoEmail('novo@exemplo.test', 'novo@exemplo.test', null)).toEqual({});
  });
});

describe('traduzirErroDoAcesso', () => {
  test('e-mail em uso vai para o campo, com o texto do app', () => {
    expect(traduzirErroDoAcesso(new ErroApi(409, 'EMAIL_EM_USO', 'Conflito.'))).toEqual({ campos: { email: MENSAGEM_EMAIL_EM_USO }, mensagem: null });
  });
  test('recusas pelo código, não pelo texto da API', () => {
    expect(traduzirErroDoAcesso(new ErroApi(409, 'ACESSO_DESATIVADO', 'x')).mensagem).toMatch(/^O acesso deste aluno está desativado\./);
    expect(traduzirErroDoAcesso(new ErroApi(409, 'ALUNO_SEM_ACESSO', 'x')).mensagem).toMatch(/ainda não tem conta/);
    expect(traduzirErroDoAcesso(new ErroApi(409, 'ALUNO_INATIVO', 'x')).mensagem).toMatch(/^Aluno inativo: reative pelo menu ⋯ do aluno/);
    // 26/11: pausar quem a equipe desativou e pausar sem cobrança vencida, pelo código.
    expect(traduzirErroDoAcesso(new ErroApi(409, 'ACESSO_JA_DESATIVADO', 'x')).mensagem).toBe('O acesso deste aluno foi desativado pela equipe. Só "Reativar acesso", em Acesso ao app, o libera.');
    expect(traduzirErroDoAcesso(new ErroApi(409, 'SEM_COBRANCA_VENCIDA', 'x')).mensagem).toMatch(/não tem cobrança vencida em aberto/);
  });
  test('outro erro: a mensagem da API', () => {
    expect(traduzirErroDoAcesso(new ErroApi(500, null, 'Falhou no servidor.'))).toEqual({ campos: {}, mensagem: 'Falhou no servidor.' });
  });
});

// ficha: acesso ao app (24/11)
describe('503 FINANCEIRO_INDISPONIVEL ao pausar', () => {
  test('é reconhecido pelo código e tem o texto fixo do toast; outros erros não', () => {
    expect(MENSAGEM_FINANCEIRO_INDISPONIVEL).toBe('Não foi possível verificar as cobranças agora. Tente de novo em instantes.');
    expect(ehFinanceiroIndisponivel(new ErroApi(503, 'FINANCEIRO_INDISPONIVEL', 'Desligado.'))).toBe(true);
    expect(ehFinanceiroIndisponivel(new ErroApi(409, 'SEM_COBRANCA_VENCIDA', 'x'))).toBe(false);
    expect(ehFinanceiroIndisponivel(new ErroApi(500, null, 'x'))).toBe(false);
    expect(ehFinanceiroIndisponivel(new Error('x'))).toBe(false);
  });
});

describe('ultimoLoginNaLinha', () => {
  // 23/11/2026 12:00 em Brasília.
  const agora = new Date('2026-11-23T15:00:00Z');

  test('hoje e ontem com a hora de Brasília; a data completa na dica', () => {
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: '2026-11-23T13:05:00Z' }, agora)).toEqual({ rotulo: 'Último login', texto: 'Hoje, 10:05', exata: '23/11/2026 às 10:05' });
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: '2026-11-22T21:38:00Z' }, agora)).toEqual({ rotulo: 'Último login', texto: 'Ontem, 18:38', exata: '22/11/2026 às 18:38' });
  });

  test('a virada do dia é a de Brasília, não a do UTC', () => {
    // 01:00 UTC de 23/11 ainda é 22h de 22/11 em Brasília.
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: '2026-11-23T01:00:00Z' }, agora).texto).toBe('Ontem, 22:00');
  });

  test('mais longe: data curta e hora; o ano só se for outro', () => {
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: '2026-11-17T15:30:00Z' }, agora).texto).toBe('17/11 12:30');
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: '2025-12-30T15:30:00Z' }, agora).texto).toBe('30/12/2025 12:30');
  });

  test('ACESSO diz "Último acesso ao app"; login nunca é chamado de acesso', () => {
    expect(ultimoLoginNaLinha({ tipo: 'ACESSO', em: '2026-11-23T13:05:00Z' }, agora).rotulo).toBe('Último acesso ao app');
  });

  test('nunca entrou, instante malformado ou tipo desconhecido: "Último login" sem texto', () => {
    const vazio = { rotulo: 'Último login', texto: null, exata: null };
    expect(ultimoLoginNaLinha(null, agora)).toEqual(vazio);
    expect(ultimoLoginNaLinha(undefined, agora)).toEqual(vazio);
    expect(ultimoLoginNaLinha({ tipo: 'LOGIN', em: 'ontem' }, agora)).toEqual(vazio);
    expect(ultimoLoginNaLinha({ tipo: 'OUTRO' as never, em: '2026-11-23T12:00:00Z' }, agora)).toEqual(vazio);
  });
});
