import { chaveDaConclusao, conclusaoDe, fundirConclusoes, totalDeConcluidos, type ConclusaoDoTreino, type ConclusaoLocal } from './sessoesConcluidas';

function c(extra: Partial<ConclusaoLocal> = {}): ConclusaoLocal {
  return {
    planoVersaoId: 'v1',
    sessaoUid: 's1',
    data: '2026-10-28',
    concluida: true,
    resultado: 'COMPLETA',
    duracaoSegundos: 3600,
    comentario: null,
    situacao: 'LOCAL',
    ...extra,
  };
}

const servidor = (extra: Partial<ConclusaoDoTreino> = {}): ConclusaoDoTreino => {
  const { situacao: _situacao, ...resto } = c(extra);
  return resto;
};

describe('fundirConclusoes', () => {
  it('o aparelho ganha do servidor na mesma versão, sessão e dia', () => {
    const fundidas = fundirConclusoes([c({ resultado: 'PARCIAL', comentario: 'aparelho' })], [servidor({ resultado: 'COMPLETA', comentario: 'servidor' })]);
    expect(fundidas).toEqual([{ planoVersaoId: 'v1', sessaoUid: 's1', data: '2026-10-28', concluida: true, resultado: 'PARCIAL', duracaoSegundos: 3600, comentario: 'aparelho' }]);
  });

  it('reabrir no aparelho (concluida falso) também ganha do servidor', () => {
    const [f] = fundirConclusoes([c({ concluida: false, resultado: null, duracaoSegundos: null })], [servidor()]);
    expect(f).toMatchObject({ concluida: false, resultado: null, duracaoSegundos: null });
  });

  it('a que falhou não conta e deixa valer a do servidor; sem servidor, some', () => {
    expect(fundirConclusoes([c({ situacao: 'FALHOU', resultado: 'PARCIAL' })], [servidor()])[0].resultado).toBe('COMPLETA');
    expect(fundirConclusoes([c({ situacao: 'FALHOU' })], [])).toEqual([]);
  });

  it('o "Visto" do treinador (0.5) vem do servidor e fica com a conclusão do aparelho; reaberta, some', () => {
    const visto = '2026-10-28T15:00:00Z';
    expect(fundirConclusoes([], [servidor({ id: 'x', vistoEm: visto })])[0]).toMatchObject({ id: 'x', vistoEm: visto });
    expect(fundirConclusoes([c({ id: 'x', comentario: 'novo' })], [servidor({ id: 'x', vistoEm: visto })])[0]).toMatchObject({ comentario: 'novo', vistoEm: visto });
    expect(fundirConclusoes([c({ concluida: false, resultado: null, duracaoSegundos: null })], [servidor({ vistoEm: visto })])[0].vistoEm).toBeUndefined();
  });

  it('o resultado não carrega a situação do aparelho', () => {
    expect(Object.keys(fundirConclusoes([c({ situacao: 'ENVIADO' })], [])[0])).not.toContain('situacao');
  });

  it('a ordem é fixa (data, sessão, versão), qualquer que seja a de chegada', () => {
    const a = servidor({ data: '2026-10-27', sessaoUid: 'b' });
    const b = servidor({ data: '2026-10-27', sessaoUid: 'a' });
    const d = c({ data: '2026-10-28', sessaoUid: 'a' });
    const e = servidor({ data: '2026-10-28', sessaoUid: 'a', planoVersaoId: 'v0' });
    const ordem = (l: readonly ConclusaoLocal[], s: readonly ConclusaoDoTreino[]) => fundirConclusoes(l, s).map(chaveDaConclusao);
    const esperado = ['v1|a|2026-10-27', 'v1|b|2026-10-27', 'v0|a|2026-10-28', 'v1|a|2026-10-28'];
    expect(ordem([d], [a, b, e])).toEqual(esperado);
    expect(ordem([d], [e, b, a])).toEqual(esperado);
  });
});

describe('conclusaoDe', () => {
  it('acha pela chave natural ou devolve nulo', () => {
    const fundidas = fundirConclusoes([c()], []);
    expect(conclusaoDe(fundidas, 'v1', 's1', '2026-10-28')?.resultado).toBe('COMPLETA');
    expect(conclusaoDe(fundidas, 'v1', 's1', '2026-10-27')).toBeNull();
    expect(conclusaoDe(fundidas, 'v2', 's1', '2026-10-28')).toBeNull();
  });
});

describe('totalDeConcluidos', () => {
  it('nunca baixou: nulo', () => {
    expect(totalDeConcluidos(null, [], [c()])).toBeNull();
  });

  it('sem nada no aparelho é o total do servidor', () => {
    expect(totalDeConcluidos(12, [servidor()], [])).toBe(12);
  });

  it('conclusão do aparelho que o servidor ainda não tem soma 1 (LOCAL ou ENVIADO)', () => {
    expect(totalDeConcluidos(12, [], [c()])).toBe(13);
    expect(totalDeConcluidos(12, [], [c({ situacao: 'ENVIADO' })])).toBe(13);
  });

  it('já confirmada pelo servidor não soma de novo', () => {
    expect(totalDeConcluidos(13, [servidor()], [c({ situacao: 'ENVIADO' })])).toBe(13);
  });

  it('reaberta no aparelho com conclusão no servidor subtrai 1', () => {
    expect(totalDeConcluidos(12, [servidor()], [c({ concluida: false, resultado: null, duracaoSegundos: null })])).toBe(11);
  });

  it('reaberta que o servidor nunca teve não muda nada', () => {
    expect(totalDeConcluidos(12, [], [c({ concluida: false, resultado: null, duracaoSegundos: null })])).toBe(12);
  });

  it('FALHOU fica de fora', () => {
    expect(totalDeConcluidos(12, [], [c({ situacao: 'FALHOU' })])).toBe(12);
  });

  it('nunca fica negativo', () => {
    expect(totalDeConcluidos(0, [servidor()], [c({ concluida: false, resultado: null, duracaoSegundos: null })])).toBe(0);
  });
});
