import { ErroApi } from '@plataforma/web';
import { seloDoTipoDaCobranca } from './financeiro';
import { origemDaCobranca } from './folhaDaCobranca';
import { motivoDeFicarDeFora, podeDesfazerAcordo, podeRenegociar } from './renegociar';

import {
  alertaDeAtraso, cobrancasCriadas, cobrancasDoContrato, corpoDaPreviaDoContrato, corpoDoContrato, detalheDaFalta, ehDoContratoFechado, estadoDoCriar,
  linhaDaConferencia, motivoSemSaldo, parcelasResumidas, primeiroVencimentoSugerido, situacaoNoContrato, subtituloDoContrato, textoAoEncerrar,
  errosNaLinha, ordemPorVencimento, parcelasDoCorpo, parcelasParaEditar, traduzirErroDoContrato, traduzirErroDoSaldo, validarContrato, type ContratoDigitado,
} from './contratoFechado';

const erro = (status: number, codigo: string, fieldErrors: { field: string; message: string }[] = [], message = 'Recusado.') =>
  new ErroApi(status, codigo, message, fieldErrors);

const digitado = (extra: Partial<ContratoDigitado> = {}): ContratoDigitado => ({
  modo: 'PARCELADO_FIXO', totalTexto: 'R$ 3.000,00', semEntrada: false, entradaTexto: 'R$ 600,00', entradaDataTexto: '19/10/2026',
  entradaJaPaga: false, entradaForma: null, quantidade: 3, primeiroVencimentoTexto: '19/11/2026', ...extra,
});

describe('validarContrato', () => {
  it('lê os campos sem fazer conta de dinheiro', () => {
    const v = validarContrato(digitado());
    expect(v.erros).toEqual({});
    expect(v.totalCentavos).toBe(300_000);
    expect(v.entrada).toEqual({ valorCentavos: 60_000, data: '2026-10-19', jaPaga: false });
    expect(v.primeiroVencimento).toBe('2026-11-19');
  });

  it('cobra o que falta: total, entrada (ou "Sem entrada"), data, forma da entrada paga e parcelas de 1 a 12', () => {
    const v = validarContrato(digitado({ totalTexto: '', entradaTexto: '', entradaDataTexto: '31/02/2026', entradaJaPaga: true, quantidade: 13, primeiroVencimentoTexto: '' }));
    expect(Object.keys(v.erros).sort()).toEqual(['entrada', 'entradaData', 'entradaForma', 'parcelas', 'primeiroVencimento', 'total']);
    expect(validarContrato(digitado({ semEntrada: true, entradaTexto: '' })).erros).toEqual({});
  });

  it('a entrada paga leva a forma; o saldo livre não confere parcelas nem primeiro vencimento', () => {
    expect(validarContrato(digitado({ entradaJaPaga: true, entradaForma: 'PIX_DIRETO' })).entrada).toEqual({ valorCentavos: 60_000, data: '2026-10-19', jaPaga: true, forma: 'PIX_DIRETO' });
    expect(validarContrato(digitado({ modo: 'SALDO_ABERTO', quantidade: 0, primeiroVencimentoTexto: '' })).erros).toEqual({});
  });
});

