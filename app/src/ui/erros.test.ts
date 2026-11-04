import { ErroApi } from '../api/cliente';
import { erroDeMfaNoCampo, erroDeSenhaNoCampo, focarPrimeiroComErro, separarErros } from './erros';

const comCampos = (...campos: [string, string][]) =>
  new ErroApi(400, 'VALIDACAO', 'Dados inválidos.', campos.map(([field, message]) => ({ field, message })));

describe('separarErros', () => {
  it('campo que está na tela vai para o campo, sem alerta', () => {
    expect(separarErros(comCampos(['email', 'E-mail inválido.']), ['email', 'senha'])).toEqual({
      campos: { email: 'E-mail inválido.' }, geral: null,
    });
  });

  it('campo que a tela não mostra (token do link) vai ao alerta com a mensagem dele, junto dos que ela mostra', () => {
    expect(separarErros(comCampos(['token', 'Link inválido.'], ['novaSenha', 'Curta.']), ['novaSenha'])).toEqual({
      campos: { novaSenha: 'Curta.' }, geral: 'Link inválido.',
    });
    expect(separarErros(comCampos(['token', 'Link inválido.'], ['codigo', 'Vencido.']), ['novaSenha']).geral)
      .toBe('Link inválido. Vencido.');
  });

  it('erro sem campo (401, 409, rede) fica no alerta, com o texto dado por quem chamou', () => {
    expect(separarErros(new ErroApi(401, null, 'E-mail ou senha incorretos.'), ['email'])).toEqual({
      campos: {}, geral: 'E-mail ou senha incorretos.',
    });
    expect(separarErros(new ErroApi(0, null, 'Sem conexão.'), ['email'], 'Outro texto.').geral).toBe('Outro texto.');
  });
});

describe('erro no campo das telas públicas', () => {
  it('regra de senha (400 sem campo) vai para o campo; link, verificação humana e MFA não', () => {
    expect(erroDeSenhaNoCampo(new ErroApi(400, null, 'A senha precisa ter pelo menos 8 caracteres.')))
      .toBe('A senha precisa ter pelo menos 8 caracteres.');
    expect(erroDeSenhaNoCampo(new ErroApi(400, 'LINK_INVALIDO', 'Este link não funciona mais.'))).toBeNull();
    expect(erroDeSenhaNoCampo(new ErroApi(400, 'VERIFICACAO_HUMANA', 'Confirme que você é uma pessoa.'))).toBeNull();
    expect(erroDeSenhaNoCampo(comCampos(['novaSenha', 'Curta.']))).toBeNull();
    expect(erroDeSenhaNoCampo(new ErroApi(401, null, 'E-mail ou senha incorretos.'))).toBeNull();
  });

  it('código de verificação recusado vai para o campo do código', () => {
    expect(erroDeMfaNoCampo(new ErroApi(401, 'MFA_CODIGO_INVALIDO', 'Código incorreto.'))).toBe('Código incorreto.');
    expect(erroDeMfaNoCampo(new ErroApi(401, 'MFA_NECESSARIO', 'Informe o código.'))).toBeNull();
  });
});

describe('focarPrimeiroComErro', () => {
  it('foca o primeiro campo com erro na ordem da tela, depois do clique', () => {
    jest.useFakeTimers();
    const email = { current: { focus: jest.fn() } };
    const senha = { current: { focus: jest.fn() } };
    focarPrimeiroComErro({ senha: 'Informe a senha.' }, [['email', email], ['senha', senha]] as never);
    expect(senha.current.focus).not.toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    expect(email.current.focus).not.toHaveBeenCalled();
    expect(senha.current.focus).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
