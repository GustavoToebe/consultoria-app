import type { OvertrainingPayConfigResponse } from '../api/financeiroOvertrainingPay';
import {
  BANCOS_BRASILEIROS,
  bancoPorCodigo,
  checklistCobrancaTeste,
  CODIGO_OUTRO_BANCO,
  estadoInicialOvertrainingPay,
  etapasDaHomologacao,
  formatarCep,
  formatarDocumentoTitular,
  motivoBloqueioCobrancaTeste,
  podeGerarCobrancaTeste,
  seloDaHomologacao,
  urlOnboardingSegura,
  validarFormularioOvertrainingPay,
  type EstadoFormularioOvertrainingPay,
} from './overtrainingPay';

// Documentos fictícios com dígito verificador válido.
const CPF_VALIDO = '529.982.247-25';
const CNPJ_VALIDO = '11.222.333/0001-81';

const estadoValido = (extra: Partial<EstadoFormularioOvertrainingPay> = {}): EstadoFormularioOvertrainingPay => ({
  tipoPessoa: 'PF',
  documento: CPF_VALIDO,
  documentoJaSalvo: false,
  nomeTitular: 'Treinador Fictício',
  emailFinanceiro: 'financeiro@exemplo.test',
  telefone: '(45) 99999-8888',
  cep: '85801-000',
  enderecoResumo: 'Rua Exemplo, 123, Centro',
  rendaMensalCentavos: 800_000,
  bancoSelecionado: '260',
  bancoCodigoCustom: '',
  bancoNomeCustom: '',
  tipoConta: 'CORRENTE',
  agencia: '0001',
  agenciaJaSalva: false,
  conta: '123456-7',
  contaJaSalva: false,
  repasseAutomatico: true,
  versao: null,
  ...extra,
});

describe('seloDaHomologacao', () => {
  it('devolve rótulo em português e tom semântico para cada situação', () => {
    expect(seloDaHomologacao('NAO_CONFIGURADA')).toEqual({ texto: 'Não configurado', tipo: 'neutro' });
    expect(seloDaHomologacao('DOCUMENTOS_PENDENTES')).toEqual({ texto: 'Documentos pendentes', tipo: 'atencao' });
    expect(seloDaHomologacao('PRONTA_PARA_TESTE')).toEqual({ texto: 'Pronto para teste', tipo: 'atencao' });
    expect(seloDaHomologacao('ATIVA')).toEqual({ texto: 'Ativo e homologado', tipo: 'sucesso' });
    expect(seloDaHomologacao('REJEITADA')).toEqual({ texto: 'Rejeitada', tipo: 'perigo' });
    expect(seloDaHomologacao(null)).toEqual({ texto: 'Não configurado', tipo: 'neutro' });
  });
});

describe('etapasDaHomologacao', () => {
  it('calcula as 4 etapas corretamente para cada estado da trilha', () => {
    expect(etapasDaHomologacao('NAO_CONFIGURADA').map((e) => e.estado)).toEqual(['atual', 'pendente', 'pendente', 'pendente']);
    expect(etapasDaHomologacao('DOCUMENTOS_PENDENTES').map((e) => e.estado)).toEqual(['concluida', 'concluida', 'atual', 'pendente']);
    expect(etapasDaHomologacao('PRONTA_PARA_TESTE').map((e) => e.estado)).toEqual(['concluida', 'concluida', 'concluida', 'atual']);
    expect(etapasDaHomologacao('ATIVA').map((e) => e.estado)).toEqual(['concluida', 'concluida', 'concluida', 'concluida']);
    expect(etapasDaHomologacao('REJEITADA', { titular: true, contaRepasse: true }).map((e) => e.estado)).toEqual([
      'concluida', 'concluida', 'erro', 'pendente',
    ]);
  });

  it('aceita também os nomes de etapas retornados pelo backend Java como fallback', () => {
    expect(etapasDaHomologacao('NAO_CONFIGURADA', {
      dadosCadastrados: true,
      documentosAprovados: false,
      testeHomologado: false,
      ativa: false,
    }).map((e) => e.estado)).toEqual(['concluida', 'concluida', 'atual', 'pendente']);

    expect(etapasDaHomologacao('NAO_CONFIGURADA', {
      dadosCadastrados: true,
      documentosAprovados: true,
      testeHomologado: false,
      ativa: false,
    }).map((e) => e.estado)).toEqual(['concluida', 'concluida', 'concluida', 'atual']);

    expect(etapasDaHomologacao('NAO_CONFIGURADA', {
      dadosCadastrados: true,
      documentosAprovados: true,
      testeHomologado: true,
      ativa: true,
    }).map((e) => e.estado)).toEqual(['concluida', 'concluida', 'concluida', 'concluida']);

    expect(etapasDaHomologacao('REJEITADA', {
      dadosCadastrados: true,
      documentosAprovados: false,
      testeHomologado: false,
      ativa: false,
    }).map((e) => e.estado)).toEqual(['concluida', 'concluida', 'erro', 'pendente']);
  });
});

