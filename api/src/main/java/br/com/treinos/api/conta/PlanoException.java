package br.com.treinos.api.conta;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

import java.util.List;

/**
 * O plano da consultoria não cobre o pedido. 409 {@code LIMITE_DO_PLANO} (limite atingido) ou 403
 * {@code FUNCIONALIDADE_FORA_DO_PLANO}; o recurso vai em {@code fieldErrors[0].field} (o corpo de erro da biblioteca não
 * tem campo extra) e a mensagem nunca leva nome nem dado de pessoa.
 */
public class PlanoException extends ApiException {

    public static final String LIMITE = "LIMITE_DO_PLANO";
    public static final String FUNCIONALIDADE = "FUNCIONALIDADE_FORA_DO_PLANO";

    private static final long serialVersionUID = 1L;

    private final transient List<ApiError.FieldError> problemas;

    private PlanoException(HttpStatus status, String mensagem, String codigo, String recurso) {
        super(status, mensagem, codigo);
        this.problemas = List.of(new ApiError.FieldError(recurso, mensagem));
    }

    public static PlanoException limite(String recurso, String mensagem) {
        return new PlanoException(HttpStatus.CONFLICT, mensagem, LIMITE, recurso);
    }

    public static PlanoException funcionalidade(String codigo) {
        return new PlanoException(HttpStatus.FORBIDDEN, "Este recurso não está disponível no seu plano.", FUNCIONALIDADE,
                codigo);
    }

    public List<ApiError.FieldError> getProblemas() {
        return problemas;
    }
}
