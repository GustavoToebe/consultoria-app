import { ErroApi } from '@plataforma/web';

import type { OpcaoDaPrevia, PreviaDoEncerramento, ResumoDaSaidaDoAluno } from '../api/financeiroTipos';
import {
  abertasQueContinuamNaSaida, avisoDeLinkVivo, corpoDoEncerrar, errosDoMinimoDoServidor, fraseDasAbertasQueContinuam, linhasDaConta,
  linhasDoPainelDeInativar, minimoDoPlanoParaEnvio, minimoDoPlanoParaForm, opcoesDoPainel, planoPodeTerMinimo, somarMeses,
  TEXTO_GENERICO_DO_INATIVAR, textoDoMinimoAte, textoDoMinimoDoPlano, textoDosMesesQueFaltam, traduzirErroDoEncerrar,
  validarMinimoAte, validarVencimentoDaSaida,
} from './saidaDoPlano';

const HOJE = '2026-11-16';
const semEspaco = (t: string | null) => (t ?? '').replace(/ /g, ' ');
const opcoes: OpcaoDaPrevia[] = [
  { opcao: 'FALTAM', disponivel: true, valorCentavos: 45_000, motivo: null },
  { opcao: 'VIGENTE', disponivel: false, valorCentavos: null, motivo: 'Já há mensalidade do mês vigente.' },
  { opcao: 'OUTRO', disponivel: true, valorCentavos: null, motivo: null },
  { opcao: 'NAO_COBRAR', disponivel: true, valorCentavos: null, motivo: null },
];
const previa = (extra: Partial<PreviaDoEncerramento> = {}): PreviaDoEncerramento => ({
  contratacaoId: 'c', periodicidade: 'MENSAL', situacao: 'ATIVA', minimoAte: '2027-04-05', mesesQueFaltam: 3, regraDeSaida: null,
  vencidas: { quantidade: 2, valorCentavos: 30_000 }, aVencerNoMinimo: { quantidade: 2, valorCentavos: 30_000 },
  aVencerQueFicam: { quantidade: 1, valorCentavos: 15_000 }, cobrancasACancelar: ['a', 'b'], comLinkVivo: 1, mesesNaoGerados: 1,
  valorDosNaoGeradosCentavos: 15_000, opcoes, ...extra,
});
const vazio = { quantidade: 0, valorCentavos: 0 };

describe('datas', () => {
  it('somarMeses prende no último dia do mês', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2028-02-29', 12)).toBe('2029-02-28');
    expect(somarMeses('2026-11-16', 60)).toBe('2031-11-16');
    expect(somarMeses('2026-12-10', 1)).toBe('2027-01-10');
  });
  it('vencimento da saída: vazio vale hoje, de hoje a hoje + 1 ano', () => {
    expect(validarVencimentoDaSaida('', HOJE)).toEqual({ iso: null, erro: null });
    expect(validarVencimentoDaSaida('16/11/2026', HOJE)).toEqual({ iso: '2026-11-16', erro: null });
    expect(validarVencimentoDaSaida('16/11/2027', HOJE)).toEqual({ iso: '2027-11-16', erro: null });
    expect(validarVencimentoDaSaida('15/11/2026', HOJE).erro).toMatch(/hoje até um ano/);
    expect(validarVencimentoDaSaida('17/11/2027', HOJE).erro).toMatch(/hoje até um ano/);
    expect(validarVencimentoDaSaida('31/02/2027', HOJE).erro).toBe('Data inválida.');
    expect(validarVencimentoDaSaida('16/11', HOJE).erro).toBe('Data inválida.');
  });
});