describe('cobrança teste e checklist', () => {
  it('habilita cobrança teste apenas em PRONTA_PARA_TESTE e ATIVA, com motivo nos demais', () => {
    expect(podeGerarCobrancaTeste('PRONTA_PARA_TESTE')).toBe(true);
    expect(podeGerarCobrancaTeste('ATIVA')).toBe(true);
    expect(motivoBloqueioCobrancaTeste('PRONTA_PARA_TESTE')).toBeUndefined();
    expect(podeGerarCobrancaTeste('NAO_CONFIGURADA')).toBe(false);
    expect(motivoBloqueioCobrancaTeste('NAO_CONFIGURADA')).toBeTruthy();
    expect(podeGerarCobrancaTeste('DOCUMENTOS_PENDENTES')).toBe(false);
    expect(motivoBloqueioCobrancaTeste('DOCUMENTOS_PENDENTES')).toContain('documentos');
    expect(podeGerarCobrancaTeste('REJEITADA')).toBe(false);
    expect(motivoBloqueioCobrancaTeste('REJEITADA')).toBeTruthy();
  });

  it('monta os 4 itens do checklist conforme a situação', () => {
    expect(checklistCobrancaTeste('CRIADA').map((i) => i.concluido)).toEqual([true, false, false, false]);
    expect(checklistCobrancaTeste('PAGA').map((i) => i.concluido)).toEqual([true, true, true, false]);
    expect(checklistCobrancaTeste('HOMOLOGADA').map((i) => i.concluido)).toEqual([true, true, true, true]);
  });
});

describe('bancos brasileiros e utilitários', () => {
  it('contém os 10 principais bancos com código COMPE', () => {
    const codigos = BANCOS_BRASILEIROS.map((b) => b.codigo);
    expect(codigos).toEqual(['260', '341', '077', '001', '237', '033', '748', '756', '336', '208']);
    expect(bancoPorCodigo('260')?.nome).toBe('Nubank');
    expect(bancoPorCodigo('1')?.nome).toBe('Banco do Brasil');
    expect(bancoPorCodigo('999')).toBeNull();
  });

  it('formata CEP, documento e valida URL de onboarding https', () => {
    expect(formatarCep('85801000')).toBe('85801-000');
    expect(formatarDocumentoTitular('PF', '52998224725')).toBe(CPF_VALIDO);
    expect(formatarDocumentoTitular('PJ', '11222333000181')).toBe(CNPJ_VALIDO);
    expect(urlOnboardingSegura('https://sandbox.asaas.com/onboarding/123')).toBe('https://sandbox.asaas.com/onboarding/123');
    expect(urlOnboardingSegura('http://inseguro.com')).toBeNull();
    expect(urlOnboardingSegura('javascript:alert(1)')).toBeNull();
  });
});

