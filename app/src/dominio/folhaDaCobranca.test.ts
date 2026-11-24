import { idEncurtado, origemDaCobranca, prazoDaCobranca } from './folhaDaCobranca';

// folha da cobrança (23/11)
const HOJE = '2026-11-23';
const aberta = (vencimento: string, extra: Partial<Parameters<typeof prazoDaCobranca>[0]> = {}) => ({
  situacao: 'ABERTA' as const, vencida: false, vencimento, diasDeAtraso: null, pagoEm: null, forma: null, ...extra,
});

describe('prazoDaCobranca', () => {
  it('em aberto: suave a mais de 3 dias, âmbar de hoje até 3 dias', () => {
    expect(prazoDaCobranca(aberta('2026-11-30'), HOJE)).toEqual({ texto: 'Vence em 7 dias', tom: 'suave' });
    expect(prazoDaCobranca(aberta('2026-11-27'), HOJE)).toEqual({ texto: 'Vence em 4 dias', tom: 'suave' });
    expect(prazoDaCobranca(aberta('2026-11-26'), HOJE)).toEqual({ texto: 'Vence em 3 dias', tom: 'atencao' });
    expect(prazoDaCobranca(aberta('2026-11-25'), HOJE)).toEqual({ texto: 'Vence em 2 dias', tom: 'atencao' });
    expect(prazoDaCobranca(aberta('2026-11-24'), HOJE)).toEqual({ texto: 'Vence amanhã', tom: 'atencao' });
    expect(prazoDaCobranca(aberta(HOJE), HOJE)).toEqual({ texto: 'Vence hoje', tom: 'atencao' });
  });

  it('conta os dias pelo calendário, também na virada do mês e do ano', () => {
    expect(prazoDaCobranca(aberta('2027-01-05'), '2026-12-30')).toEqual({ texto: 'Vence em 6 dias', tom: 'suave' });
  });

  it('vencida: os dias de atraso da API, em vermelho; sem eles, a conta pelas datas', () => {
    expect(prazoDaCobranca(aberta('2026-11-08', { vencida: true, diasDeAtraso: 15 }), HOJE)).toEqual({ texto: '15 dias de atraso', tom: 'perigo' });
    expect(prazoDaCobranca(aberta('2026-11-22', { vencida: true, diasDeAtraso: 1 }), HOJE)).toEqual({ texto: '1 dia de atraso', tom: 'perigo' });
    expect(prazoDaCobranca(aberta('2026-11-20', { vencida: true }), HOJE)).toEqual({ texto: '3 dias de atraso', tom: 'perigo' });
    // A API marcou vencida, mas o relógio daqui ainda não virou: nunca "0 dias".
    expect(prazoDaCobranca(aberta(HOJE, { vencida: true }), HOJE)).toEqual({ texto: '1 dia de atraso', tom: 'perigo' });
  });

  it('vencimento no passado sem a marca de vencida não vira dias negativos', () => {
    expect(prazoDaCobranca(aberta('2026-11-21'), HOJE)).toEqual({ texto: 'Vence hoje', tom: 'atencao' });
  });

  it('paga: a data e a forma, em verde; sem forma, só a data; sem data, nada', () => {
    const paga = { ...aberta('2026-11-10'), situacao: 'PAGA' as const, pagoEm: '2026-11-15', forma: 'PIX_DIRETO' as const };
    expect(prazoDaCobranca(paga, HOJE)).toEqual({ texto: 'Paga em 15/11/2026 · Pix direto', tom: 'sucesso' });
    expect(prazoDaCobranca({ ...paga, forma: null }, HOJE)).toEqual({ texto: 'Paga em 15/11/2026', tom: 'sucesso' });
    expect(prazoDaCobranca({ ...paga, pagoEm: null }, HOJE)).toBeNull();
  });

  it('cancelada, estornada, contestada e renegociada: o selo já diz, sem prazo', () => {
    for (const situacao of ['CANCELADA', 'ESTORNADA', 'CONTESTADA', 'RENEGOCIADA'] as const) {
      expect(prazoDaCobranca({ ...aberta('2026-11-10'), situacao, pagoEm: '2026-11-12', forma: 'PIX' }, HOJE)).toBeNull();
    }
  });
});

describe('origemDaCobranca', () => {
  it('mensalidade e saída com o plano; sem o plano, só o tipo', () => {
    expect(origemDaCobranca({ tipo: 'MENSALIDADE', planoNome: 'Plano Cauã', descricao: null })).toBe('Mensalidade · Plano Cauã');
    expect(origemDaCobranca({ tipo: 'MENSALIDADE', planoNome: null, descricao: null })).toBe('Mensalidade');
    expect(origemDaCobranca({ tipo: 'SAIDA', planoNome: 'Plano Cauã', descricao: null })).toBe('Cobrança de saída · Plano Cauã');
    expect(origemDaCobranca({ tipo: 'SAIDA', planoNome: null, descricao: null })).toBe('Cobrança de saída');
  });

  it('avulsa: a descrição e a parcela por extenso; uma parcela só, sem parcela', () => {
    expect(origemDaCobranca({ tipo: 'AVULSA', planoNome: null, descricao: 'Camiseta (Parcela 1/3)' })).toBe('Avulsa · Camiseta · Parcela 1 de 3');
    expect(origemDaCobranca({ tipo: 'AVULSA', planoNome: null, descricao: 'Avaliação extra' })).toBe('Avulsa · Avaliação extra');
    expect(origemDaCobranca({ tipo: 'AVULSA', planoNome: null, descricao: null })).toBe('Avulsa');
  });

  it('parcela do acordo pela descrição fixa; fora do formato, sem número', () => {
    expect(origemDaCobranca({ tipo: 'RENEGOCIACAO', planoNome: null, descricao: 'Renegociação (Parcela 2/3)' })).toBe('Parcela 2 de 3 do acordo');
    expect(origemDaCobranca({ tipo: 'RENEGOCIACAO', planoNome: null, descricao: 'Renegociação' })).toBe('Parcela de acordo');
  });
});

describe('idEncurtado', () => {
  it('8 primeiros, reticências e 4 últimos', () => {
    expect(idEncurtado('5adb0f9b-1c2d-4e3f-8a9b-0c1d2e3fe838')).toBe('5adb0f9b…e838');
  });
  it('id curto fica inteiro', () => {
    expect(idEncurtado('abc')).toBe('abc');
  });
});
