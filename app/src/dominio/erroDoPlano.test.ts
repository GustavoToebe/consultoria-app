import { ErroApi } from '@plataforma/web';

import { erroDoPlano, mensagemDoErroDoPlano } from './erroDoPlano';

const limite = new ErroApi(409, 'LIMITE_DO_PLANO', 'Seu plano permite até 10 alunos ativos.', [
  { field: 'alunos_ativos', message: 'Seu plano permite até 10 alunos ativos.' },
]);
const fora = new ErroApi(403, 'FUNCIONALIDADE_FORA_DO_PLANO', 'Este recurso não está disponível no seu plano.', [
  { field: 'PDF', message: 'x' },
]);

describe('erro do plano', () => {
  it('reconhece os dois códigos', () => {
    expect(erroDoPlano(limite)).toBe(true);
    expect(erroDoPlano(fora)).toBe(true);
  });

  it('ignora outros erros', () => {
    expect(erroDoPlano(new ErroApi(409, 'CONFLITO_EDICAO', 'x'))).toBe(false);
    expect(erroDoPlano(new Error('x'))).toBe(false);
    expect(erroDoPlano(null)).toBe(false);
    expect(erroDoPlano('LIMITE_DO_PLANO')).toBe(false);
    expect(mensagemDoErroDoPlano(new ErroApi(500, null, 'x'))).toBeNull();
  });

  it('limite usa a mensagem da API', () => {
    expect(mensagemDoErroDoPlano(limite)).toBe('Seu plano permite até 10 alunos ativos.');
  });

  it('limite sem mensagem usa um texto padrão', () => {
    expect(mensagemDoErroDoPlano(new ErroApi(409, 'LIMITE_DO_PLANO', ' '))).toBe('Seu plano atingiu o limite.');
  });

  it('funcionalidade fora do plano diz "Disponível em outro plano."', () => {
    expect(mensagemDoErroDoPlano(fora)).toBe('Disponível em outro plano.');
  });
});
