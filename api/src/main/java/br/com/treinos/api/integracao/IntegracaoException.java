package br.com.treinos.api.integracao;

import br.com.treinos.api.web.ApiException;
import org.springframework.http.HttpStatus;

/** Erro de contrato da integração (422, 502, 503...): o {@code GlobalExceptionHandler} já o traduz em {@code ApiError}. */
public class IntegracaoException extends ApiException {

    public IntegracaoException(HttpStatus status, String message, String codigo) {
        super(status, message, codigo);
    }

    public static IntegracaoException naoConfigurada() {
        return new IntegracaoException(HttpStatus.SERVICE_UNAVAILABLE,
                "A integração com a central não está configurada.", "INTEGRACAO_NAO_CONFIGURADA");
    }

    public static IntegracaoException centralIndisponivel() {
        return new IntegracaoException(HttpStatus.BAD_GATEWAY,
                "A central não respondeu. Tente de novo em instantes.", "CENTRAL_INDISPONIVEL");
    }

    public static IntegracaoException instanciaNaoEncontrada() {
        return new IntegracaoException(HttpStatus.NOT_FOUND, "Instância não encontrada.", "INSTANCIA_NAO_ENCONTRADA");
    }
}
