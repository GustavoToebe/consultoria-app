import { ErroApi } from '@plataforma/web';

import { acessoDesativado, errosDoNovoEmail, MENSAGEM_EMAIL_EM_USO, textoDoDesativado, traduzirErroDoAcesso, ultimoLoginNaLinha } from './acessoAoApp';

// Acesso ao app: alterar e-mail e desativar (25/11)
describe('acesso desativado', () => {
  const agora = new Date('2026-11-25T15:00:00Z');
  test('só com conta e a data de desativação', () => {
    expect(acessoDesativado({ temAcesso: true, acessoDesativadoEm: '2026-11-20T12:00:00Z' })).toBe(true);
    expect(acessoDesativado({ temAcesso: true, acessoDesativadoEm: null })).toBe(false);
    expect(acessoDesativado({ temAcesso: true })).toBe(false);
    expect(acessoDesativado({ temAcesso: false, acessoDesativadoEm: '2026-11-20T12:00:00Z' })).toBe(false);
  });
  test('a data é a de Brasília, sem o ano corrente', () => {
    expect(textoDoDesativado('2026-11-20T12:00:00Z', agora)).toBe('Sem acesso (desativado em 20/11)');
    // 01:30 UTC de 20/11 ainda é 19/11 em Brasília.
    expect(textoDoDesativado('2026-11-20T01:30:00Z', agora)).toBe('Sem acesso (desativado em 19/11)');
    expect(textoDoDesativado('2025-12-30T12:00:00Z', agora)).toBe('Sem acesso (desativado em 30/12/2025)');
  });
  test('sem data ou malformada: só "Sem acesso"', () => {
    expect(textoDoDesativado(null, agora)).toBe('Sem acesso');
    expect(textoDoDesativado(undefined, agora)).toBe('Sem acesso');
    expect(textoDoDesativado('ontem', agora)).toBe('Sem acesso');
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
    expect(traduzirErroDoAcesso(new ErroApi(409, 'ALUNO_INATIVO', 'x')).mensagem).toMatch(/^Aluno inativo/);
  });
  test('outro erro: a mensagem da API', () => {
    expect(traduzirErroDoAcesso(new ErroApi(500, null, 'Falhou no servidor.'))).toEqual({ campos: {}, mensagem: 'Falhou no servidor.' });
  });
});

// ficha: acesso ao app (24/11)
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