describe('prévia e corpo', () => {
  it('sem edição o servidor divide; com edição só confere; plano e início vão junto; saldo livre só total e entrada', () => {
    const d = digitado();
    const v = validarContrato(d);
    expect(corpoDaPreviaDoContrato(d, v, null)).toEqual({
      modoCobranca: 'PARCELADO_FIXO', valorTotalCentavos: 300_000, entrada: { valorCentavos: 60_000, data: '2026-10-19', jaPaga: false }, quantidade: 3, primeiroVencimento: '2026-11-19',
    });
    expect(corpoDaPreviaDoContrato(d, v, [{ vencimentoTexto: '19/11/2026', valorTexto: 'R$ 800,00' }])).toEqual({
      modoCobranca: 'PARCELADO_FIXO', valorTotalCentavos: 300_000, entrada: { valorCentavos: 60_000, data: '2026-10-19', jaPaga: false },
      parcelas: [{ vencimento: '2026-11-19', valorCentavos: 80_000 }],
    });
    expect(corpoDaPreviaDoContrato(d, v, [{ vencimentoTexto: '19/11', valorTexto: 'R$ 800,00' }])).toBeNull();
    const saldo = digitado({ modo: 'SALDO_ABERTO' });
    // Saldo livre: só o total e a entrada (a API diz se a entrada cabe).
    expect(corpoDaPreviaDoContrato(saldo, validarContrato(saldo), null))
      .toEqual({ modoCobranca: 'SALDO_ABERTO', valorTotalCentavos: 300_000, entrada: { valorCentavos: 60_000, data: '2026-10-19', jaPaga: false } });
  });

  it('o corpo leva as parcelas da prévia que fechou, sem a linha da Entrada; sem fechar, nada', () => {
    const d = digitado();
    const v = validarContrato(d);
    const base = { planoComercialId: 'p', inicio: '2026-10-19' };
    const previa = {
      parcelas: [
        { numero: null, vencimento: '2026-10-19', valorCentavos: 60_000, descricao: 'Entrada' },
        { numero: 1, vencimento: '2026-11-19', valorCentavos: 240_000, descricao: 'Parcela 1/1' },
      ],
      somaCentavos: 300_000, fecha: true, diferencaCentavos: 0,
    };
    expect(parcelasParaEditar(previa)).toEqual([{ vencimentoTexto: '19/11/2026', valorTexto: 'R$ 2.400,00' }]);
    expect(corpoDoContrato(base, d, v, previa)).toEqual({
      ...base, modoCobranca: 'PARCELADO_FIXO', valorTotalCentavos: 300_000,
      entrada: { valorCentavos: 60_000, data: '2026-10-19', jaPaga: false }, parcelas: [{ vencimento: '2026-11-19', valorCentavos: 240_000 }],
    });
    expect(corpoDoContrato(base, d, v, { ...previa, fecha: false })).toBeNull();
    const saldo = digitado({ modo: 'SALDO_ABERTO', semEntrada: true });
    expect(corpoDoContrato(base, saldo, validarContrato(saldo), null)).toBeNull();
    expect(corpoDoContrato(base, saldo, validarContrato(saldo), { parcelas: [], somaCentavos: 0, fecha: true, diferencaCentavos: 300_000 }))
      .toEqual({ ...base, modoCobranca: 'SALDO_ABERTO', valorTotalCentavos: 300_000, entrada: null });
  });

  it('limites da API conferidos no campo', () => {
    expect(validarContrato(digitado({ totalTexto: '10.000.000,01' })).erros.total).toBe('O valor total vai até R$ 10.000.000,00.');
    expect(validarContrato(digitado({ entradaTexto: '1.000.000,01' })).erros.entrada).toBe('A entrada vai até R$ 1.000.000,00.');
  });

  it('o "Criar contrato" espera a conferência em dia e que ela feche', () => {
    const fecha = { parcelas: [], somaCentavos: 1, fecha: true, diferencaCentavos: 0 };
    expect(estadoDoCriar('PARCELADO_FIXO', false, { emDia: true, dados: fecha, erro: false, pedida: true })).toEqual({ habilitado: true });
    expect(estadoDoCriar('PARCELADO_FIXO', false, { emDia: false, dados: fecha, erro: false, pedida: true })).toMatchObject({ habilitado: false });
    expect(estadoDoCriar('PARCELADO_FIXO', false, { emDia: true, dados: { ...fecha, fecha: false }, erro: false, pedida: true }))
      .toEqual({ habilitado: false, motivo: 'A soma das cobranças precisa fechar com o valor total.' });
    expect(estadoDoCriar('PARCELADO_FIXO', true, { emDia: true, dados: fecha, erro: false, pedida: true })).toMatchObject({ habilitado: false });
    expect(estadoDoCriar('SALDO_ABERTO', false, { emDia: true, dados: fecha, erro: false, pedida: true })).toEqual({ habilitado: true });
    expect(estadoDoCriar('SALDO_ABERTO', false, { emDia: false, dados: fecha, erro: false, pedida: true })).toMatchObject({ habilitado: false });
  });
});

