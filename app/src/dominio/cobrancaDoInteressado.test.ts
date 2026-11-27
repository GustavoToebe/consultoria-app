import {
  corpoDaConfirmacao,
  pedidoDeContratacao,
  planoDoInteressado,
  podeConfirmarPagamento,
  podeGerarCobranca,
  propostaComOutroValor,
  temContratacaoVigente,
} from './cobrancaDoInteressado';

const semProposta = {
  planoId: null, planoNome: null, modalidade: null, periodicidade: null, valorReferenciaCentavos: null, valorCentavos: null,
  condicoes: null, atualizadaEm: null, atualizadaPorNome: null,
};

describe('cobrancaDoInteressado', () => {
  it('confirmar pagamento só em atendimento e sem pagamento confirmado', () => {
    expect(podeConfirmarPagamento('NOVA', 'NAO_CONTROLADO')).toBe(true);
    expect(podeConfirmarPagamento('EM_NEGOCIACAO', 'AGUARDANDO')).toBe(true);
    expect(podeConfirmarPagamento('EM_CONTATO', 'CONFIRMADO_MANUAL')).toBe(false);
    expect(podeConfirmarPagamento('ACEITA', 'AGUARDANDO')).toBe(false);
    expect(podeConfirmarPagamento('RECUSADA', 'AGUARDANDO')).toBe(false);
  });

  it('o corpo da confirmação usa o gravado e a versão vista', () => {
    expect(corpoDaConfirmacao({ situacao: 'EM_CONTATO', responsavelId: 'u1', versao: 4 }))
      .toEqual({ situacao: 'EM_CONTATO', pagamento: 'CONFIRMADO_MANUAL', responsavelId: 'u1', versao: 4 });
  });

  it('o plano da proposta vale mais que o da página, mesmo escrito à mão', () => {
    const pagina = { planoComercialId: 'p-pagina', planoComercialNome: 'Trimestral' };
    expect(planoDoInteressado({ ...pagina, proposta: semProposta })).toEqual({ id: 'p-pagina', nome: 'Trimestral' });
    expect(planoDoInteressado({ ...pagina, proposta: { ...semProposta, planoId: 'p-prop', planoNome: 'Anual' } }))
      .toEqual({ id: 'p-prop', nome: 'Anual' });
    expect(planoDoInteressado({ ...pagina, proposta: { ...semProposta, planoNome: 'Combinado no WhatsApp' } }))
      .toEqual({ id: null, nome: 'Combinado no WhatsApp' });
    expect(planoDoInteressado({ planoComercialId: null, planoComercialNome: null, proposta: semProposta })).toEqual({ id: null, nome: null });
  });

  it('gerar cobrança só na aceita com aluno e fora da cortesia', () => {
    expect(podeGerarCobranca({ situacao: 'ACEITA', alunoId: 'a1' })).toBe(true);
    expect(podeGerarCobranca({ situacao: 'ACEITA', alunoId: 'a1', aceitaSemCobranca: true })).toBe(false);
    expect(podeGerarCobranca({ situacao: 'ACEITA', alunoId: null })).toBe(false);
    expect(podeGerarCobranca({ situacao: 'EM_CONTATO', alunoId: 'a1' })).toBe(false);
  });

  it('contratação ativa ou pausada ainda vale', () => {
    expect(temContratacaoVigente([])).toBe(false);
    expect(temContratacaoVigente([{ situacao: 'ENCERRADA' }])).toBe(false);
    expect(temContratacaoVigente([{ situacao: 'ENCERRADA' }, { situacao: 'PAUSADA' }])).toBe(true);
    expect(temContratacaoVigente([{ situacao: 'ATIVA' }])).toBe(true);
  });

  it('o contratar não leva valor: o servidor usa o do plano', () => {
    expect(pedidoDeContratacao('p1', '2026-11-30', true)).toEqual({
      planoComercialId: 'p1', valorCentavos: null, inicio: '2026-11-30', diaVencimento: 30, primeiroPeriodoPago: true, gerarMesesAnteriores: false,
    });
    expect(pedidoDeContratacao('p1', '2026-12-05', false).diaVencimento).toBe(5);
  });

  it('compara o valor da proposta com o do plano sem calcular', () => {
    expect(propostaComOutroValor(null, 99700)).toBe(false);
    expect(propostaComOutroValor(99700, 99700)).toBe(false);
    expect(propostaComOutroValor(89700, 99700)).toBe(true);
  });
});
