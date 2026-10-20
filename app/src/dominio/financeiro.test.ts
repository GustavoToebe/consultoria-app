import type { CobrancaDoAluno, MesDoPainel } from '../api/financeiroTipos';
import {
  atrasoParaTela,
  cartoesDoPainel,
  descricaoDoGrafico,
  FORMAS_MANUAIS,
  graficoTemDados,
  hojeEmBrasilia,
  inadimplenciaParaTela,
  liquidoParaTela,
  maiorValorDoGrafico,
  nomeDoCsv,
  NOTA_CONSIDERA_GERADAS,
  pagamentoPendente,
  percentualParaTela,
  reaisCompactos,
  periodoDoMes,
  periodoDoPainel,
  podeCancelarCobranca,
  podeDesfazerBaixa,
  podeRegistrarPagamento,
  resultadoDoMesParaTela,
  rotuloDaForma,
  rotuloDaPeriodicidade,
  seloDaCobranca,
  seloDaContratacao,
  serieDoGrafico,
  validarBaixa,
  validarContratacao,
  validarLancamento,
  validarPlano,
  valorEQuantidadeParaTela,
} from './financeiro';

function espacos(texto: string): string {
  return texto.replace(/ /g, ' ');
}

describe('hojeEmBrasilia', () => {
  it('usa UTC-3 fixo, não o fuso do aparelho', () => {
    expect(hojeEmBrasilia(new Date('2026-06-10T02:59:00Z'))).toBe('2026-06-09');
    expect(hojeEmBrasilia(new Date('2026-06-10T03:00:00Z'))).toBe('2026-06-10');
    expect(hojeEmBrasilia(new Date('2026-01-01T01:00:00Z'))).toBe('2025-12-31');
  });
});

describe('selos', () => {
  it('cobrança paga é verde', () => {
    expect(seloDaCobranca({ situacao: 'PAGA', vencida: false })).toEqual({ tom: 'sucesso', rotulo: 'Paga' });
  });
  it('em aberto é âmbar e vencida (da API) é vermelha', () => {
    expect(seloDaCobranca({ situacao: 'ABERTA', vencida: false })).toEqual({ tom: 'atencao', rotulo: 'Em aberto' });
    expect(seloDaCobranca({ situacao: 'ABERTA', vencida: true })).toEqual({ tom: 'perigo', rotulo: 'Vencida' });
  });
  it('vencida só vale para cobrança em aberto', () => {
    expect(seloDaCobranca({ situacao: 'PAGA', vencida: true }).tom).toBe('sucesso');
    expect(seloDaCobranca({ situacao: 'CANCELADA', vencida: true }).tom).toBe('neutro');
  });
  it('cancelada, estornada e contestada são cinza', () => {
    for (const situacao of ['CANCELADA', 'ESTORNADA', 'CONTESTADA'] as const) {
      expect(seloDaCobranca({ situacao }).tom).toBe('neutro');
    }
    expect(seloDaCobranca({ situacao: 'ESTORNADA' }).rotulo).toBe('Estornada');
  });
  it('contratação', () => {
    expect(seloDaContratacao('ATIVA').tom).toBe('sucesso');
    expect(seloDaContratacao('PAUSADA').tom).toBe('atencao');
    expect(seloDaContratacao('ENCERRADA').tom).toBe('neutro');
  });
});

describe('rótulos', () => {
  it('periodicidade e forma', () => {
    expect(rotuloDaPeriodicidade('TRIMESTRAL')).toBe('Trimestral');
    expect(rotuloDaPeriodicidade('PARCELA_UNICA')).toBe('Parcela única');
    expect(rotuloDaPeriodicidade(null)).toBe('—');
    expect(rotuloDaForma('PIX_DIRETO')).toBe('Pix direto');
    expect(rotuloDaForma(null)).toBe('—');
  });
  it('só quatro formas manuais', () => {
    expect(FORMAS_MANUAIS.map((f) => f.valor)).toEqual(['DINHEIRO', 'PIX_DIRETO', 'TRANSFERENCIA', 'OUTRO']);
  });
  it('atraso', () => {
    expect(atrasoParaTela(1)).toBe('1 dia de atraso');
    expect(atrasoParaTela(12)).toBe('12 dias de atraso');
    expect(atrasoParaTela(null)).toBe('—');
    expect(atrasoParaTela(0)).toBe('—');
  });
});

