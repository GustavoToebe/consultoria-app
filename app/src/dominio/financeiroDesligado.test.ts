import { ErroApi } from '@plataforma/web';

import { ehFinanceiroDesligado, TEXTO_RECURSO_DESATIVADO } from './financeiroDesligado';

describe('ehFinanceiroDesligado', () => {
  it('só o 503 do financeiro e do recebimento online desligados', () => {
    expect(ehFinanceiroDesligado(new ErroApi(503, 'FINANCEIRO_INDISPONIVEL', 'x'))).toBe(true);
    expect(ehFinanceiroDesligado(new ErroApi(503, 'RECEBIMENTO_ONLINE_INDISPONIVEL', 'x'))).toBe(true);
  });

  it('outro status, outro código ou erro de rede continuam sendo falha', () => {
    expect(ehFinanceiroDesligado(new ErroApi(500, 'FINANCEIRO_INDISPONIVEL', 'x'))).toBe(false);
    expect(ehFinanceiroDesligado(new ErroApi(503, 'RETORNO_INDISPONIVEL', 'x'))).toBe(false);
    expect(ehFinanceiroDesligado(new ErroApi(503, 'PAGAMENTO_INDISPONIVEL', 'x'))).toBe(false);
    expect(ehFinanceiroDesligado(new Error('rede'))).toBe(false);
    expect(ehFinanceiroDesligado(undefined)).toBe(false);
  });

  it('o texto é o do Gustavo', () => {
    expect(TEXTO_RECURSO_DESATIVADO).toBe('Recurso desativado');
  });
});
