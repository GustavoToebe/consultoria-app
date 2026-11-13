import { chipsDasCobrancas, SEM_FILTROS_DE_COBRANCAS } from './filtrosDoFinanceiro';
import { errosDoPeriodoDigitado, resultadoDoAplicar, selecaoDepoisDosFiltros } from './painelDeFiltros';

describe('resultadoDoAplicar', () => {
  it('sem problema aplica; com problema fica no painel e diz quantos campos', () => {
    expect(resultadoDoAplicar(0)).toEqual({ ok: true });
    expect(resultadoDoAplicar(1)).toEqual({ ok: false, mensagem: 'Corrija o campo marcado para aplicar os filtros.' });
    expect(resultadoDoAplicar(3)).toEqual({ ok: false, mensagem: 'Corrija os 3 campos marcados para aplicar os filtros.' });
  });
});

describe('errosDoPeriodoDigitado', () => {
  it('vazio e datas certas em ordem não são erro', () => {
    expect(errosDoPeriodoDigitado('', '')).toEqual({ de: null, ate: null });
    expect(errosDoPeriodoDigitado('01/10/2026', '')).toEqual({ de: null, ate: null });
    expect(errosDoPeriodoDigitado('01/10/2026', '01/10/2026')).toEqual({ de: null, ate: null });
  });
  it('data pela metade e data impossível ficam no campo delas', () => {
    expect(errosDoPeriodoDigitado('01/10/20', '')).toEqual({ de: 'Complete a data (DD/MM/AAAA) ou apague.', ate: null });
    expect(errosDoPeriodoDigitado('', '31/02/2026')).toEqual({ de: null, ate: 'Data inválida.' });
  });
  it('Até antes de De marca o Até', () => {
    expect(errosDoPeriodoDigitado('10/10/2026', '01/10/2026')).toEqual({ de: null, ate: 'Fim antes do início.' });
  });
});

describe('selecaoDepoisDosFiltros', () => {
  const lote = ['a', 'b'];
  it('filtros diferentes limpam a seleção com aviso', () => {
    expect(selecaoDepoisDosFiltros(lote, 'x', 'y')).toEqual({ selecao: [], aviso: 'As 2 cobranças marcadas saíram da seleção porque os filtros mudaram.' });
    expect(selecaoDepoisDosFiltros(['a'], 'x', 'y').aviso).toBe('A cobrança marcada saiu da seleção porque os filtros mudaram.');
  });
  it('os mesmos filtros (Aplicar sem mudar nada) e seleção vazia não mexem', () => {
    expect(selecaoDepoisDosFiltros(lote, 'x', 'x')).toEqual({ selecao: lote, aviso: null });
    expect(selecaoDepoisDosFiltros([], 'x', 'y')).toEqual({ selecao: [], aviso: null });
  });
});

describe('contador do botão = critérios que restringem', () => {
  it('duas situações são um critério; vencimento é um; nada ligado, nenhum', () => {
    expect(chipsDasCobrancas(SEM_FILTROS_DE_COBRANCAS, '2026-10-19')).toHaveLength(0);
    const chips = chipsDasCobrancas({ ...SEM_FILTROS_DE_COBRANCAS, situacoes: ['ABERTA', 'PAGA'], proximos7Dias: true }, '2026-10-19');
    expect(chips.map((c) => c.chave)).toEqual(['situacao', 'vencimento']);
    expect(chips[0].texto).toBe('Situação: Em aberto, Pagas');
  });
});