describe('botões da cobrança', () => {
  it('registrar e cancelar só em aberta', () => {
    expect(podeRegistrarPagamento({ situacao: 'ABERTA' })).toBe(true);
    expect(podeCancelarCobranca({ situacao: 'ABERTA' })).toBe(true);
    for (const situacao of ['PAGA', 'CANCELADA', 'ESTORNADA', 'CONTESTADA'] as const) {
      expect(podeRegistrarPagamento({ situacao })).toBe(false);
      expect(podeCancelarCobranca({ situacao })).toBe(false);
    }
  });
  it('desfazer só em paga manual', () => {
    expect(podeDesfazerBaixa({ situacao: 'PAGA', provedor: 'MANUAL' })).toBe(true);
    expect(podeDesfazerBaixa({ situacao: 'PAGA', provedor: 'ASAAS' })).toBe(false);
    expect(podeDesfazerBaixa({ situacao: 'PAGA', provedor: null })).toBe(false);
    expect(podeDesfazerBaixa({ situacao: 'ABERTA', provedor: 'MANUAL' })).toBe(false);
  });
});

describe('periodoDoPainel', () => {
  it('3, 6 e 12 meses terminam no fim do mês corrente', () => {
    expect(periodoDoPainel('3m', '2026-06-15')).toEqual({ de: '2026-04-01', ate: '2026-06-30' });
    expect(periodoDoPainel('6m', '2026-06-15')).toEqual({ de: '2026-01-01', ate: '2026-06-30' });
    expect(periodoDoPainel('12m', '2026-06-15')).toEqual({ de: '2025-07-01', ate: '2026-06-30' });
  });
  it('vira o ano e respeita fevereiro', () => {
    expect(periodoDoPainel('3m', '2026-01-10')).toEqual({ de: '2025-11-01', ate: '2026-01-31' });
    expect(periodoDoPainel('3m', '2028-02-10')).toEqual({ de: '2027-12-01', ate: '2028-02-29' });
    expect(periodoDoPainel('3m', '2026-02-10').ate).toBe('2026-02-28');
  });
  it('este ano vai de 1 de janeiro a 31 de dezembro', () => {
    expect(periodoDoPainel('ano', '2026-06-15')).toEqual({ de: '2026-01-01', ate: '2026-12-31' });
  });
});

describe('periodoDoMes', () => {
  it('vai do dia 1 ao último dia do mês', () => {
    expect(periodoDoMes('2026-06-15')).toEqual({ de: '2026-06-01', ate: '2026-06-30' });
    expect(periodoDoMes('2028-02-01')).toEqual({ de: '2028-02-01', ate: '2028-02-29' });
    expect(periodoDoMes('2026-12-31')).toEqual({ de: '2026-12-01', ate: '2026-12-31' });
  });
});

describe('contas do painel', () => {
  it('percentual', () => {
    expect(percentualParaTela(12.5)).toBe('12,5%');
    expect(percentualParaTela(0)).toBe('0%');
    expect(percentualParaTela(100)).toBe('100%');
    expect(percentualParaTela(null)).toBe('—');
  });
  it('valor e quantidade', () => {
    expect(espacos(valorEQuantidadeParaTela({ valorCentavos: 30000, cobrancas: 2 }))).toBe('R$ 300,00 (2 cobranças)');
    expect(espacos(valorEQuantidadeParaTela({ valorCentavos: 100, cobrancas: 1 }))).toBe('R$ 1,00 (1 cobrança)');
    expect(valorEQuantidadeParaTela({ valorCentavos: null, cobrancas: 0 })).toBe('—');
  });
  it('cartões com tudo nulo ficam em "—", nunca zero', () => {
    const cartoes = cartoesDoPainel({
      recebidoCentavos: null,
      aReceberCentavos: null,
      emAtraso: { valorCentavos: null, cobrancas: 0 },
      receitaRecorrenteMensalCentavos: null,
      alunosPagantes: null,
      valorMedioPorAlunoCentavos: null,
    });
    expect(cartoes).toHaveLength(6);
    expect(cartoes.map((c) => c.valor)).toEqual(['—', '—', '—', '—', '—', '—']);
  });
  it('cartões com dados e a nota de cobranças geradas', () => {
    const cartoes = cartoesDoPainel({
      recebidoCentavos: 120000,
      aReceberCentavos: 50000,
      emAtraso: { valorCentavos: 10000, cobrancas: 1 },
      receitaRecorrenteMensalCentavos: 90000,
      alunosPagantes: 3,
      valorMedioPorAlunoCentavos: 30000,
    });
    expect(espacos(cartoes[0].valor)).toBe('R$ 1.200,00');
    expect(cartoes[1].detalhe).toContain(NOTA_CONSIDERA_GERADAS);
    expect(cartoes[2].detalhe).toContain(NOTA_CONSIDERA_GERADAS);
    expect(cartoes[2].detalhe).toContain('1 cobrança');
    expect(cartoes[4].valor).toBe('3');
  });
  it('inadimplência traz a nota; sem vencidas no período fica "—"', () => {
    const com = inadimplenciaParaTela({ percentual: 12.5, vencidoCentavos: 30000, cobradoCentavos: 240000 });
    expect(com.percentual).toBe('12,5%');
    expect(com.detalhe).toContain(NOTA_CONSIDERA_GERADAS);
    const sem = inadimplenciaParaTela({ percentual: null, vencidoCentavos: null, cobradoCentavos: null });
    expect(sem.percentual).toBe('—');
    expect(sem.detalhe).toContain(NOTA_CONSIDERA_GERADAS);
  });
  it('líquido é "indisponível", sem desconto inventado', () => {
    const l = liquidoParaTela({ disponivel: false, motivo: 'Sem taxa conhecida.', brutoCentavos: 100000 });
    expect(l.valor).toBe('indisponível');
    expect(l.detalhe).toContain('Sem taxa conhecida.');
    expect(liquidoParaTela(null).valor).toBe('indisponível');
  });
  it('resultado do mês leva o rótulo fixo e "—" onde não há dado', () => {
    const r = resultadoDoMesParaTela({
      rotulo: 'x',
      mes: '2026-06',
      recebidoCentavos: 100000,
      entradasAvulsasCentavos: null,
      saidasAvulsasCentavos: null,
      resultadoCentavos: null,
    });
    expect(r.rotulo).toBe('Resultado do mês (entradas − saídas registradas)');
    expect(r.mes).toBe('jun/2026');
    expect(r.entradas).toBe('—');
    expect(r.resultado).toBe('—');
    expect(r.rotulo.toLowerCase()).not.toContain('lucro');
  });
});

