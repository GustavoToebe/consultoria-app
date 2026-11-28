import { atalhoDoPeriodo, atalhosQueCabem, periodoDoAtalho, rotuloDeMostrar } from './atalhosDePeriodo';

describe('atalhos de período', () => {
  const hoje = '2026-11-28';

  it('calcula cada atalho a partir de hoje', () => {
    expect(periodoDoAtalho('HOJE', hoje)).toEqual({ de: '2026-11-28', ate: '2026-11-28' });
    expect(periodoDoAtalho('SETE_DIAS', hoje)).toEqual({ de: '2026-11-22', ate: '2026-11-28' });
    expect(periodoDoAtalho('TRINTA_DIAS', hoje)).toEqual({ de: '2026-10-30', ate: '2026-11-28' });
    expect(periodoDoAtalho('ESTE_MES', hoje)).toEqual({ de: '2026-11-01', ate: '2026-11-30' });
    expect(periodoDoAtalho('MES_PASSADO', hoje)).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
  });

  it('vira o ano no mês passado de janeiro e acerta fevereiro', () => {
    expect(periodoDoAtalho('MES_PASSADO', '2027-01-15')).toEqual({ de: '2026-12-01', ate: '2026-12-31' });
    expect(periodoDoAtalho('ESTE_MES', '2028-02-10')).toEqual({ de: '2028-02-01', ate: '2028-02-29' });
  });

  it('reconhece o atalho do período em vigor', () => {
    expect(atalhoDoPeriodo({ de: '2026-11-22', ate: '2026-11-28' }, hoje)).toBe('SETE_DIAS');
    expect(atalhoDoPeriodo({ de: '2026-11-01', ate: '2026-11-30' }, hoje)).toBe('ESTE_MES');
    expect(atalhoDoPeriodo({ de: '2026-11-02', ate: '2026-11-28' }, hoje)).toBeNull();
    expect(atalhoDoPeriodo({ de: '2026-11-28', ate: null }, hoje)).toBeNull();
  });

  it('esconde o atalho que passa do limite de dias', () => {
    expect(atalhosQueCabem(undefined, hoje)).toHaveLength(5);
    expect(atalhosQueCabem(7, hoje).map((a) => a.valor)).toEqual(['HOJE', 'SETE_DIAS']);
    expect(atalhosQueCabem(31, hoje).map((a) => a.valor)).toEqual(['HOJE', 'SETE_DIAS', 'TRINTA_DIAS', 'ESTE_MES', 'MES_PASSADO']);
  });

  it('monta o rótulo do Mostrar com singular, plural e sem número', () => {
    const itens = { um: 'importação', varios: 'importações' };
    expect(rotuloDeMostrar(1, itens)).toBe('Mostrar 1 importação');
    expect(rotuloDeMostrar(0, itens)).toBe('Mostrar 0 importações');
    expect(rotuloDeMostrar(1234, itens)).toBe('Mostrar 1.234 importações');
    expect(rotuloDeMostrar(null, itens)).toBe('Mostrar importações');
  });
});