describe('textos com os números da API', () => {
  it('conferência', () => {
    expect(linhaDaConferencia({ fecha: true, somaCentavos: 300_000, diferencaCentavos: 0, parcelas: [] }, 300_000))
      .toEqual({ fecha: true, titulo: 'A soma fecha com o valor total', detalhe: 'Soma R$ 3.000,00 de R$ 3.000,00' });
    expect(linhaDaConferencia({ fecha: false, somaCentavos: 290_000, diferencaCentavos: 10_000, parcelas: [] }, 300_000).detalhe)
      .toBe('Soma R$ 2.900,00 de R$ 3.000,00 · diferença de R$ 100,00. Ajuste as parcelas ou toque em "Dividir o restante igual".');
    expect(linhaDaConferencia({ fecha: false, somaCentavos: 310_000, diferencaCentavos: -10_000, parcelas: [] }, 300_000).detalhe).toContain('diferença de R$ 100,00');
    const entrada = [{ numero: null, descricao: 'Entrada', vencimento: '2026-10-19', valorCentavos: 50_000 }];
    expect(linhaDaConferencia({ fecha: true, somaCentavos: 50_000, diferencaCentavos: 150_000, parcelas: entrada }, 200_000, 'SALDO_ABERTO'))
      .toEqual({ fecha: true, titulo: 'A entrada cabe no valor total', detalhe: 'Entrada R$ 500,00 de R$ 2.000,00. O resto fica como saldo.' });
  });

  it('parcelas resumidas e cobranças criadas', () => {
    expect(parcelasResumidas([{ valorCentavos: 80_000 }, { valorCentavos: 80_000 }, { valorCentavos: 80_000 }])).toBe('3 × R$ 800,00');
    expect(parcelasResumidas([{ valorCentavos: 33_333 }, { valorCentavos: 33_333 }, { valorCentavos: 33_334 }])).toBe('2 × R$ 333,33 + 1 × R$ 333,34');
    expect(parcelasResumidas([])).toBe('—');
    expect(cobrancasCriadas('PARCELADO_FIXO', true, 3)).toBe('4 cobranças (entrada + 3 parcelas)');
    expect(cobrancasCriadas('PARCELADO_FIXO', false, 1)).toBe('1 cobrança (1 parcela)');
    expect(cobrancasCriadas('SALDO_ABERTO', true, null)).toBe('1 cobrança (a entrada). Cada pagamento do saldo vira outra.');
  });

  it('cartão: subtítulo, falta, alerta, situação', () => {
    const cobrancas = [{ tipo: 'AVULSA' as const }, { tipo: 'RENEGOCIACAO' as const }, { tipo: 'RENEGOCIACAO' as const }, { tipo: 'RENEGOCIACAO' as const }];
    expect(subtituloDoContrato('PARCELADO_FIXO', cobrancas, '2026-08-24', '2026-11-24')).toBe('Entrada + 3 parcelas fixas · de 24/08/2026 a 24/11/2026');
    expect(subtituloDoContrato('SALDO_ABERTO', [], '2026-08-24', null)).toBe('Entrada + saldo livre · de 24/08/2026');
    expect(detalheDaFalta([{ situacao: 'ABERTA', vencida: true }, { situacao: 'ABERTA', vencida: false }, { situacao: 'PAGA', vencida: false }])).toBe('1 vencida · 1 a vencer');
    expect(detalheDaFalta([{ situacao: 'PAGA', vencida: false }])).toBeNull();
    expect(alertaDeAtraso({ vencidas: 0, valorVencidoCentavos: 0, maisAntigaVencida: null })).toBeNull();
    expect(alertaDeAtraso({ vencidas: 1, valorVencidoCentavos: 80_000, maisAntigaVencida: { cobrancaId: 'c', descricao: 'Parcela 2/3', vencimento: '2026-10-24', diasDeAtraso: 31 } }))
      .toEqual({ titulo: '1 cobrança vencida · a mais antiga há 31 dias', texto: 'R$ 800,00 em atraso (Parcela 2/3, venceu em 24/10/2026).' });
    const base = { forma: null, pagoEm: null, diasDeAtraso: null, vencimento: '2026-11-24' };
    expect(situacaoNoContrato({ ...base, situacao: 'ABERTA', vencida: true, diasDeAtraso: 3 })).toBe('3 dias de atraso');
    expect(situacaoNoContrato({ ...base, situacao: 'ABERTA', vencida: false }, '2026-11-24')).toBe('Vence hoje');
    expect(situacaoNoContrato({ ...base, situacao: 'ABERTA', vencida: false }, '2026-11-20')).toBeNull();
    expect(situacaoNoContrato({ ...base, situacao: 'PAGA', vencida: false, forma: 'PIX_DIRETO', pagoEm: '2026-09-24' })).toBe('Pix direto · 24/09/2026');
  });

  it('cobranças do contrato: só as da contratação, em ordem de vencimento', () => {
    const lista = [
      { id: 'b', contratacaoId: 'k', vencimento: '2026-12-01', tipo: 'RENEGOCIACAO' as const }, { id: 'x', contratacaoId: 'outra', vencimento: '2026-01-01', tipo: 'AVULSA' as const },
      { id: 'a', contratacaoId: 'k', vencimento: '2026-11-01', tipo: 'AVULSA' as const }, { id: 'm', contratacaoId: 'k', vencimento: '2026-10-01', tipo: 'SAIDA' as const },
    ];
    // A multa (SAIDA) é da contratação mas não do contrato, como na API.
    expect(cobrancasDoContrato(lista, 'k').map((c) => c.id)).toEqual(['a', 'b']);
    expect(ehDoContratoFechado({ contratacaoId: 'k', tipo: 'AVULSA' })).toBe(true);
    expect(ehDoContratoFechado({ contratacaoId: 'k', tipo: 'MENSALIDADE' })).toBe(false);
    expect(ehDoContratoFechado({ contratacaoId: null, tipo: 'RENEGOCIACAO' })).toBe(false);
  });

  it('saldo e encerrar', () => {
    expect(motivoSemSaldo({ saldoCentavos: 0, limiteDeLancamentoCentavos: 0 })).toBe('O contrato está quitado: não há saldo a receber.');
    expect(motivoSemSaldo({ saldoCentavos: 500, limiteDeLancamentoCentavos: 0 })).toMatch(/já está em cobranças em aberto/);
    expect(motivoSemSaldo({ saldoCentavos: 500, limiteDeLancamentoCentavos: 500 })).toBeNull();
    expect(textoAoEncerrar(1, { valorCentavos: 30_000, vencimento: '2026-12-01' }))
      .toBe('Ao encerrar: o contrato fica Encerrado, 1 cobrança futura é cancelada e é criada 1 cobrança de multa rescisória de R$ 300,00 com vencimento em 01/12/2026.');
    expect(textoAoEncerrar(0, null)).toBe('Ao encerrar: o contrato fica Encerrado.');
    expect(textoAoEncerrar(2, null)).toBe('Ao encerrar: o contrato fica Encerrado e 2 cobranças futuras são canceladas.');
    expect(primeiroVencimentoSugerido('2026-01-31')).toBe('28/02/2026');
  });
});