describe('gráfico', () => {
  const mes = (m: string, recebido: number | null, previsto: number | null, parcial = false): MesDoPainel => ({
    mes: m,
    parcial,
    recebidoCentavos: recebido,
    previstoCentavos: previsto,
    entradasAvulsasCentavos: null,
    saidasAvulsasCentavos: null,
    resultadoCentavos: null,
  });

  it('série mês a mês com realizado e previsto; nulo continua nulo', () => {
    const barras = serieDoGrafico([mes('2026-05', 1000, null), mes('2026-06', 500, 700, true), mes('2026-07', null, 900)]);
    expect(barras).toEqual([
      { rotulo: 'mai/2026', realizado: 1000, previsto: null },
      { rotulo: 'jun/2026 (até hoje)', realizado: 500, previsto: 700 },
      { rotulo: 'jul/2026', realizado: null, previsto: 900 },
    ]);
    expect(maiorValorDoGrafico(barras)).toBe(1000);
    expect(graficoTemDados(barras)).toBe(true);
  });
  it('sem dados', () => {
    const barras = serieDoGrafico([mes('2026-05', null, null)]);
    expect(graficoTemDados(barras)).toBe(false);
    expect(maiorValorDoGrafico(barras)).toBe(0);
    expect(descricaoDoGrafico(barras)).toMatch(/Sem valores/);
    expect(serieDoGrafico(null)).toEqual([]);
  });
  it('descrição para leitor de tela lista cada mês', () => {
    const texto = espacos(descricaoDoGrafico(serieDoGrafico([mes('2026-05', 1000, null), mes('2026-06', 500, 700)])));
    expect(texto).toContain('mai/2026: recebido R$ 10,00');
    expect(texto).toContain('jun/2026: recebido R$ 5,00, previsto R$ 7,00');
  });
});

describe('eixo do gráfico', () => {
  it('rótulos curtos em reais', () => {
    expect(reaisCompactos(0)).toBe('R$ 0');
    expect(reaisCompactos(500)).toBe('R$ 500');
    expect(reaisCompactos(1200)).toBe('R$ 1,2 mil');
    expect(reaisCompactos(2000)).toBe('R$ 2 mil');
    expect(reaisCompactos(2_500_000)).toBe('R$ 2,5 mi');
  });
});

