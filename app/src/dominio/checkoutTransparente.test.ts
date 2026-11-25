import {
  calcularResumoAbatimentoSplit,
  dataUriQrCodeBase64,
  erroCpfCnpjPagador,
  erroCpfPagador,
  formatarPercentualBps,
  formularioCartaoTemErros,
  mascaraCartao,
  mascaraCep,
  mascaraCpf,
  mascaraCpfCnpj,
  mascaraCvv,
  mascaraTelefone,
  mascaraValidadeCartao,
  opcoesDeParcelamento,
  parsearValidadeCartao,
  validarCep,
  validarCnpj,
  validarCpf,
  validarCpfCnpj,
  validarCvv,
  validarFormularioCartao,
  validarLuhn,
  validarNumeroCartao,
  validarValidadeCartao,
} from './checkoutTransparente';

const espacos = (t: string) => t.replace(/\u00a0/g, ' ');

describe('máscaras do checkout transparente', () => {
  it('CPF e CPF/CNPJ', () => {
    expect(mascaraCpf('52998224725')).toBe('529.982.247-25');
    expect(mascaraCpfCnpj('52998224725')).toBe('529.982.247-25');
    expect(mascaraCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('cartão, validade, CVV, CEP e telefone', () => {
    expect(mascaraCartao('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(mascaraValidadeCartao('1228')).toBe('12/28');
    expect(mascaraValidadeCartao('122028')).toBe('12/2028');
    expect(mascaraCvv('12345')).toBe('1234');
    expect(mascaraCep('01001000')).toBe('01001-000');
    expect(mascaraTelefone('11988887777')).toBe('(11) 98888-7777');
    expect(mascaraTelefone('1133334444')).toBe('(11) 3333-4444');
  });
});

describe('validações de documento (CPF e CNPJ)', () => {
  it('valida CPF com dígitos verificadores e rejeita sequências iguais', () => {
    expect(validarCpf('529.982.247-25')).toBe(true);
    expect(validarCpf('52998224725')).toBe(true);
    expect(validarCpf('52998224726')).toBe(false);
    expect(validarCpf('111.111.111-11')).toBe(false);
    expect(validarCpf('123')).toBe(false);
    expect(erroCpfPagador('')).toBe('Informe o CPF do pagador.');
    expect(erroCpfPagador('52998224725')).toBeNull();
  });

  it('valida CNPJ com dígitos verificadores e CPF/CNPJ combinado', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true);
    expect(validarCnpj('11222333000182')).toBe(false);
    expect(validarCnpj('00000000000000')).toBe(false);
    expect(validarCpfCnpj('52998224725')).toBe(true);
    expect(validarCpfCnpj('11222333000181')).toBe(true);
    expect(validarCpfCnpj('123456789012')).toBe(false);
    expect(erroCpfCnpjPagador('11.222.333/0001-81')).toBeNull();
    expect(erroCpfCnpjPagador('')).toBe('Informe o CPF ou CNPJ.');
  });
});

describe('validações de cartão de crédito', () => {
  const agora = new Date(2026, 10, 24); // Nov/2026

  it('Luhn e comprimento de 13 a 19 dígitos', () => {
    expect(validarLuhn('4111111111111111')).toBe(true);
    expect(validarLuhn('4111111111111112')).toBe(false);
    expect(validarNumeroCartao('4111 1111 1111 1111')).toBe(true);
    expect(validarNumeroCartao('4111 1111 1111 1112')).toBe(false);
    expect(validarNumeroCartao('123456789012')).toBe(false);
  });

  it('validade MM/AA e MM/AAAA não expirada', () => {
    expect(parsearValidadeCartao('11/26')).toEqual({ mes: '11', ano: '2026' });
    expect(parsearValidadeCartao('01/2028')).toEqual({ mes: '01', ano: '2028' });
    expect(parsearValidadeCartao('13/28')).toBeNull();
    expect(validarValidadeCartao('11/26', agora)).toBe(true);
    expect(validarValidadeCartao('10/26', agora)).toBe(false);
    expect(validarValidadeCartao('12/2027', agora)).toBe(true);
  });

  it('CVV e CEP', () => {
    expect(validarCvv('123')).toBe(true);
    expect(validarCvv('1234')).toBe(true);
    expect(validarCvv('12')).toBe(false);
    expect(validarCep('01001-000')).toBe(true);
    expect(validarCep('01001')).toBe(false);
  });

  it('valida formulário completo sem erros quando tudo válido', () => {
    const erros = validarFormularioCartao(
      {
        nomeImpresso: 'MARIANA COSTA',
        numero: '4111 1111 1111 1111',
        validade: '12/28',
        cvv: '123',
        cpfCnpj: '529.982.247-25',
        cep: '01001-000',
        email: 'mariana@exemplo.com',
        telefone: '(11) 98888-7777',
      },
      { agora },
    );
    expect(formularioCartaoTemErros(erros)).toBe(false);
  });

  it('aponta erros individuais quando campos inválidos', () => {
    const erros = validarFormularioCartao(
      {
        nomeImpresso: 'A',
        numero: '1234',
        validade: '01/20',
        cvv: '1',
        cpfCnpj: '000',
        cep: '123',
        email: 'invalido',
        telefone: '1199',
      },
      { agora, exigirEmail: true, exigirTelefone: true },
    );
    expect(formularioCartaoTemErros(erros)).toBe(true);
    expect(erros.nomeImpresso).not.toBeNull();
    expect(erros.numero).not.toBeNull();
    expect(erros.validade).not.toBeNull();
    expect(erros.cvv).not.toBeNull();
    expect(erros.cpfCnpj).not.toBeNull();
    expect(erros.cep).not.toBeNull();
    expect(erros.email).not.toBeNull();
    expect(erros.telefone).not.toBeNull();
  });
});

describe('opcoesDeParcelamento', () => {
  it('quando juros === ALUNO: 1x sem acréscimo e 2x..N com acréscimo da operadora', () => {
    const opcoes = opcoesDeParcelamento(30_000, 3, 'ALUNO');
    expect(opcoes).toHaveLength(3);
    expect(opcoes[0].semAcrescimo).toBe(true);
    expect(espacos(opcoes[0].rotulo)).toBe('1x de R$ 300,00 (à vista, sem acréscimo)');
    expect(opcoes[1].semAcrescimo).toBe(false);
    expect(espacos(opcoes[1].rotulo)).toBe('2x de R$ 150,00 (com acréscimo da operadora)');
    expect(opcoes[2].semAcrescimo).toBe(false);
    expect(espacos(opcoes[2].rotulo)).toBe('3x de R$ 100,00 (com acréscimo da operadora)');
  });

  it('quando juros === TREINADOR: todas as parcelas sem acréscimo', () => {
    const opcoes = opcoesDeParcelamento(80_000, 4, 'TREINADOR');
    expect(opcoes).toHaveLength(4);
    expect(opcoes.every((o) => o.semAcrescimo)).toBe(true);
    expect(espacos(opcoes[3].rotulo)).toBe('4x de R$ 200,00 (sem acréscimo)');
  });

  it('limita maxParcelas entre 1 e 12', () => {
    expect(opcoesDeParcelamento(10_000, 0, 'ALUNO')).toHaveLength(1);
    expect(opcoesDeParcelamento(10_000, 24, 'ALUNO')).toHaveLength(12);
  });
});

describe('calcularResumoAbatimentoSplit', () => {
  it('retorna null para ISENTO ou ausente', () => {
    expect(calcularResumoAbatimentoSplit(null)).toBeNull();
    expect(calcularResumoAbatimentoSplit({ modo: 'ISENTO', percentualBps: 0 })).toBeNull();
  });

  it('calcula progresso percentual e saldo restante no modo ABATER_MENSALIDADE', () => {
    const resumo = calcularResumoAbatimentoSplit({
      modo: 'ABATER_MENSALIDADE',
      percentualBps: 1000,
      metaMensalCentavos: 20_000,
      abatidoMesCentavos: 15_000,
      restanteAbaterCentavos: 5_000,
    });
    expect(resumo).not.toBeNull();
    expect(resumo?.modo).toBe('ABATER_MENSALIDADE');
    expect(resumo?.percentualFormatado).toBe('10%');
    expect(resumo?.progressoPercentual).toBe(75);
    expect(resumo?.restanteAbaterCentavos).toBe(5_000);
    expect(resumo?.quitadoNoMes).toBe(false);
  });

  it('marca quitadoNoMes quando restante zera e limita progresso em 100%', () => {
    const resumo = calcularResumoAbatimentoSplit({
      modo: 'ABATER_MENSALIDADE',
      percentualBps: 1000,
      metaMensalCentavos: 18_990,
      abatidoMesCentavos: 18_990,
      restanteAbaterCentavos: 0,
    });
    expect(resumo?.progressoPercentual).toBe(100);
    expect(resumo?.quitadoNoMes).toBe(true);
  });

  it('suporta TAXA_PLATAFORMA e TAXA_PERCENTUAL', () => {
    const r = calcularResumoAbatimentoSplit({ modo: 'TAXA_PLATAFORMA', percentualBps: 250 });
    expect(r?.modo).toBe('TAXA_PLATAFORMA');
    expect(r?.percentualFormatado).toBe('2,5%');
    expect(formatarPercentualBps(200)).toBe('2%');
    expect(dataUriQrCodeBase64('abc123')).toBe('data:image/png;base64,abc123');
    expect(dataUriQrCodeBase64('data:image/png;base64,xyz')).toBe('data:image/png;base64,xyz');
  });
});