describe('parcelas fora de ordem (a API ordena por vencimento)', () => {
  const editadas = [
    { vencimentoTexto: '20/12/2026', valorTexto: 'R$ 800,00' },
    { vencimentoTexto: '21/01/2027', valorTexto: 'R$ 700,00' },
    { vencimentoTexto: '19/01/2027', valorTexto: 'R$ 900,00' },
  ];
  it('o corpo vai por vencimento; empate mantém a ordem digitada', () => {
    expect(ordemPorVencimento(editadas)).toEqual([0, 2, 1]);
    expect(parcelasDoCorpo(editadas)).toEqual([
      { vencimento: '2026-12-20', valorCentavos: 80_000 }, { vencimento: '2027-01-19', valorCentavos: 90_000 }, { vencimento: '2027-01-21', valorCentavos: 70_000 },
    ]);
    expect(ordemPorVencimento([{ vencimentoTexto: '01/12/2026', valorTexto: '1' }, { vencimentoTexto: '01/12/2026', valorTexto: '2' }])).toEqual([0, 1]);
  });
  it('o erro da parcela de índice ordenado volta para a linha da tela', () => {
    const t = traduzirErroDoContrato(erro(422, 'CONTRATO_INVALIDO', [{ field: 'parcelas[2].valorCentavos', message: 'Informe um valor até R$ 1.000.000,00.' }]));
    // A parcela 2 da lista ordenada (21/01/2027) é a segunda linha da tela.
    expect(errosNaLinha(t.campos, ordemPorVencimento(editadas))).toEqual({ valor1: 'Informe um valor até R$ 1.000.000,00.' });
    expect(errosNaLinha({ total: 'x', valor0: 'y' }, null)).toEqual({ total: 'x', valor0: 'y' });
  });
});