describe('painel de encerrar', () => {
  it('opções: rótulo do app, valor e motivo da API; só OUTRO digita', () => {
    const o = opcoesDoPainel(previa());
    expect(o.map((x) => x.rotulo)).toEqual(['Meses que faltam para o mínimo', 'Mês vigente', 'Outro valor', 'Não cobrar']);
    expect(o[0]).toMatchObject({ disponivel: true, valorCentavos: 45_000, digitavel: false });
    expect(semEspaco(o[0].valor)).toBe('R$ 450,00');
    expect(o[1]).toMatchObject({ disponivel: false, motivo: 'Já há mensalidade do mês vigente.', valor: null });
    expect(o[2].digitavel).toBe(true);
    expect(opcoesDoPainel({ opcoes: [{ opcao: 'XYZ' as never, disponivel: true, valorCentavos: null, motivo: null }] })).toEqual([]);
    expect(opcoesDoPainel({ opcoes: [{ opcao: 'FALTAM', disponivel: false, valorCentavos: null, motivo: null }] })[0].motivo).toBe('Esta opção não está disponível.');
  });
  it('"Faltam N meses para o mínimo (até dd/mm/aaaa)", singular e sem mínimo', () => {
    expect(textoDosMesesQueFaltam(previa())).toBe('Faltam 3 meses para o mínimo (até 05/04/2027)');
    expect(textoDosMesesQueFaltam(previa({ mesesQueFaltam: 1 }))).toBe('Falta 1 mês para o mínimo (até 05/04/2027)');
    expect(textoDosMesesQueFaltam(previa({ mesesQueFaltam: 0 }))).toBe('Não faltam meses para o mínimo (até 05/04/2027)');
    expect(textoDosMesesQueFaltam(previa({ minimoAte: null }))).toBeNull();
  });
  it('a conta lista o que a API separou e some sem mínimo', () => {
    expect(linhasDaConta(previa()).map(semEspaco)).toEqual([
      '2 mensalidades a vencer dentro do mínimo (R$ 300,00), canceladas ao cobrar a saída.',
      '1 mês ainda não gerado (R$ 150,00).',
    ]);
    expect(linhasDaConta(previa({ aVencerNoMinimo: vazio, mesesNaoGerados: 0 }))).toEqual([]);
    expect(linhasDaConta(previa({ aVencerNoMinimo: { quantidade: 1, valorCentavos: 15_000 }, mesesNaoGerados: 3 }))[0]).toMatch(/^1 mensalidade a vencer .*, cancelada ao cobrar a saída\.$/);
  });
  it('aviso de link vivo', () => {
    expect(avisoDeLinkVivo(0)).toBeNull();
    expect(avisoDeLinkVivo(1)).toMatch(/^Uma das cobranças canceladas tem link/);
    expect(avisoDeLinkVivo(3)).toMatch(/^3 das cobranças canceladas têm link/);
    expect(avisoDeLinkVivo(1)).toContain('Para conferir');
  });
  it('abertas que continuam: FALTAM cancela as do mínimo, as outras opções mantêm todas', () => {
    expect(abertasQueContinuamNaSaida(previa(), 'FALTAM')).toBe(3);
    expect(abertasQueContinuamNaSaida(previa(), 'OUTRO')).toBe(5);
    expect(abertasQueContinuamNaSaida(previa(), 'NAO_COBRAR')).toBe(5);
    expect(fraseDasAbertasQueContinuam(previa({ vencidas: { quantidade: 1, valorCentavos: 1 }, aVencerNoMinimo: vazio, aVencerQueFicam: vazio }), 'OUTRO'))
      .toBe('Há 1 cobrança aberta; ela continua valendo. Cancele-a se precisar.');
    expect(fraseDasAbertasQueContinuam(previa(), 'OUTRO')).toMatch(/^Há 5 cobranças abertas/);
    expect(fraseDasAbertasQueContinuam(previa({ vencidas: vazio, aVencerQueFicam: vazio }), 'FALTAM')).toBeNull();
  });
});

