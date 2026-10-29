import { ErroApi } from '@plataforma/web';

import { ehRetornoDesligado } from './retornoDesligado';

describe('ehRetornoDesligado', () => {
  it('503 com o código do recurso desligado é o retorno desligado', () => {
    expect(ehRetornoDesligado(new ErroApi(503, 'RETORNO_INDISPONIVEL', 'Recurso indisponível.'))).toBe(true);
  });

  it('o resto não é, inclusive outros 503', () => {
    expect(ehRetornoDesligado(new ErroApi(503, 'CICLO_INDISPONIVEL_NO_APP', 'Indisponível.'))).toBe(false);
    expect(ehRetornoDesligado(new ErroApi(503, 'FINANCEIRO_INDISPONIVEL', 'Indisponível.'))).toBe(false);
    expect(ehRetornoDesligado(new ErroApi(503, null, 'Indisponível.'))).toBe(false);
    expect(ehRetornoDesligado(new ErroApi(409, 'RETORNO_INDISPONIVEL', 'Indisponível.'))).toBe(false);
    expect(ehRetornoDesligado(new ErroApi(500, 'RETORNO_INDISPONIVEL', 'Erro.'))).toBe(false);
    expect(ehRetornoDesligado(new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão.'))).toBe(false);
    expect(ehRetornoDesligado(new Error('RETORNO_INDISPONIVEL'))).toBe(false);
    expect(ehRetornoDesligado({ status: 503, codigo: 'RETORNO_INDISPONIVEL' })).toBe(false);
    expect(ehRetornoDesligado(null)).toBe(false);
    expect(ehRetornoDesligado(undefined)).toBe(false);
  });
});
