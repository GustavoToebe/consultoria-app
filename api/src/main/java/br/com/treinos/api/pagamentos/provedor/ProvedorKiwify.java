package br.com.treinos.api.pagamentos.provedor;

import org.springframework.stereotype.Component;

/**
 * O código {@code KIWIFY} no registro de provedores (a baixa precisa de um provedor conhecido). A Kiwify cobra por conta própria:
 * não há link a gerar por aqui, e o aviso e a consulta têm fluxo próprio (assinatura HMAC do corpo cru na rota pública e
 * {@link KiwifyCliente}), então as três operações da interface são "não suportadas" e as capacidades vêm todas desligadas.
 */
@Component
public class ProvedorKiwify implements ProvedorDePagamento {

    public static final String CODIGO = "KIWIFY";

    @Override
    public String codigo() {
        return CODIGO;
    }

    @Override
    public CapacidadesDoProvedor capacidades() {
        return new CapacidadesDoProvedor(false, false, false, 1, false, false, false, false, false);
    }

    @Override
    public CobrancaGerada gerarCobranca(CredencialDoProvedor credencial, PedidoDeCobranca pedido) {
        throw new OperacaoNaoSuportadaException(codigo(), "gerar cobrança");
    }

    @Override
    public ConsultaDeCobranca consultar(CredencialDoProvedor credencial, PedidoDeConsulta pedido) {
        throw new OperacaoNaoSuportadaException(codigo(), "consultar cobrança");
    }

    @Override
    public EventoDeWebhook lerWebhook(RequisicaoDeWebhook requisicao) {
        throw new OperacaoNaoSuportadaException(codigo(), "receber aviso");
    }
}
