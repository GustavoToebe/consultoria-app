import { avisoDeNaoEnviados, confirmouExclusao, motivoParaNaoExcluir, PALAVRA_DE_CONFIRMACAO } from './excluirConta';

describe('excluir a própria conta', () => {
  test('a palavra vale sem diferença de maiúsculas e sem espaços nas pontas, como no servidor', () => {
    expect(PALAVRA_DE_CONFIRMACAO).toBe('EXCLUIR');
    expect(confirmouExclusao('EXCLUIR')).toBe(true);
    expect(confirmouExclusao('  excluir ')).toBe(true);
    expect(confirmouExclusao('Excluir')).toBe(true);
    expect(confirmouExclusao('EXCLUI')).toBe(false);
    expect(confirmouExclusao('EXCLUIR CONTA')).toBe(false);
    expect(confirmouExclusao('')).toBe(false);
  });

  test('o botão final só libera com a senha e a palavra, dizendo o que falta', () => {
    expect(motivoParaNaoExcluir('', 'EXCLUIR')).toBe('Digite a sua senha.');
    expect(motivoParaNaoExcluir('senha-ficticia', 'apagar')).toBe('Digite EXCLUIR para confirmar.');
    expect(motivoParaNaoExcluir('senha-ficticia', 'excluir')).toBeNull();
  });

  test('avisa dos treinos não enviados só quando existem', () => {
    expect(avisoDeNaoEnviados(0)).toBeNull();
    expect(avisoDeNaoEnviados(1)).toContain('1 treino ainda não enviado');
    expect(avisoDeNaoEnviados(3)).toContain('3 treinos ainda não enviados');
  });
});
