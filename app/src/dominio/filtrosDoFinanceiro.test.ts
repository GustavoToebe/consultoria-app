import {
  chipsDasCobrancas, chipsDosLancamentos, cobrancasParaEndereco, descricaoDasCobrancas, lancamentosParaEndereco, lerCobrancasDoEndereco,
  lerLancamentosDoEndereco, SEM_FILTROS_DE_COBRANCAS, semOFiltroDeCobrancas, vencimentoDaApi,
} from './filtrosDoFinanceiro';

const HOJE = '2026-10-19';

describe('filtros das cobranças', () => {
  test('endereço: situação, meus, próximos 7 dias ou período; desconhecido é ignorado', () => {
    expect(lerCobrancasDoEndereco({})).toEqual(SEM_FILTROS_DE_COBRANCAS);
    expect(lerCobrancasDoEndereco({ situacao: 'QUALQUER', vencimento: 'ONTEM', meus: 'talvez' })).toEqual(SEM_FILTROS_DE_COBRANCAS);
    expect(lerCobrancasDoEndereco({ situacao: 'ABERTA', vencimento: 'PROXIMOS_7_DIAS', meus: 'true', de: '2026-10-01' }))
      .toEqual({ situacao: 'ABERTA', meus: true, proximos7Dias: true, periodo: { de: null, ate: null } });
    expect(lerCobrancasDoEndereco({ de: '2026-10-01', ate: '2026-10-31' }).periodo).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
  });

  test('ida e volta pelo endereço', () => {
    const f = { situacao: 'VENCIDA' as const, meus: true, proximos7Dias: false, periodo: { de: '2026-10-01', ate: null } };
    expect(cobrancasParaEndereco(f)).toEqual({ situacao: 'VENCIDA', meus: 'true', de: '2026-10-01' });
    expect(lerCobrancasDoEndereco(cobrancasParaEndereco(f))).toEqual(f);
    expect(cobrancasParaEndereco({ ...SEM_FILTROS_DE_COBRANCAS, proximos7Dias: true })).toEqual({ vencimento: 'PROXIMOS_7_DIAS' });
  });

  test('vencimento para a API: a janela de hoje a hoje + 7, ou o período', () => {
    expect(vencimentoDaApi({ ...SEM_FILTROS_DE_COBRANCAS, proximos7Dias: true }, HOJE)).toEqual({ de: HOJE, ate: '2026-10-26' });
    expect(vencimentoDaApi({ ...SEM_FILTROS_DE_COBRANCAS, periodo: { de: null, ate: '2026-10-31' } }, HOJE)).toEqual({ ate: '2026-10-31' });
    expect(vencimentoDaApi(SEM_FILTROS_DE_COBRANCAS, HOJE)).toEqual({});
  });

  test('chips, ✕ e descrição', () => {
    const f = { situacao: 'ABERTA' as const, meus: true, proximos7Dias: true, periodo: { de: null, ate: null } };
    expect(chipsDasCobrancas(f, HOJE).map((c) => c.texto)).toEqual(['Responsável: Meus', 'Situação: Em aberto', 'Vencimento: de hoje até 26/10/2026']);
    expect(semOFiltroDeCobrancas(f, 'vencimento').proximos7Dias).toBe(false);
    expect(semOFiltroDeCobrancas(f, 'responsavel').meus).toBe(false);
    expect(semOFiltroDeCobrancas(f, 'situacao').situacao).toBe('TODAS');
    expect(descricaoDasCobrancas(f, HOJE, 1)).toBe('Em aberto, vencimento de hoje até 26/10/2026: 1 cobrança, por vencimento. Toque na linha para abrir.');
    expect(descricaoDasCobrancas(SEM_FILTROS_DE_COBRANCAS, HOJE, 2)).toBe('Todas: 2 cobranças, por vencimento. Toque na linha para abrir.');
  });
});

describe('filtros dos lançamentos', () => {
  test('período no endereço e no chip', () => {
    const f = lerLancamentosDoEndereco({ de: '2026-10-01', ate: '2026-10-31' });
    expect(lancamentosParaEndereco(f)).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(chipsDosLancamentos(f)).toEqual([{ chave: 'periodo', texto: 'Data: 01/10/2026 a 31/10/2026' }]);
    expect(chipsDosLancamentos(lerLancamentosDoEndereco({ de: 'x' }))).toEqual([]);
  });
});