describe('estadoInicialOvertrainingPay e validarFormularioOvertrainingPay', () => {
  it('valida formulário completo PF e devolve corpo normalizado', () => {
    const r = validarFormularioOvertrainingPay(estadoValido());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.corpo).toMatchObject({
        tipoPessoa: 'PF',
        documento: '52998224725',
        nomeTitular: 'Treinador Fictício',
        emailFinanceiro: 'financeiro@exemplo.test',
        telefone: '45999998888',
        cep: '85801-000',
        bancoCodigo: '260',
        bancoNome: 'Nubank',
        agencia: '0001',
        conta: '123456-7',
      });
      // O parcelamento é decidido na página do Asaas: o corpo não leva política de parcelas nem de juros.
      expect(r.corpo).not.toHaveProperty('maxParcelas');
      expect(r.corpo).not.toHaveProperty('jurosParcelamento');
    }
  });

  it('valida PJ com CNPJ e opção de outro banco', () => {
    const r = validarFormularioOvertrainingPay(estadoValido({
      tipoPessoa: 'PJ',
      documento: CNPJ_VALIDO,
      bancoSelecionado: CODIGO_OUTRO_BANCO,
      bancoCodigoCustom: '104',
      bancoNomeCustom: 'Caixa Econômica',
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.corpo.documento).toBe('11222333000181');
      expect(r.corpo.bancoCodigo).toBe('104');
      expect(r.corpo.bancoNome).toBe('Caixa Econômica');
    }
  });

  it('aceita campos sensíveis em branco quando já estão salvos (write-only)', () => {
    const respostaApi: OvertrainingPayConfigResponse = {
      situacao: 'DOCUMENTOS_PENDENTES',
      tipoPessoa: 'PF',
      documentoMascarado: '***.982.247-**',
      nomeTitular: 'Treinador Fictício',
      emailFinanceiro: 'financeiro@exemplo.test',
      telefoneMascarado: '(45) *****-8888',
      cep: '85801-000',
      enderecoResumo: 'Rua Exemplo, 123',
      rendaMensalCentavos: 800_000,
      bancoCodigo: '341',
      bancoNome: 'Itaú',
      tipoConta: 'CORRENTE',
      agenciaMascarada: '**01',
      contaMascarada: '****56-7',
      repasseAutomatico: true,
      onboardingUrl: null,
      cobrancasLiquidadas: 0,
      homologadaEm: null,
      versao: 2,
    };
    const inicial = estadoInicialOvertrainingPay(respostaApi);
    expect(inicial.documento).toBe('');
    expect(inicial.documentoJaSalvo).toBe(true);
    expect(inicial.agenciaJaSalva).toBe(true);
    expect(inicial.contaJaSalva).toBe(true);
    const r = validarFormularioOvertrainingPay(inicial);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.corpo.documento).toBeUndefined();
      expect(r.corpo.agencia).toBeUndefined();
      expect(r.corpo.conta).toBeUndefined();
      expect(r.corpo.versao).toBe(2);
    }
  });

  it('recusa CPF, CNPJ, e-mail, CEP, agência, conta, renda inválidos', () => {
    const r = validarFormularioOvertrainingPay(estadoValido({
      documento: '111.111.111-11',
      nomeTitular: 'AB',
      emailFinanceiro: 'invalido',
      telefone: '123',
      cep: '123',
      enderecoResumo: '',
      rendaMensalCentavos: 0,
      bancoSelecionado: CODIGO_OUTRO_BANCO,
      bancoCodigoCustom: '12',
      bancoNomeCustom: '',
      agencia: '1',
      conta: '12',
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros.documento).toBeTruthy();
      expect(r.erros.nomeTitular).toBeTruthy();
      expect(r.erros.emailFinanceiro).toBeTruthy();
      expect(r.erros.telefone).toBeTruthy();
      expect(r.erros.cep).toBeTruthy();
      expect(r.erros.enderecoResumo).toBeTruthy();
      expect(r.erros.rendaMensalCentavos).toBeTruthy();
      expect(r.erros.bancoCodigo).toBeTruthy();
      expect(r.erros.bancoNome).toBeTruthy();
      expect(r.erros.agencia).toBeTruthy();
      expect(r.erros.conta).toBeTruthy();
    }
  });
});
