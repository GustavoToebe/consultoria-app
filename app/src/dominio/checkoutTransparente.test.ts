import {
  calcularResumoAbatimentoSplit,
  dataUriQrCodeBase64,
  erroCpfCnpjPagador,
  erroCpfPagador,
  formatarPercentualBps,
  mascaraCpf,
  mascaraCpfCnpj,
  validarCnpj,
  validarCpf,
  validarCpfCnpj,
} from './checkoutTransparente';

describe('máscaras de documento do pagamento no app', () => {
  it('CPF e CPF/CNPJ', () => {
    expect(mascaraCpf('52998224725')).toBe('529.982.247-25');
    expect(mascaraCpfCnpj('52998224725')).toBe('529.982.247-25');
    expect(mascaraCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
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
