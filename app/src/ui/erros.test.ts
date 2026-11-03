import { ErroApi } from '../api/cliente';
import { focarPrimeiroComErro, separarErros } from './erros';

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

describe('focarPrimeiroComErro', () => {
  it('foca o primeiro campo com erro na ordem da tela', () => {
    const email = { current: { focus: jest.fn() } };
    const senha = { current: { focus: jest.fn() } };
    focarPrimeiroComErro({ senha: 'Informe a senha.' }, [['email', email], ['senha', senha]] as never);
    expect(email.current.focus).not.toHaveBeenCalled();
    expect(senha.current.focus).toHaveBeenCalledTimes(1);
  });
});