describe('corpo do encerrar', () => {
  it('Não cobrar manda só a versão', () => {
    expect(corpoDoEncerrar(previa(), { opcao: 'NAO_COBRAR', valorTexto: '', vencimentoTexto: '' }, 4, HOJE)).toEqual({ ok: true, corpo: { versao: 4 } });
  });
  it('FALTAM leva o valor e os ids da prévia; vencimento vazio vai nulo', () => {
    expect(corpoDoEncerrar(previa(), { opcao: 'FALTAM', valorTexto: '', vencimentoTexto: '' }, 4, HOJE)).toEqual({
      ok: true,
      corpo: { versao: 4, saida: { opcao: 'FALTAM', valorCentavos: 45_000, vencimento: null, cobrancasACancelar: ['a', 'b'] } },
    });
  });
  it('VIGENTE indisponível não envia e mostra o motivo da API', () => {
    expect(corpoDoEncerrar(previa(), { opcao: 'VIGENTE', valorTexto: '', vencimentoTexto: '' }, 4, HOJE)).toEqual({
      ok: false, erros: { opcao: 'Já há mensalidade do mês vigente.' },
    });
  });
  it('VIGENTE disponível não leva lista de cobranças', () => {
    const p = previa({ opcoes: [{ opcao: 'VIGENTE', disponivel: true, valorCentavos: 15_000, motivo: null }] });
    expect(corpoDoEncerrar(p, { opcao: 'VIGENTE', valorTexto: '', vencimentoTexto: '20/11/2026' }, 1, HOJE)).toEqual({
      ok: true, corpo: { versao: 1, saida: { opcao: 'VIGENTE', valorCentavos: 15_000, vencimento: '2026-11-20' } },
    });
  });
  it('OUTRO valida o valor digitado (> 0 e <= R$ 1.000.000,00) e o vencimento', () => {
    const outro = (valorTexto: string, vencimentoTexto = '') => corpoDoEncerrar(previa(), { opcao: 'OUTRO', valorTexto, vencimentoTexto }, 1, HOJE);
    expect(outro('R$ 99,90')).toEqual({ ok: true, corpo: { versao: 1, saida: { opcao: 'OUTRO', valorCentavos: 9990, vencimento: null } } });
    expect(outro('1.000.000,00')).toMatchObject({ ok: true });
    expect(outro('1.000.000,01')).toMatchObject({ ok: false, erros: { valor: expect.stringContaining('até R$ 1.000.000,00') } });
    expect(outro('')).toMatchObject({ ok: false, erros: { valor: expect.any(String) } });
    expect(outro('0')).toMatchObject({ ok: false });
    expect(outro('10', '01/01/2025')).toMatchObject({ ok: false, erros: { vencimento: expect.any(String) } });
    expect(outro('', '01/01/2025')).toMatchObject({ ok: false, erros: { valor: expect.any(String), vencimento: expect.any(String) } });
  });
});

describe('erros do encerrar', () => {
  it('409 VALOR_DA_SAIDA_MUDOU recarrega a prévia sem fechar', () => {
    expect(traduzirErroDoEncerrar(new ErroApi(409, 'VALOR_DA_SAIDA_MUDOU', 'x'))).toMatchObject({ recarregar: true, fechar: false, mensagem: expect.stringContaining('A conta da saída mudou') });
  });
  it('409 CONTRATACAO_ENCERRADA recarrega e fecha', () => {
    expect(traduzirErroDoEncerrar(new ErroApi(409, 'CONTRATACAO_ENCERRADA', 'x'))).toMatchObject({ recarregar: true, fechar: true });
  });
  it('409 CONFLITO_EDICAO recarrega', () => {
    expect(traduzirErroDoEncerrar(new ErroApi(409, 'CONFLITO_EDICAO', 'x'))).toMatchObject({ recarregar: true, fechar: false });
  });
  it('422 por campo vira mensagem no campo, sem repetir nada digitado', () => {
    const e = new ErroApi(422, 'CONTRATACAO_INVALIDA', 'Dados inválidos.', [
      { field: 'saida.valorCentavos', message: 'Informe um valor maior que zero.' },
      { field: 'saida.vencimento', message: 'O vencimento vai de hoje até um ano à frente.' },
      { field: 'saida.opcao', message: 'Só vale em plano mensal com tempo mínimo.' },
    ]);
    expect(traduzirErroDoEncerrar(e)).toMatchObject({
      recarregar: false, fechar: false, mensagem: 'Confira os campos destacados.',
      campos: { valor: 'Informe um valor maior que zero.', vencimento: 'O vencimento vai de hoje até um ano à frente.', opcao: 'Só vale em plano mensal com tempo mínimo.' },
    });
  });
  it('outro erro vira frase fixa; sem conexão usa o texto de conexão', () => {
    expect(traduzirErroDoEncerrar(new ErroApi(500, null, 'detalhe interno')).mensagem).toBe('Não foi possível encerrar o plano. Tente de novo.');
    expect(traduzirErroDoEncerrar(new ErroApi(0, null, 'sem rede')).mensagem).not.toBe('Não foi possível encerrar o plano. Tente de novo.');
  });
});

