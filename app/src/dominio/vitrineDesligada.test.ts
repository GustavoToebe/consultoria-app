import { ErroApi } from '@plataforma/web';

import { ehVitrineDesligada } from './vitrineDesligada';

describe('ehVitrineDesligada', () => {
  it('503 com o código da vitrine desligada é a vitrine desligada', () => {
    expect(ehVitrineDesligada(new ErroApi(503, 'VITRINE_INDISPONIVEL', 'A vitrine não está disponível.'))).toBe(true);
  });

  it('o resto não é', () => {
    expect(ehVitrineDesligada(new ErroApi(503, 'LOJA_INDISPONIVEL', 'Indisponível.'))).toBe(false);
    expect(ehVitrineDesligada(new ErroApi(503, 'FINANCEIRO_INDISPONIVEL', 'Indisponível.'))).toBe(false);
    expect(ehVitrineDesligada(new ErroApi(503, null, 'Indisponível.'))).toBe(false);
    expect(ehVitrineDesligada(new ErroApi(409, 'VITRINE_INDISPONIVEL', 'x'))).toBe(false);
    expect(ehVitrineDesligada(new ErroApi(409, 'VITRINE_LIMITE', 'Limite.'))).toBe(false);
    expect(ehVitrineDesligada(new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão.'))).toBe(false);
    expect(ehVitrineDesligada(new Error('VITRINE_INDISPONIVEL'))).toBe(false);
    expect(ehVitrineDesligada({ status: 503, codigo: 'VITRINE_INDISPONIVEL' })).toBe(false);
    expect(ehVitrineDesligada(null)).toBe(false);
  });
});
