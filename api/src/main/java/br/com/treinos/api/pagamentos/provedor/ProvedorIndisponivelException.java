package br.com.treinos.api.pagamentos.provedor;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/**
 * O provedor não respondeu como deveria (rede, HTTP, JSON ou resposta sem o que se espera): 503
 * {@code PROVEDOR_INDISPONIVEL}. A mensagem é fixa e a exceção não carrega causa: nunca repete corpo, URL nem segredo.
 */
public class ProvedorIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public ProvedorIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "O provedor de pagamento não respondeu agora. Tente de novo em instantes.",
                "PROVEDOR_INDISPONIVEL");
    }
}