describe('plano: tempo mínimo e regra de saída', () => {
  it('só o plano mensal tem mínimo', () => {
    expect(planoPodeTerMinimo('MENSAL')).toBe(true);
    expect(planoPodeTerMinimo('TRIMESTRAL')).toBe(false);
    expect(planoPodeTerMinimo('PARCELA_UNICA')).toBe(false);
  });
  it('em outra periodicidade os dois vão nulos, mesmo preenchidos', () => {
    expect(minimoDoPlanoParaEnvio({ periodicidade: 'ANUAL', tempoMinimoTexto: '6', regraDeSaidaTexto: 'x' })).toEqual({ ok: true, tempoMinimoMeses: null, regraDeSaida: null });
  });
  it('mensal: vazio = sem mínimo, 1 a 60, regra em branco vira nulo e vai até 500', () => {
    const f = (tempoMinimoTexto: string, regraDeSaidaTexto = '') => minimoDoPlanoParaEnvio({ periodicidade: 'MENSAL', tempoMinimoTexto, regraDeSaidaTexto });
    expect(f('')).toEqual({ ok: true, tempoMinimoMeses: null, regraDeSaida: null });
    expect(f(' 6 ', '  Aviso de 30 dias.  ')).toEqual({ ok: true, tempoMinimoMeses: 6, regraDeSaida: 'Aviso de 30 dias.' });
    expect(f('60')).toMatchObject({ ok: true, tempoMinimoMeses: 60 });
    for (const ruim of ['0', '61', '-1', '1,5', 'abc', '1000']) expect(f(ruim)).toEqual({ ok: false, erros: { tempoMinimo: 'O tempo mínimo vai de 1 a 60 meses.' } });
    expect(f('', 'a'.repeat(500))).toMatchObject({ ok: true });
    expect(f('', 'a'.repeat(501))).toEqual({ ok: false, erros: { regraDeSaida: 'A regra de saída pode ter até 500 caracteres.' } });
  });
  it('form de edição e texto da lista', () => {
    expect(minimoDoPlanoParaForm({ tempoMinimoMeses: 6, regraDeSaida: 'x' })).toEqual({ tempoMinimoTexto: '6', regraDeSaidaTexto: 'x' });
    expect(minimoDoPlanoParaForm({ tempoMinimoMeses: null, regraDeSaida: null })).toEqual({ tempoMinimoTexto: '', regraDeSaidaTexto: '' });
    expect(minimoDoPlanoParaForm(null)).toEqual({ tempoMinimoTexto: '', regraDeSaidaTexto: '' });
    expect(textoDoMinimoDoPlano({ tempoMinimoMeses: 6 })).toBe('Mínimo de 6 meses');
    expect(textoDoMinimoDoPlano({ tempoMinimoMeses: 1 })).toBe('Mínimo de 1 mês');
    expect(textoDoMinimoDoPlano({ tempoMinimoMeses: null })).toBeNull();
  });
  it('422 do servidor por campo', () => {
    expect(errosDoMinimoDoServidor(new ErroApi(422, 'PLANO_INVALIDO', 'x', [{ field: 'tempoMinimoMeses', message: 'm1' }, { field: 'regraDeSaida', message: 'm2' }])))
      .toEqual({ tempoMinimo: 'm1', regraDeSaida: 'm2' });
  });
});

