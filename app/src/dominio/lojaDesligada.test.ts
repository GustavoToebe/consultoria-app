import { ErroApi } from '@plataforma/web';

import { ehLojaDesligada } from './lojaDesligada';

describe('ehLojaDesligada', () => {
  it('só o 503 LOJA_INDISPONIVEL', () => {
    expect(ehLojaDesligada(new ErroApi(503, 'LOJA_INDISPONIVEL', 'Indisponível.'))).toBe(true);
  });

  it('o resto não é', () => {
    expect(ehLojaDesligada(new ErroApi(503, 'VITRINE_INDISPONIVEL', 'x'))).toBe(false);
    expect(ehLojaDesligada(new ErroApi(503, null, 'x'))).toBe(false);
    expect(ehLojaDesligada(new ErroApi(409, 'LOJA_INDISPONIVEL', 'x'))).toBe(false);
    expect(ehLojaDesligada(new ErroApi(0, 'SEM_CONEXAO', 'x'))).toBe(false);
    expect(ehLojaDesligada(new Error('LOJA_INDISPONIVEL'))).toBe(false);
    expect(ehLojaDesligada({ status: 503, codigo: 'LOJA_INDISPONIVEL' })).toBe(false);
    expect(ehLojaDesligada(null)).toBe(false);
  });
});
