package br.com.treinos.api.pagamentos.provedor;

/** O aviso não passou na conferência do adaptador. A mensagem é fixa: nunca leva o corpo recebido. */
public class WebhookInvalidoException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public WebhookInvalidoException() {
        super("Aviso do provedor inválido.");
    }
}