describe('minimoAte da contratação', () => {
  it('vazio apaga; início até início + 60 meses; texto nunca repete o valor', () => {
    expect(validarMinimoAte('', '2026-08-05')).toEqual({ iso: null, erro: null });
    expect(validarMinimoAte('05/08/2026', '2026-08-05')).toEqual({ iso: '2026-08-05', erro: null });
    expect(validarMinimoAte('05/08/2031', '2026-08-05')).toEqual({ iso: '2031-08-05', erro: null });
    expect(validarMinimoAte('04/08/2026', '2026-08-05').erro).toBe('O fim do mínimo vai de 05/08/2026 até 05/08/2031.');
    expect(validarMinimoAte('06/08/2031', '2026-08-05').erro).toBe('O fim do mínimo vai de 05/08/2026 até 05/08/2031.');
    expect(validarMinimoAte('99/99/2026', '2026-08-05').erro).toBe('Data inválida.');
  });
  it('texto do mínimo', () => {
    expect(textoDoMinimoAte('2027-04-05')).toBe('Tempo mínimo até 05/04/2027');
    expect(textoDoMinimoAte(null)).toBe('Sem tempo mínimo');
  });
});

describe('painel de inativar', () => {
  const resumo = (extra: Partial<ResumoDaSaidaDoAluno> = {}): ResumoDaSaidaDoAluno => ({
    aCancelar: { quantidade: 2, valorCentavos: 30_000 }, emAberto: { quantidade: 1, valorCentavos: 15_000 }, minimoAte: '2027-04-05', mesesQueFaltam: 3, ...extra,
  });
  const ctx = { podeLerFinanceiro: true, financeiroLigado: true };
  it('sem permissão, com o financeiro desligado ou sem resumo: texto genérico, sem valores', () => {
    for (const c of [{ podeLerFinanceiro: false, financeiroLigado: true }, { podeLerFinanceiro: true, financeiroLigado: false }]) {
      expect(linhasDoPainelDeInativar(resumo(), c)).toEqual([TEXTO_GENERICO_DO_INATIVAR]);
    }
    expect(linhasDoPainelDeInativar(null, ctx)).toEqual([TEXTO_GENERICO_DO_INATIVAR]);
    expect(TEXTO_GENERICO_DO_INATIVAR).not.toMatch(/R\$/);
  });
  it('com o resumo: cancela, fica em aberto e o mínimo que se perde', () => {
    expect(linhasDoPainelDeInativar(resumo(), ctx).map(semEspaco)).toEqual([
      '2 mensalidades a vencer serão canceladas (R$ 300,00).',
      '1 cobrança vencida ou de saída continua em aberto (R$ 150,00). Dê baixa ou cancele depois, se precisar.',
      'Faltam 3 meses para o mínimo (até 05/04/2027). Inativar não cobra a saída: para cobrar, encerre o plano antes.',
    ]);
    expect(semEspaco(linhasDoPainelDeInativar(resumo({ aCancelar: { quantidade: 1, valorCentavos: 100 }, mesesQueFaltam: 1 }), ctx)[0])).toBe('1 mensalidade a vencer será cancelada (R$ 1,00).');
  });
  it('nada em aberto e sem mínimo: nenhuma linha', () => {
    expect(linhasDoPainelDeInativar(resumo({ aCancelar: vazio, emAberto: vazio, minimoAte: null, mesesQueFaltam: 0 }), ctx)).toEqual([]);
    expect(linhasDoPainelDeInativar(resumo({ aCancelar: vazio, emAberto: vazio, mesesQueFaltam: 0 }), ctx)).toEqual([]);
  });
});
