import { ErroApi } from '@plataforma/web';

import { ehCicloDesligado } from './cicloDesligado';

describe('ehCicloDesligado', () => {
  it('503 com o código do módulo desligado é o ciclo desligado', () => {
    expect(ehCicloDesligado(new ErroApi(503, 'CICLO_INDISPONIVEL_NO_APP', 'O acompanhamento do ciclo não está disponível.'))).toBe(true);
  });

  it('o resto não é', () => {
    expect(ehCicloDesligado(new ErroApi(503, 'FINANCEIRO_INDISPONIVEL', 'Indisponível.'))).toBe(false);
    expect(ehCicloDesligado(new ErroApi(503, null, 'Indisponível.'))).toBe(false);
    // Sexo diferente de Feminino ao gravar: mesma mensagem, outro erro (continua aparecendo na tela).
    expect(ehCicloDesligado(new ErroApi(409, 'CICLO_INDISPONIVEL', 'O acompanhamento do ciclo não está disponível.'))).toBe(false);
    expect(ehCicloDesligado(new ErroApi(500, 'CICLO_INDISPONIVEL_NO_APP', 'Erro.'))).toBe(false);
    expect(ehCicloDesligado(new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão.'))).toBe(false);
    expect(ehCicloDesligado(new Error('CICLO_INDISPONIVEL_NO_APP'))).toBe(false);
    expect(ehCicloDesligado({ status: 503, codigo: 'CICLO_INDISPONIVEL_NO_APP' })).toBe(false);
    expect(ehCicloDesligado(null)).toBe(false);
    expect(ehCicloDesligado(undefined)).toBe(false);
  });
});