describe('erros', () => {
  it('contratar: 422 por campo, campo desconhecido na frase', () => {
    const t = traduzirErroDoContrato(erro(422, 'CONTRATO_INVALIDO', [
      { field: 'valorTotalCentavos', message: 'Valor fora da faixa.' }, { field: 'parcelas[1].vencimento', message: 'Data fora da faixa.' },
      { field: 'modoCobranca', message: 'Plano da Kiwify só aceita recorrente.' }, { field: 'outro', message: 'Outro problema.' },
    ]));
    expect(t.campos).toEqual({ total: 'Valor fora da faixa.', vencimento1: 'Data fora da faixa.', modo: 'Plano da Kiwify só aceita recorrente.' });
    // Fim do contrato: a divisão automática no passo e no primeiro vencimento; a lista editada, na célula.
    expect(traduzirErroDoContrato(erro(422, 'CONTRATO_INVALIDO', [
      { field: 'quantidade', message: 'Passa do fim.' }, { field: 'primeiroVencimento', message: 'Depois do fim.' },
      { field: 'parcelas[2].valorCentavos', message: 'Valor alto.' },
    ])).campos).toEqual({ quantidade: 'Passa do fim.', primeiroVencimento: 'Depois do fim.', valor2: 'Valor alto.' });
    expect(t.mensagem).toBe('Outro problema.');
  });

  it('saldo: 422 no campo do valor; 409 recarrega', () => {
    expect(traduzirErroDoSaldo(erro(422, 'SALDO_INVALIDO', [{ field: 'valorCentavos', message: 'Acima do que falta.' }])))
      .toEqual({ mensagem: null, campoValor: 'Acima do que falta.', recarregar: true });
    expect(traduzirErroDoSaldo(erro(409, 'CONTRATO_NAO_ACEITA_SALDO', [], 'O contrato não aceita pagamento do saldo.'))).toEqual({
      mensagem: 'O contrato não aceita pagamento do saldo.', campoValor: null, recarregar: true,
    });
    expect(traduzirErroDoSaldo(erro(409, 'PEDIDO_JA_USADO', [], 'Já registrado com outros dados.'))).toEqual({
      mensagem: 'Já registrado com outros dados.', campoValor: null, recarregar: true, novoPedido: true,
    });
    expect(traduzirErroDoSaldo(erro(422, 'CONTRATO_INVALIDO', [{ field: 'forma', message: 'Escolha a forma.' }])))
      .toEqual({ mensagem: 'Escolha a forma.', campoValor: null, recarregar: false });
  });
});

describe('cercas nas regras que já existiam', () => {
  it('cobrança do contrato não renegocia, não desfaz acordo e não ganha o selo de avulsa ou acordo', () => {
    const parcela = { situacao: 'ABERTA' as const, tipo: 'RENEGOCIACAO' as const, acordoId: 'a', contratacaoId: 'k' };
    const entrada = { situacao: 'ABERTA' as const, tipo: 'AVULSA' as const, contratacaoId: 'k' };
    expect(motivoDeFicarDeFora(entrada)).toBe('Faz parte de um contrato fechado e não entra em renegociação.');
    expect(podeRenegociar(entrada)).toBe(false);
    expect(podeDesfazerAcordo(parcela)).toBe(false);
    expect(podeDesfazerAcordo({ ...parcela, contratacaoId: null })).toBe(true);
    expect(seloDoTipoDaCobranca('RENEGOCIACAO', 'k')).toBeNull();
    expect(seloDoTipoDaCobranca('AVULSA', 'k')).toBeNull();
    expect(seloDoTipoDaCobranca('AVULSA', null)).toEqual({ tom: 'neutro', rotulo: 'Avulsa' });
    expect(origemDaCobranca({ tipo: 'RENEGOCIACAO', planoNome: 'Trimestral', descricao: 'Parcela 2/3', contratacaoId: 'k' })).toBe('Parcela 2/3 · contrato Trimestral');
  });
});
