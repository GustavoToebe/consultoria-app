package br.com.treinos.api.pagamentos.provedor;

/** O provedor não faz esta operação (veja {@link CapacidadesDoProvedor}). Erro de programação do chamador, não do usuário. */
public class OperacaoNaoSuportadaException extends UnsupportedOperationException {

    private static final long serialVersionUID = 1L;

    public OperacaoNaoSuportadaException(String provedor, String operacao) {
        super("O provedor " + provedor + " não suporta " + operacao + ".");
    }
}
