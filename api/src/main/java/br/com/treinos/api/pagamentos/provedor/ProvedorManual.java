package br.com.treinos.api.pagamentos.provedor;

import br.com.treinos.api.pagamentos.CobrancaAluno;
import org.springframework.stereotype.Component;

/**
 * O provedor da baixa à mão: o treinador recebeu por fora e registra. Não gera link, não tem aviso e não há nada a
 * consultar, então tudo isso é "não suportado"; a baixa passa pelo mesmo serviço comum dos outros provedores.
 */
@Component
public class ProvedorManual implements ProvedorDePagamento {

    @Override
    public String codigo() {
        return CobrancaAluno.MANUAL;
    }

    @Override
    public CapacidadesDoProvedor capacidades() {
        return new CapacidadesDoProvedor(false, false, false, 1, false, false, false, false, false);
    }

    @Override
    public CobrancaGerada gerarCobranca(PedidoDeCobranca pedido) {
        throw new OperacaoNaoSuportadaException(codigo(), "gerar cobrança");
    }

    @Override
    public ConsultaDeCobranca consultar(String idExterno) {
        throw new OperacaoNaoSuportadaException(codigo(), "consultar cobrança");
    }

    @Override
    public EventoDeWebhook lerWebhook(RequisicaoDeWebhook requisicao) {
        throw new OperacaoNaoSuportadaException(codigo(), "receber aviso");
    }
}
