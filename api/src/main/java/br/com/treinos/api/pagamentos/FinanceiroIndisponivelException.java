package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

/** Módulo de pagamentos do aluno desligado ({@code TREINOS_PAGAMENTOS_HABILITADO=false}): 503 {@code FINANCEIRO_INDISPONIVEL}. */
public class FinanceiroIndisponivelException extends ApiException {

    private static final long serialVersionUID = 1L;

    public FinanceiroIndisponivelException() {
        super(HttpStatus.SERVICE_UNAVAILABLE, "O financeiro ainda não está disponível.", "FINANCEIRO_INDISPONIVEL");
    }
}
