import { chipsDasCobrancas, SEM_FILTROS_DE_COBRANCAS } from './filtrosDoFinanceiro';
import { errosDoPeriodoDigitado, resultadoDoAplicar, SELECAO_DE_ALUNOS, selecaoDepoisDosFiltros } from './painelDeFiltros';

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
  it('com a faixa: data fora dela é erro no campo, com o nome dele e sem repetir o valor', () => {
    const regras = { regra: 'PLANEJAMENTO' as const, nomes: { de: 'Entrada, data inicial', ate: 'Entrada, data final' }, hoje: '2026-10-19' };
    expect(errosDoPeriodoDigitado('01/01/1990', '', regras)).toEqual({ de: 'Entrada, data inicial: use uma data entre 01/01/2000 e 31/12/2031', ate: null });
    expect(errosDoPeriodoDigitado('', '01/01/2099', regras).ate).toBe('Entrada, data final: use uma data entre 01/01/2000 e 31/12/2031');
    expect(errosDoPeriodoDigitado('01/10/2026', '31/10/2026', regras)).toEqual({ de: null, ate: null });
  });
  it('intervalo aberto só é erro onde a tela pede as duas datas (`osDois`); o campo vazio é que fica marcado', () => {
    expect(errosDoPeriodoDigitado('01/10/2026', '')).toEqual({ de: null, ate: null });
    expect(errosDoPeriodoDigitado('01/10/2026', '', { osDois: true })).toEqual({ de: null, ate: 'Preencha a data final ou apague a inicial.' });
    expect(errosDoPeriodoDigitado('', '01/10/2026', { osDois: true })).toEqual({ de: 'Preencha a data inicial ou apague a final.', ate: null });
    expect(errosDoPeriodoDigitado('', '', { osDois: true })).toEqual({ de: null, ate: null });
  });
  it('período mais longo que o máximo marca o Até; dentro dele, nada', () => {
    expect(errosDoPeriodoDigitado('01/01/2026', '31/12/2026', { osDois: true, maximoDias: 366 })).toEqual({ de: null, ate: null });
    expect(errosDoPeriodoDigitado('01/01/2026', '01/02/2027', { osDois: true, maximoDias: 366 })).toEqual({ de: null, ate: 'Escolha um período de até 366 dias.' });
  });
});

describe('selecaoDepoisDosFiltros', () => {
  const lote = ['a', 'b'];
  it('filtros diferentes limpam a seleção com aviso', () => {
    expect(selecaoDepoisDosFiltros(lote, 'x', 'y')).toEqual({ selecao: [], aviso: 'As 2 cobranças marcadas saíram da seleção porque os filtros mudaram.' });
    expect(selecaoDepoisDosFiltros(['a'], 'x', 'y').aviso).toBe('A cobrança marcada saiu da seleção porque os filtros mudaram.');
  });
  it('Alunos usa o mesmo aviso, com o texto de alunos', () => {
    expect(selecaoDepoisDosFiltros(lote, 'x', 'y', SELECAO_DE_ALUNOS).aviso).toBe('Os 2 alunos marcados saíram da seleção porque os filtros mudaram.');
    expect(selecaoDepoisDosFiltros(['a'], 'x', 'y', SELECAO_DE_ALUNOS).aviso).toBe('O aluno marcado saiu da seleção porque os filtros mudaram.');
    expect(selecaoDepoisDosFiltros([], 'x', 'y', SELECAO_DE_ALUNOS).aviso).toBeNull();
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
