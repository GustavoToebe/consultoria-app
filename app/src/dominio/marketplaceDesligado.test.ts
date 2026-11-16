import { ErroApi } from '@plataforma/web';

import { ehMarketplaceDesligado } from './marketplaceDesligado';

describe('ehMarketplaceDesligado', () => {
  it('só o 503 MARKETPLACE_INDISPONIVEL', () => {
    expect(ehMarketplaceDesligado(new ErroApi(503, 'MARKETPLACE_INDISPONIVEL', 'Indisponível.'))).toBe(true);
  });

  it('outros 503, outros status e o que não é ErroApi não valem', () => {
    expect(ehMarketplaceDesligado(new ErroApi(503, 'LOJA_INDISPONIVEL', 'x'))).toBe(false);
    expect(ehMarketplaceDesligado(new ErroApi(503, null, 'x'))).toBe(false);
    expect(ehMarketplaceDesligado(new ErroApi(409, 'MARKETPLACE_INDISPONIVEL', 'x'))).toBe(false);
    expect(ehMarketplaceDesligado(new ErroApi(0, 'SEM_CONEXAO', 'x'))).toBe(false);
    expect(ehMarketplaceDesligado({ status: 503, codigo: 'MARKETPLACE_INDISPONIVEL' })).toBe(false);
    expect(ehMarketplaceDesligado(null)).toBe(false);
  });
});
