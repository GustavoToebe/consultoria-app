package br.com.treinos.api.web;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * 422 com a lista de problemas em {@code fieldErrors} ({@code field} = caminho no conteúdo do plano). Usada por
 * {@code PLANO_INVALIDO} (erros que bloqueiam) e {@code CONFIRMAR_AVISOS} (avisos que pedem confirmação).
 */
public class ValidacaoException extends ApiException {

    private static final long serialVersionUID = 1L;

    private final transient List<ApiError.FieldError> problemas;

    public ValidacaoException(String message, String codigo, List<ApiError.FieldError> problemas) {
        super(HttpStatus.UNPROCESSABLE_CONTENT, message, codigo);
        this.problemas = List.copyOf(problemas);
    }

    public List<ApiError.FieldError> getProblemas() {
        return problemas;
    }
}