describe('validações', () => {
  const hoje = '2026-06-10';
  it('baixa: data obrigatória, não futura, forma manual', () => {
    expect(validarBaixa({ data: null, forma: 'DINHEIRO' }, hoje)).toMatch(/data/i);
    expect(validarBaixa({ data: '2026-06-11', forma: 'DINHEIRO' }, hoje)).toMatch(/futuro/);
    expect(validarBaixa({ data: '2026-06-10', forma: null }, hoje)).toMatch(/forma/);
    expect(validarBaixa({ data: '2026-06-10', forma: 'PIX' }, hoje)).toMatch(/forma/);
    expect(validarBaixa({ data: '2026-06-10', forma: 'PIX_DIRETO' }, hoje)).toBeNull();
    expect(validarBaixa({ data: '2026-05-01', forma: 'OUTRO' }, hoje)).toBeNull();
  });
  it('plano', () => {
    expect(validarPlano({ nome: ' ', valorCentavos: 100 })).toMatch(/nome/);
    expect(validarPlano({ nome: 'a'.repeat(81), valorCentavos: 100 })).toMatch(/80/);
    expect(validarPlano({ nome: 'Mensal', valorCentavos: null })).toMatch(/valor/i);
    expect(validarPlano({ nome: 'Mensal', valorCentavos: 2_000_000_000 })).toMatch(/máximo/);
    expect(validarPlano({ nome: 'Mensal', valorCentavos: 15000 })).toBeNull();
  });
  it('contratação: valor diferente do plano exige motivo', () => {
    const base = {
      planoId: 'p1',
      valorCentavos: null as number | null,
      valorDoPlanoCentavos: 15000,
      motivoValor: '',
      inicio: '2026-06-01',
      diaVencimento: 10 as number | null,
    };
    expect(validarContratacao(base)).toBeNull();
    expect(validarContratacao({ ...base, valorCentavos: 15000 })).toBeNull();
    expect(validarContratacao({ ...base, valorCentavos: 12000 })).toMatch(/diferente/);
    expect(validarContratacao({ ...base, valorCentavos: 12000, motivoValor: 'Desconto combinado' })).toBeNull();
    expect(validarContratacao({ ...base, valorCentavos: 12000, valorDoPlanoCentavos: null })).toBeNull();
    expect(validarContratacao({ ...base, planoId: null })).toMatch(/plano/i);
    expect(validarContratacao({ ...base, inicio: null })).toMatch(/início/);
    expect(validarContratacao({ ...base, diaVencimento: 0 })).toMatch(/1 a 31/);
    expect(validarContratacao({ ...base, diaVencimento: 32 })).toMatch(/1 a 31/);
    expect(validarContratacao({ ...base, diaVencimento: null })).toMatch(/1 a 31/);
    expect(validarContratacao({ ...base, motivoValor: 'x'.repeat(201) })).toMatch(/200/);
  });
  it('lançamento', () => {
    const ok = { data: '2026-06-01', descricao: 'Aluguel', valorCentavos: 100000, categoria: '' };
    expect(validarLancamento(ok)).toBeNull();
    expect(validarLancamento({ ...ok, data: null })).toMatch(/data/i);
    expect(validarLancamento({ ...ok, descricao: '  ' })).toMatch(/Descreva/);
    expect(validarLancamento({ ...ok, descricao: 'x'.repeat(121) })).toMatch(/120/);
    expect(validarLancamento({ ...ok, categoria: 'x'.repeat(61) })).toMatch(/60/);
    expect(validarLancamento({ ...ok, valorCentavos: null })).toMatch(/valor/i);
  });
});

describe('pagamentoPendente', () => {
  const hoje = '2026-06-10';
  const cobranca = (extra: Partial<CobrancaDoAluno>): CobrancaDoAluno => ({
    id: 'c',
    competencia: '2026-06-01',
    vencimento: '2026-06-20',
    valorCentavos: 10000,
    situacao: 'ABERTA',
    vencida: false,
    forma: null,
    pagoEm: null,
    ...extra,
  });
  it('vencida (da API) entra, mesmo muito atrasada', () => {
    expect(pagamentoPendente([cobranca({ vencida: true, vencimento: '2026-01-05' })], hoje)).toHaveLength(1);
  });
  it('vence em até 3 dias entra; em 4 dias não', () => {
    expect(pagamentoPendente([cobranca({ vencimento: '2026-06-10' })], hoje)).toHaveLength(1);
    expect(pagamentoPendente([cobranca({ vencimento: '2026-06-13' })], hoje)).toHaveLength(1);
    expect(pagamentoPendente([cobranca({ vencimento: '2026-06-14' })], hoje)).toHaveLength(0);
  });
  it('só aberta conta', () => {
    expect(pagamentoPendente([cobranca({ situacao: 'PAGA', vencimento: '2026-06-11' })], hoje)).toHaveLength(0);
  });
  it('sem lista não quebra', () => {
    expect(pagamentoPendente(null, hoje)).toEqual([]);
    expect(pagamentoPendente(undefined, hoje)).toEqual([]);
  });
});

describe('nomeDoCsv', () => {
  it('segue o nome que a API usa', () => {
    expect(nomeDoCsv('2026-01-01', '2026-06-30')).toBe('financeiro-2026-01-01-a-2026-06-30.csv');
  });
});
