import type { CobrancaDoAluno, MesDoPainel, MotivoDaConferencia } from '../api/financeiroTipos';
import {
  abertasDaContratacao,
  atrasoParaTela,
  AVISO_LIQUIDO,
  AVISO_RETORNO_DO_PAGAMENTO,
  AVISO_RETORNO_SEM_CONFIRMAR,
  cartoesDoPainel,
  COMO_CALCULAMOS,
  comoPagar,
  descricaoDoGrafico,
  ehPagamentoOnline,
  FILTROS_DE_SITUACAO,
  FORMAS_MANUAIS,
  graficoTemDados,
  hojeEmBrasilia,
  inadimplenciaParaTela,
  informacaoDaCobranca,
  jurosQueValem,
  lerRetornoDoPagamento,
  liquidoParaTela,
  MOTIVO_JUROS_SEM_CHAVE,
  maiorValorDoGrafico,
  nomeDoCsv,
  normalizarInfiniteTag,
  NOTA_CONSIDERA_GERADAS,
  OPCOES_DE_JUROS,
  pagamentoPendente,
  pagarPermitidoNaPlataforma,
  percentualParaTela,
  plataformaDoApp,
  reaisCompactos,
  periodoDoMes,
  periodoDoPainel,
  podeCancelarCobranca,
  podeCopiarLink,
  podeDesfazerBaixa,
  podeRegistrarPagamento,
  resultadoDoMesParaTela,
  rotuloDaForma,
  rotuloDaPeriodicidade,
  rotuloDoMotivoDaConferencia,
  rotuloDosJurosParaLeitura,
  seloDaCobranca,
  seloDaContratacao,
  serieDoGrafico,
  temChaveParaJuros,
  TEXTO_CHAVE_DO_RECEBIMENTO,
  TEXTO_COMBINE_COM_O_TREINADOR,
  TEXTO_JUROS_DO_PARCELAMENTO,
  TEXTO_NADA_E_BAIXADO,
  TITULO_JUROS_DO_PARCELAMENTO,
  TEXTO_RECEBIMENTO_ONLINE,
  TEXTO_SEM_CONFIGURAR_O_RECEBIMENTO,
  textoDeAbertasQueContinuam,
  textoDeComoPagar,
  validarBaixa,
  validarContratacao,
  validarJurosDoParcelamento,
  validarLancamento,
  validarPlano,
  validarRecebimentoOnline,
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

describe('aviso de cobranças abertas ao pausar e encerrar', () => {
  it('sem cobrança aberta não há texto', () => {
    expect(textoDeAbertasQueContinuam(0)).toBeNull();
    expect(textoDeAbertasQueContinuam(-1)).toBeNull();
  });
  it('singular e plural', () => {
    expect(textoDeAbertasQueContinuam(1)).toBe('Há 1 cobrança aberta; ela continua valendo. Cancele-a se precisar.');
    expect(textoDeAbertasQueContinuam(2)).toBe('Há 2 cobranças abertas; elas continuam valendo. Cancele uma a uma se precisar.');
    expect(textoDeAbertasQueContinuam(5)).toBe('Há 5 cobranças abertas; elas continuam valendo. Cancele uma a uma se precisar.');
  });
  it('conta só as ABERTAS da contratação (vencida é ABERTA; paga e cancelada não; outra contratação não)', () => {
    const c = (contratacaoId: string, situacao: 'ABERTA' | 'PAGA' | 'CANCELADA') => ({ contratacaoId, situacao });
    expect(abertasDaContratacao([c('x', 'ABERTA'), c('x', 'ABERTA'), c('x', 'PAGA'), c('x', 'CANCELADA'), c('y', 'ABERTA')], 'x')).toBe(2);
    expect(abertasDaContratacao(null, 'x')).toBe(0);
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

describe('pagarPermitidoNaPlataforma', () => {
  it('a web sempre tem o "Pagar", com ou sem chaves', () => {
    expect(pagarPermitidoNaPlataforma('web', {})).toBe(true);
    expect(pagarPermitidoNaPlataforma('web', { pagarNoIos: false, pagarNoAndroid: false })).toBe(true);
  });
  it('no celular vale só a chave da própria plataforma (a do outro sistema não conta)', () => {
    expect(pagarPermitidoNaPlataforma('ios', { pagarNoIos: true, pagarNoAndroid: false })).toBe(true);
    expect(pagarPermitidoNaPlataforma('ios', { pagarNoIos: false, pagarNoAndroid: true })).toBe(false);
    expect(pagarPermitidoNaPlataforma('android', { pagarNoIos: false, pagarNoAndroid: true })).toBe(true);
    expect(pagarPermitidoNaPlataforma('android', { pagarNoIos: true, pagarNoAndroid: false })).toBe(false);
  });
  it('chave ausente ou nula é desligada', () => {
    expect(pagarPermitidoNaPlataforma('ios', {})).toBe(false);
    expect(pagarPermitidoNaPlataforma('android', { pagarNoAndroid: null })).toBe(false);
  });
});

describe('comoPagar', () => {
  const ligadas = { pagarNoIos: true, pagarNoAndroid: true };
  const desligadas = { pagarNoIos: false, pagarNoAndroid: false };
  it('web: botão com pagamento online, combinar sem ele, qualquer que seja a chave', () => {
    for (const chaves of [ligadas, desligadas, {}]) {
      expect(comoPagar('web', true, chaves)).toBe('botao');
      expect(comoPagar('web', false, chaves)).toBe('combinar');
    }
  });
  it('celular com a chave da plataforma ligada: botão com pagamento online, combinar sem ele', () => {
    expect(comoPagar('ios', true, { pagarNoIos: true })).toBe('botao');
    expect(comoPagar('android', true, { pagarNoAndroid: true })).toBe('botao');
    expect(comoPagar('ios', false, ligadas)).toBe('combinar');
    expect(comoPagar('android', false, ligadas)).toBe('combinar');
  });
  it('celular sem a chave da plataforma: só informa, com ou sem pagamento online', () => {
    for (const plataforma of ['ios', 'android'] as const) {
      expect(comoPagar(plataforma, true, desligadas)).toBe('informar');
      expect(comoPagar(plataforma, false, desligadas)).toBe('informar');
      expect(comoPagar(plataforma, true, {})).toBe('informar');
    }
  });
  it('a chave do outro sistema não libera o botão', () => {
    expect(comoPagar('ios', true, { pagarNoIos: false, pagarNoAndroid: true })).toBe('informar');
    expect(comoPagar('android', true, { pagarNoIos: true, pagarNoAndroid: false })).toBe('informar');
  });
  it('os textos de cada modo: só o "combinar" fala; botão e informar não chamam ninguém a pagar fora', () => {
    expect(textoDeComoPagar('combinar')).toBe(TEXTO_COMBINE_COM_O_TREINADOR);
    expect(textoDeComoPagar('botao')).toBeNull();
    expect(textoDeComoPagar('informar')).toBeNull();
    expect(TEXTO_COMBINE_COM_O_TREINADOR).not.toMatch(/pague|site|link/i);
  });
  it('só a web é web: o resto do Platform.OS conta como celular', () => {
    expect(plataformaDoApp('web')).toBe('web');
    expect(plataformaDoApp('ios')).toBe('ios');
    expect(plataformaDoApp('android')).toBe('android');
    expect(plataformaDoApp('windows')).toBe('android');
    expect(plataformaDoApp('macos')).toBe('android');
  });
});

describe('informacaoDaCobranca (celular sem o "Pagar")', () => {
  const cobranca = (extra: Partial<CobrancaDoAluno>): CobrancaDoAluno => ({
    id: 'c', competencia: '2026-11-05', vencimento: '2026-11-05', valorCentavos: 15_000, situacao: 'ABERTA', vencida: false, forma: null, pagoEm: null, ...extra,
  });
  const semEspaco = (t: string | null) => (t ?? '').replace(/ /g, ' ');
  it('aberta no prazo: valor e vencimento', () => {
    expect(semEspaco(informacaoDaCobranca(cobranca({})))).toBe('Mensalidade de R$ 150,00, vence em 05/11');
  });
  it('aberta vencida (a API decide): desde a data do vencimento', () => {
    expect(informacaoDaCobranca(cobranca({ vencida: true, vencimento: '2026-10-05' }))).toBe('Em aberto desde 05/10');
  });
  it('paga: a data da baixa, aceitando a data com hora', () => {
    expect(informacaoDaCobranca(cobranca({ situacao: 'PAGA', pagoEm: '2026-10-19' }))).toBe('Paga em 19/10');
    expect(informacaoDaCobranca(cobranca({ situacao: 'PAGA', pagoEm: '2026-10-19T14:00:00Z' }))).toBe('Paga em 19/10');
  });
  it('paga sem data, cancelada, estornada e contestada ficam sem linha (só o selo)', () => {
    expect(informacaoDaCobranca(cobranca({ situacao: 'PAGA', pagoEm: null }))).toBeNull();
    for (const situacao of ['CANCELADA', 'ESTORNADA', 'CONTESTADA'] as const) expect(informacaoDaCobranca(cobranca({ situacao }))).toBeNull();
  });
  it('nunca chama a pagar nem cita link ou site', () => {
    const linhas = [
      informacaoDaCobranca(cobranca({})), informacaoDaCobranca(cobranca({ vencida: true })),
      informacaoDaCobranca(cobranca({ situacao: 'PAGA', pagoEm: '2026-10-19' })),
    ];
    for (const l of linhas) expect(l).not.toMatch(/pagu|pagar|link|site/i);
  });
});

describe('juros do parcelamento', () => {
  it('os textos e as duas escolhas, Aluno primeiro (o padrão)', () => {
    expect(TITULO_JUROS_DO_PARCELAMENTO).toBe('Quem paga os juros do parcelamento');
    expect(TEXTO_JUROS_DO_PARCELAMENTO).toBe('Aluno: ele paga os juros quando parcela no cartão. Você: você absorve os juros do parcelamento.');
    expect(TEXTO_JUROS_DO_PARCELAMENTO).not.toMatch(/\d/);
    expect(OPCOES_DE_JUROS).toEqual([{ valor: 'ALUNO', rotulo: 'Aluno' }, { valor: 'TREINADOR', rotulo: 'Você' }]);
    expect(MOTIVO_JUROS_SEM_CHAVE).toBe('Precisa da chave de API para valer.');
  });
  it('há chave valendo: a configurada, ou uma digitada que passa na validação', () => {
    expect(temChaveParaJuros(true, '')).toBe(true);
    expect(temChaveParaJuros(false, '')).toBe(false);
    expect(temChaveParaJuros(false, null)).toBe(false);
    expect(temChaveParaJuros(false, '   ')).toBe(false);
    expect(temChaveParaJuros(false, 'curta')).toBe(false);
    expect(temChaveParaJuros(false, 'tem espaco no meio 123')).toBe(false);
    expect(temChaveParaJuros(false, ' chave-de-teste-0123456789 ')).toBe(true);
  });
  it('"Você" só vale com chave; sem ela a escolha volta para Aluno', () => {
    expect(jurosQueValem('TREINADOR', true)).toBe('TREINADOR');
    expect(jurosQueValem('TREINADOR', false)).toBe('ALUNO');
    expect(jurosQueValem('ALUNO', true)).toBe('ALUNO');
    expect(jurosQueValem(null, true)).toBe('ALUNO');
    expect(jurosQueValem(undefined, false)).toBe('ALUNO');
  });
  it('validação: só "Você" sem chave é erro', () => {
    expect(validarJurosDoParcelamento('TREINADOR', false)).toBe(MOTIVO_JUROS_SEM_CHAVE);
    expect(validarJurosDoParcelamento('TREINADOR', true)).toBeNull();
    expect(validarJurosDoParcelamento('ALUNO', false)).toBeNull();
  });
  it('rótulo de leitura fala do treinador, não de "você"', () => {
    expect(rotuloDosJurosParaLeitura('ALUNO')).toBe('O aluno paga os juros');
    expect(rotuloDosJurosParaLeitura('TREINADOR')).toBe('O treinador absorve os juros');
    expect(rotuloDosJurosParaLeitura(null)).toBe('—');
  });
});

describe('retorno do navegador depois do pagamento', () => {
  const order = '0b9a6a4e-3f0b-4b6e-9a3a-0a5b2f3c1d11';
  it('com os dois NSU válidos, devolve só os quatro campos conhecidos', () => {
    expect(lerRetornoDoPagamento({
      order_nsu: order, transaction_nsu: 'ABC123xyz', slug: 'abc-123', capture_method: 'credit_card', receipt_url: 'https://x.invalid/r', outro: 'lixo',
    })).toEqual({
      presente: true, retorno: { orderNsu: order, transactionNsu: 'ABC123xyz', slug: 'abc-123', captureMethod: 'credit_card' },
    });
  });
  it('slug e capture_method são opcionais e, inválidos, são descartados', () => {
    expect(lerRetornoDoPagamento({ order_nsu: order, transaction_nsu: 'tx1' }).retorno).toEqual({ orderNsu: order, transactionNsu: 'tx1' });
    expect(lerRetornoDoPagamento({ order_nsu: order, transaction_nsu: 'tx1', slug: 'com espaço', capture_method: '<b>' }).retorno)
      .toEqual({ orderNsu: order, transactionNsu: 'tx1' });
  });
  it('sem um dos NSU, ou com NSU fora do padrão, não chama a API mas o endereço ainda é limpo', () => {
    expect(lerRetornoDoPagamento({ order_nsu: order })).toEqual({ presente: true, retorno: null });
    expect(lerRetornoDoPagamento({ transaction_nsu: 'tx1' })).toEqual({ presente: true, retorno: null });
    expect(lerRetornoDoPagamento({ order_nsu: '../../x', transaction_nsu: 'tx1' }).retorno).toBeNull();
    expect(lerRetornoDoPagamento({ order_nsu: order, transaction_nsu: 'a b' }).retorno).toBeNull();
    expect(lerRetornoDoPagamento({ order_nsu: order, transaction_nsu: 'x'.repeat(101) }).retorno).toBeNull();
    expect(lerRetornoDoPagamento({ order_nsu: '', transaction_nsu: 'tx1' }).retorno).toBeNull();
  });
  it('parâmetro repetido (lista) só vale com um valor', () => {
    expect(lerRetornoDoPagamento({ order_nsu: [order], transaction_nsu: ['tx1'] }).retorno).toEqual({ orderNsu: order, transactionNsu: 'tx1' });
    expect(lerRetornoDoPagamento({ order_nsu: [order, 'outro'], transaction_nsu: 'tx1' }).retorno).toBeNull();
  });
  it('sem nenhum parâmetro do retorno, nada a fazer', () => {
    expect(lerRetornoDoPagamento({})).toEqual({ presente: false, retorno: null });
    expect(lerRetornoDoPagamento({ aba: 'x' })).toEqual({ presente: false, retorno: null });
  });
  it('os avisos são neutros: não afirmam que o pagamento foi confirmado', () => {
    expect(AVISO_RETORNO_DO_PAGAMENTO).toBe('Recebemos o retorno do pagamento. A confirmação pode levar alguns instantes.');
    expect(AVISO_RETORNO_SEM_CONFIRMAR).toMatch(/pode levar alguns instantes/);
  });
});

describe('recebimento online: link e selo', () => {
  it('copiar o link: só cobrança aberta e com o recebimento configurado', () => {
    expect(podeCopiarLink({ situacao: 'ABERTA' }, true)).toBe(true);
    expect(podeCopiarLink({ situacao: 'ABERTA' }, false)).toBe(false);
    for (const situacao of ['PAGA', 'CANCELADA', 'ESTORNADA', 'CONTESTADA'] as const) {
      expect(podeCopiarLink({ situacao }, true)).toBe(false);
    }
  });
  it('"Online" é provedor preenchido e diferente de MANUAL', () => {
    expect(ehPagamentoOnline({ provedor: 'INFINITEPAY' })).toBe(true);
    expect(ehPagamentoOnline({ provedor: 'MANUAL' })).toBe(false);
    expect(ehPagamentoOnline({ provedor: null })).toBe(false);
    expect(ehPagamentoOnline({ provedor: '' })).toBe(false);
  });
  it('a baixa online continua sem desfazer pelo app', () => {
    expect(podeDesfazerBaixa({ situacao: 'PAGA', provedor: 'INFINITEPAY' })).toBe(false);
  });
  it('os filtros de situação incluem Estornadas e Contestadas', () => {
    const valores = FILTROS_DE_SITUACAO.map((f) => f.valor);
    expect(valores).toContain('ESTORNADA');
    expect(valores).toContain('CONTESTADA');
    expect(FILTROS_DE_SITUACAO.find((f) => f.valor === 'ESTORNADA')?.rotulo).toBe('Estornadas');
  });
});

describe('motivo da conferência', () => {
  const todos: MotivoDaConferencia[] = [
    'COBRANCA_CANCELADA', 'COBRANCA_JA_PAGA', 'VALOR_DIFERENTE', 'LINK_DIFERENTE', 'FORMA_DESCONHECIDA',
    'COBRANCA_NAO_ENCONTRADA', 'CONSULTA_FALHOU', 'ESTORNO_INFORMADO',
  ];
  it('cada motivo tem um texto curto e diferente', () => {
    const textos = todos.map((m) => rotuloDoMotivoDaConferencia(m));
    expect(new Set(textos).size).toBe(todos.length);
    expect(textos).toContain('Cobrança já cancelada');
    expect(textos).toContain('Já estava paga (pagamento em dobro?)');
    expect(textos).toContain('Valor diferente do combinado');
    expect(textos).toContain('Link diferente do da cobrança');
    expect(textos).toContain('Forma de pagamento desconhecida');
    expect(textos).toContain('Cobrança não encontrada');
    expect(textos).toContain('Não foi possível confirmar com a InfinitePay');
    for (const t of textos.filter((x) => !x.startsWith('A InfinitePay informou'))) expect(t.length).toBeLessThanOrEqual(50);
  });
  it('estorno informado: diz que foi a InfinitePay quem informou e que o ajuste é à mão, sem sugerir que o sistema estornou', () => {
    const texto = rotuloDoMotivoDaConferencia('ESTORNO_INFORMADO');
    expect(texto).toBe('A InfinitePay informou estorno deste pagamento. Confira na sua conta e, se for o caso, ajuste a cobrança à mão.');
    expect(texto).not.toMatch(/estornada|estornamos|desfeit/i);
  });
  it('o texto do cartão diz que nada é baixado nem desfeito sozinho', () => {
    expect(TEXTO_NADA_E_BAIXADO).toMatch(/nem desfeito sozinho/);
  });
  it('motivo desconhecido ou ausente não quebra', () => {
    expect(rotuloDoMotivoDaConferencia(null)).toBe('Conferir manualmente');
    expect(rotuloDoMotivoDaConferencia('NOVO' as MotivoDaConferencia)).toBe('Conferir manualmente');
  });
});

describe('validarRecebimentoOnline', () => {
  const ok = { infiniteTag: null, apiKey: null };
  it('a InfiniteTag vale com ou sem cifrão, com espaços e em maiúscula', () => {
    expect(validarRecebimentoOnline({ infiniteTag: 'saraiva.team' })).toEqual(ok);
    expect(validarRecebimentoOnline({ infiniteTag: '  $Saraiva_Team ' })).toEqual(ok);
    expect(normalizarInfiniteTag('  $Saraiva_Team ')).toBe('saraiva_team');
    expect(normalizarInfiniteTag('$ abc')).toBe('abc');
    expect(normalizarInfiniteTag(null)).toBe('');
  });
  it('tamanho da InfiniteTag: de 3 a 40', () => {
    expect(validarRecebimentoOnline({ infiniteTag: 'ab' }).infiniteTag).not.toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'abc' }).infiniteTag).toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'a'.repeat(40) }).infiniteTag).toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'a'.repeat(41) }).infiniteTag).not.toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: '  ' }).infiniteTag).toBe('Informe a sua InfiniteTag.');
  });
  it('InfiniteTag com caractere fora de letras, números, ponto, hífen e sublinhado', () => {
    expect(validarRecebimentoOnline({ infiniteTag: 'meu nome' }).infiniteTag).not.toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'a@b.com' }).infiniteTag).not.toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'ação' }).infiniteTag).not.toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: '$$abc' }).infiniteTag).not.toBeNull();
  });
  it('a chave é opcional; preenchida, de 10 a 200 caracteres sem espaço', () => {
    expect(validarRecebimentoOnline({ infiniteTag: 'abc', apiKey: '' }).apiKey).toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'abc', apiKey: null }).apiKey).toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'abc', apiKey: '   ' }).apiKey).toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'abc', apiKey: 'a'.repeat(9) }).apiKey).not.toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'abc', apiKey: 'a'.repeat(10) }).apiKey).toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'abc', apiKey: 'a'.repeat(200) }).apiKey).toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'abc', apiKey: 'a'.repeat(201) }).apiKey).not.toBeNull();
    expect(validarRecebimentoOnline({ infiniteTag: 'abc', apiKey: 'abcde fghijk' }).apiKey).not.toBeNull();
  });
  it('a mensagem de erro nunca repete a chave digitada', () => {
    const erros = validarRecebimentoOnline({ infiniteTag: 'abc', apiKey: 'segredo com espaco' });
    expect(erros.apiKey).not.toBeNull();
    expect(erros.apiKey).not.toContain('segredo');
  });
});

describe('sem boleto', () => {
  it('nenhum texto do financeiro fala em boleto', () => {
    const textos = [
      ...FORMAS_MANUAIS.map((f) => f.rotulo),
      ...(['DINHEIRO', 'PIX_DIRETO', 'TRANSFERENCIA', 'OUTRO', 'PIX', 'CARTAO'] as const).map((f) => rotuloDaForma(f)),
      ...FILTROS_DE_SITUACAO.map((f) => f.rotulo),
      ...COMO_CALCULAMOS,
      AVISO_LIQUIDO,
      TEXTO_COMBINE_COM_O_TREINADOR,
      TEXTO_JUROS_DO_PARCELAMENTO,
      TEXTO_RECEBIMENTO_ONLINE,
      TEXTO_SEM_CONFIGURAR_O_RECEBIMENTO,
      TEXTO_CHAVE_DO_RECEBIMENTO,
      TEXTO_NADA_E_BAIXADO,
    ];
    for (const t of textos) expect(t).not.toMatch(/boleto/i);
  });
  it('a forma BOLETO não existe mais: cai em "—"', () => {
    expect(rotuloDaForma('BOLETO' as never)).toBe('—');
  });
});
